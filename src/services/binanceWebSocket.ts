// ============================================================================
// BINANCE WEBSOCKET SERVICE - Real-Time Market Microstructure Data
// Provides REAL live data: Order Book, Trades, Ticker
// FREE API - No API key required
// ============================================================================

// Types for Binance data
export interface OrderBookLevel {
  price: number;
  quantity: number;
}

export interface OrderBook {
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  lastUpdateId: number;
  timestamp: number;
}

export interface Trade {
  id: number;
  price: number;
  quantity: number;
  time: number;
  isBuyerMaker: boolean; // true = sell (maker was buyer), false = buy (maker was seller)
}

export interface Ticker24h {
  symbol: string;
  priceChange: number;
  priceChangePercent: number;
  lastPrice: number;
  highPrice: number;
  lowPrice: number;
  volume: number;
  quoteVolume: number; // Volume in quote currency (USDT)
  openPrice: number;
  closeTime: number;
  bidPrice: number;
  askPrice: number;
  bidQty: number;
  askQty: number;
}

export interface MicrostructureMetrics {
  // Order Book Metrics
  bidAskSpread: number;           // Current spread in $
  spreadBps: number;              // Spread in basis points
  orderBookImbalance: number;     // (bid_vol - ask_vol) / (bid_vol + ask_vol), range [-1, 1]
  midPrice: number;               // (best_bid + best_ask) / 2
  bidDepth: number;               // Total bid volume (top 20 levels)
  askDepth: number;               // Total ask volume (top 20 levels)
  depthRatio: number;             // bidDepth / askDepth
  
  // Trade Flow Metrics
  buyVolume: number;              // Volume from buy orders (last 100 trades)
  sellVolume: number;             // Volume from sell orders (last 100 trades)
  netOrderFlow: number;           // buyVolume - sellVolume
  vwap: number;                   // Volume Weighted Average Price
  tradeIntensity: number;         // Trades per second
  avgTradeSize: number;           // Average trade size
  
  // Volatility Metrics
  realizedVolatility: number;     // Realized vol from recent trades (annualized)
  priceRange: number;             // High - Low (24h)
  
  // Raw data
  lastPrice: number;
  timestamp: number;
}

// Binance WebSocket endpoints (no API key needed)
// For combined streams, use the /stream endpoint
const BINANCE_WS_SINGLE = 'wss://stream.binance.com:9443/ws';
const BINANCE_WS_COMBINED = 'wss://stream.binance.com:9443/stream?streams=';

// Binance REST API (fallback)
const BINANCE_REST_BASE = 'https://api.binance.com/api/v3';

// Crypto symbols to track (most liquid pairs - top 10 by volume)
export const CRYPTO_SYMBOLS = [
  'BTCUSDT',   // Bitcoin
  'ETHUSDT',   // Ethereum
  'BNBUSDT',   // BNB
  'SOLUSDT',   // Solana
  'XRPUSDT',   // Ripple
  'DOGEUSDT',  // Dogecoin
  'ADAUSDT',   // Cardano
  'AVAXUSDT',  // Avalanche
  'LINKUSDT',  // Chainlink
  'MATICUSDT'  // Polygon
];

// Store for real-time data
const orderBooks: Map<string, OrderBook> = new Map();
const recentTrades: Map<string, Trade[]> = new Map(); // Keep last 100 trades per symbol
const tickers: Map<string, Ticker24h> = new Map();

// WebSocket connections
let wsConnection: WebSocket | null = null;
let isConnected = false;
let isInitializing = false; // Prevent multiple simultaneous starts
let connectionStarted = false; // Track if connection has been started at least once
let listeners: Array<(data: { symbol: string; metrics: MicrostructureMetrics }) => void> = [];

// Calculate metrics from raw data
function calculateMetrics(symbol: string): MicrostructureMetrics | null {
  const orderBook = orderBooks.get(symbol);
  const trades = recentTrades.get(symbol) || [];
  const ticker = tickers.get(symbol);
  
  if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
    return null;
  }
  
  const bestBid = orderBook.bids[0];
  const bestAsk = orderBook.asks[0];
  
  // Order Book Metrics
  const midPrice = (bestBid.price + bestAsk.price) / 2;
  const bidAskSpread = bestAsk.price - bestBid.price;
  const spreadBps = (bidAskSpread / midPrice) * 10000;
  
  // Depth calculation (sum of top 20 levels)
  const bidDepth = orderBook.bids.slice(0, 20).reduce((sum, level) => sum + level.quantity, 0);
  const askDepth = orderBook.asks.slice(0, 20).reduce((sum, level) => sum + level.quantity, 0);
  const totalDepth = bidDepth + askDepth;
  const orderBookImbalance = totalDepth > 0 ? (bidDepth - askDepth) / totalDepth : 0;
  const depthRatio = askDepth > 0 ? bidDepth / askDepth : 1;
  
  // Trade Flow Metrics
  let buyVolume = 0;
  let sellVolume = 0;
  let volumeWeightedPrice = 0;
  let totalVolume = 0;
  
  for (const trade of trades) {
    const vol = trade.quantity * trade.price;
    if (trade.isBuyerMaker) {
      sellVolume += trade.quantity;
    } else {
      buyVolume += trade.quantity;
    }
    volumeWeightedPrice += trade.price * trade.quantity;
    totalVolume += trade.quantity;
  }
  
  const vwap = totalVolume > 0 ? volumeWeightedPrice / totalVolume : midPrice;
  const netOrderFlow = buyVolume - sellVolume;
  const avgTradeSize = trades.length > 0 ? totalVolume / trades.length : 0;
  
  // Trade intensity (trades per second)
  let tradeIntensity = 0;
  if (trades.length >= 2) {
    const timeSpan = (trades[trades.length - 1].time - trades[0].time) / 1000; // in seconds
    tradeIntensity = timeSpan > 0 ? trades.length / timeSpan : 0;
  }
  
  // Realized volatility from recent trades
  let realizedVolatility = 0;
  if (trades.length >= 10) {
    const returns: number[] = [];
    for (let i = 1; i < trades.length; i++) {
      if (trades[i - 1].price > 0) {
        returns.push(Math.log(trades[i].price / trades[i - 1].price));
      }
    }
    if (returns.length > 0) {
      const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
      const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
      // Annualize: assuming ~1 trade per second on average, scale to annual
      // Crypto trades 24/7, so ~31.5M seconds per year
      realizedVolatility = Math.sqrt(variance) * Math.sqrt(31536000 * tradeIntensity) * 100;
    }
  }
  
  // Price range from ticker
  const priceRange = ticker ? ticker.highPrice - ticker.lowPrice : 0;
  
  return {
    bidAskSpread,
    spreadBps,
    orderBookImbalance,
    midPrice,
    bidDepth,
    askDepth,
    depthRatio,
    buyVolume,
    sellVolume,
    netOrderFlow,
    vwap,
    tradeIntensity,
    avgTradeSize,
    realizedVolatility,
    priceRange,
    lastPrice: ticker?.lastPrice || midPrice,
    timestamp: Date.now()
  };
}

// Parse order book update from WebSocket
// depth20@100ms returns { bids: [[price, qty], ...], asks: [[price, qty], ...], lastUpdateId: number }
function parseOrderBookUpdate(data: { 
  bids?: [string, string][]; 
  asks?: [string, string][]; 
  b?: [string, string][]; 
  a?: [string, string][]; 
  lastUpdateId?: number;
  u?: number 
}): Partial<OrderBook> {
  // Handle both formats: depth20 uses 'bids'/'asks', diff depth uses 'b'/'a'
  const bidData = data.bids || data.b || [];
  const askData = data.asks || data.a || [];
  const updateId = data.lastUpdateId || data.u || 0;
  
  return {
    bids: bidData.map(([price, qty]) => ({ price: parseFloat(price), quantity: parseFloat(qty) })),
    asks: askData.map(([price, qty]) => ({ price: parseFloat(price), quantity: parseFloat(qty) })),
    lastUpdateId: updateId
  };
}

// Parse trade from WebSocket
function parseTrade(data: {
  t: number;
  p: string;
  q: string;
  T: number;
  m: boolean;
}): Trade {
  return {
    id: data.t,
    price: parseFloat(data.p),
    quantity: parseFloat(data.q),
    time: data.T,
    isBuyerMaker: data.m
  };
}

// Parse 24h ticker from WebSocket
function parseTicker(data: {
  s: string;
  p: string;
  P: string;
  c: string;
  h: string;
  l: string;
  v: string;
  q: string;
  o: string;
  C: number;
  b: string;
  a: string;
  B: string;
  A: string;
}): Ticker24h {
  return {
    symbol: data.s,
    priceChange: parseFloat(data.p),
    priceChangePercent: parseFloat(data.P),
    lastPrice: parseFloat(data.c),
    highPrice: parseFloat(data.h),
    lowPrice: parseFloat(data.l),
    volume: parseFloat(data.v),
    quoteVolume: parseFloat(data.q),
    openPrice: parseFloat(data.o),
    closeTime: data.C,
    bidPrice: parseFloat(data.b),
    askPrice: parseFloat(data.a),
    bidQty: parseFloat(data.B),
    askQty: parseFloat(data.A)
  };
}

// Fallback: Fetch data via REST API if WebSocket is blocked
let restPollingInterval: NodeJS.Timeout | null = null;

async function fetchViaRestApi(symbol: string): Promise<void> {
  try {
    // Fetch order book
    const depthResponse = await fetch(`${BINANCE_REST_BASE}/depth?symbol=${symbol}&limit=20`);
    if (depthResponse.ok) {
      const depthData = await depthResponse.json();
      orderBooks.set(symbol, {
        bids: depthData.bids.map(([price, qty]: [string, string]) => ({ 
          price: parseFloat(price), 
          quantity: parseFloat(qty) 
        })),
        asks: depthData.asks.map(([price, qty]: [string, string]) => ({ 
          price: parseFloat(price), 
          quantity: parseFloat(qty) 
        })),
        lastUpdateId: depthData.lastUpdateId,
        timestamp: Date.now()
      });
    }
    
    // Fetch recent trades
    const tradesResponse = await fetch(`${BINANCE_REST_BASE}/trades?symbol=${symbol}&limit=50`);
    if (tradesResponse.ok) {
      const tradesData = await tradesResponse.json();
      const trades = tradesData.map((t: { id: number; price: string; qty: string; time: number; isBuyerMaker: boolean }) => ({
        id: t.id,
        price: parseFloat(t.price),
        quantity: parseFloat(t.qty),
        time: t.time,
        isBuyerMaker: t.isBuyerMaker
      }));
      recentTrades.set(symbol, trades);
    }
    
    // Fetch 24h ticker
    const tickerResponse = await fetch(`${BINANCE_REST_BASE}/ticker/24hr?symbol=${symbol}`);
    if (tickerResponse.ok) {
      const tickerData = await tickerResponse.json();
      tickers.set(symbol, {
        symbol: tickerData.symbol,
        priceChange: parseFloat(tickerData.priceChange),
        priceChangePercent: parseFloat(tickerData.priceChangePercent),
        lastPrice: parseFloat(tickerData.lastPrice),
        highPrice: parseFloat(tickerData.highPrice),
        lowPrice: parseFloat(tickerData.lowPrice),
        volume: parseFloat(tickerData.volume),
        quoteVolume: parseFloat(tickerData.quoteVolume),
        openPrice: parseFloat(tickerData.openPrice),
        closeTime: tickerData.closeTime,
        bidPrice: parseFloat(tickerData.bidPrice),
        askPrice: parseFloat(tickerData.askPrice),
        bidQty: parseFloat(tickerData.bidQty),
        askQty: parseFloat(tickerData.askQty)
      });
    }
    
    // Notify listeners
    const metrics = calculateMetrics(symbol);
    if (metrics) {
      listeners.forEach(listener => {
        listener({ symbol, metrics });
      });
    }
  } catch (error) {
    console.warn(`REST API fetch failed for ${symbol}:`, error);
  }
}

async function startRestPolling(): Promise<void> {
  console.log('🔄 Starting REST API polling fallback...');
  
  // Initial fetch for all symbols
  for (const symbol of CRYPTO_SYMBOLS) {
    await fetchViaRestApi(symbol);
  }
  
  // Poll every 2 seconds
  restPollingInterval = setInterval(async () => {
    for (const symbol of CRYPTO_SYMBOLS) {
      await fetchViaRestApi(symbol);
    }
  }, 2000);
}

function stopRestPolling(): void {
  if (restPollingInterval) {
    clearInterval(restPollingInterval);
    restPollingInterval = null;
  }
}

// Connect to Binance WebSocket - Single combined connection for all symbols
function connectAllSymbols(): void {
  // Build combined stream URL with all symbols and all stream types
  const allStreams: string[] = [];
  
  for (const symbol of CRYPTO_SYMBOLS) {
    const s = symbol.toLowerCase();
    allStreams.push(`${s}@depth20@100ms`); // Order book (top 20 levels, 100ms)
    allStreams.push(`${s}@trade`);          // Real-time trades
    allStreams.push(`${s}@ticker`);         // 24h ticker
  }
  
  // Use combined stream URL
  const wsUrl = `${BINANCE_WS_COMBINED}${allStreams.join('/')}`;
  
  console.log(`📊 Connecting to Binance WebSocket...`);
  console.log(`📊 Streams: ${CRYPTO_SYMBOLS.join(', ')}`);
  
  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    console.log(`✅ Binance WebSocket connected for all symbols!`);
    isConnected = true;
    wsConnection = ws;
  };
  
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const stream = data.stream;
      const payload = data.data;
      
      if (!stream || !payload) {
        return;
      }
      
      // Extract symbol from stream name (e.g., "btcusdt@depth20@100ms" -> "BTCUSDT")
      const symbol = stream.split('@')[0].toUpperCase();
      
      if (stream.includes('@depth')) {
        // Order book update
        const update = parseOrderBookUpdate(payload);
        const existing = orderBooks.get(symbol) || { bids: [], asks: [], lastUpdateId: 0, timestamp: 0 };
        
        orderBooks.set(symbol, {
          bids: update.bids || existing.bids,
          asks: update.asks || existing.asks,
          lastUpdateId: update.lastUpdateId || existing.lastUpdateId,
          timestamp: Date.now()
        });
        
      } else if (stream.includes('@trade')) {
        // Trade update
        const trade = parseTrade(payload);
        const trades = recentTrades.get(symbol) || [];
        trades.push(trade);
        if (trades.length > 100) {
          trades.shift();
        }
        recentTrades.set(symbol, trades);
        
      } else if (stream.includes('@ticker')) {
        // Ticker update
        const ticker = parseTicker(payload);
        tickers.set(symbol, ticker);
      }
      
      // Notify listeners with updated metrics
      const metrics = calculateMetrics(symbol);
      if (metrics) {
        listeners.forEach(listener => {
          listener({ symbol, metrics });
        });
      }
      
    } catch (error) {
      console.warn('Error parsing Binance WebSocket message:', error);
    }
  };
  
  ws.onerror = (error) => {
    console.warn(`Binance WebSocket error:`, error);
    isConnected = false;
  };
  
  ws.onclose = () => {
    console.log(`Binance WebSocket closed`);
    wsConnection = null;
    isConnected = false;
    
    // Reconnect after 5 seconds
    setTimeout(() => {
      console.log('🔄 Reconnecting to Binance WebSocket...');
      connectAllSymbols();
    }, 5000);
  };
}

// Public API

/**
 * Fetch initial data for all symbols via REST API immediately
 * This provides instant data while WebSocket connects in background
 */
async function fetchInitialDataViaRest(): Promise<void> {
  console.log('⚡ Fetching initial data via REST API for instant display...');
  
  // Fetch all symbols in parallel for speed
  const fetchPromises = CRYPTO_SYMBOLS.map(async (symbol) => {
    try {
      // Fetch all three endpoints in parallel per symbol
      const [depthRes, tradesRes, tickerRes] = await Promise.all([
        fetch(`${BINANCE_REST_BASE}/depth?symbol=${symbol}&limit=20`),
        fetch(`${BINANCE_REST_BASE}/trades?symbol=${symbol}&limit=50`),
        fetch(`${BINANCE_REST_BASE}/ticker/24hr?symbol=${symbol}`)
      ]);
      
      if (depthRes.ok) {
        const depthData = await depthRes.json();
        orderBooks.set(symbol, {
          bids: depthData.bids.map(([price, qty]: [string, string]) => ({ 
            price: parseFloat(price), 
            quantity: parseFloat(qty) 
          })),
          asks: depthData.asks.map(([price, qty]: [string, string]) => ({ 
            price: parseFloat(price), 
            quantity: parseFloat(qty) 
          })),
          lastUpdateId: depthData.lastUpdateId,
          timestamp: Date.now()
        });
      }
      
      if (tradesRes.ok) {
        const tradesData = await tradesRes.json();
        recentTrades.set(symbol, tradesData.map((t: { id: number; price: string; qty: string; time: number; isBuyerMaker: boolean }) => ({
          id: t.id,
          price: parseFloat(t.price),
          quantity: parseFloat(t.qty),
          time: t.time,
          isBuyerMaker: t.isBuyerMaker
        })));
      }
      
      if (tickerRes.ok) {
        const tickerData = await tickerRes.json();
        tickers.set(symbol, {
          symbol: tickerData.symbol,
          priceChange: parseFloat(tickerData.priceChange),
          priceChangePercent: parseFloat(tickerData.priceChangePercent),
          lastPrice: parseFloat(tickerData.lastPrice),
          highPrice: parseFloat(tickerData.highPrice),
          lowPrice: parseFloat(tickerData.lowPrice),
          volume: parseFloat(tickerData.volume),
          quoteVolume: parseFloat(tickerData.quoteVolume),
          openPrice: parseFloat(tickerData.openPrice),
          closeTime: tickerData.closeTime,
          bidPrice: parseFloat(tickerData.bidPrice),
          askPrice: parseFloat(tickerData.askPrice),
          bidQty: parseFloat(tickerData.bidQty),
          askQty: parseFloat(tickerData.askQty)
        });
      }
      
      // Notify listeners with initial data
      const metrics = calculateMetrics(symbol);
      if (metrics) {
        listeners.forEach(listener => {
          listener({ symbol, metrics });
        });
      }
    } catch (error) {
      console.warn(`Initial REST fetch failed for ${symbol}:`, error);
    }
  });
  
  await Promise.all(fetchPromises);
  console.log('✅ Initial data loaded via REST API');
}

/**
 * Start WebSocket connection for all crypto symbols
 * Singleton pattern - only starts once, subsequent calls return same cleanup
 * Fetches initial data via REST immediately for fast display
 */
export function startBinanceWebSocket(): () => void {
  // If already started or initializing, don't restart - just return no-op cleanup
  if (connectionStarted || isInitializing) {
    console.log('📡 Binance connection already active, reusing...');
    return () => {
      // No-op - connection is shared
    };
  }
  
  isInitializing = true;
  connectionStarted = true;
  console.log('🚀 Starting Binance data connection...');
  
  // Initialize data structures
  for (const symbol of CRYPTO_SYMBOLS) {
    recentTrades.set(symbol, []);
    orderBooks.set(symbol, { bids: [], asks: [], lastUpdateId: 0, timestamp: 0 });
  }
  
  // IMMEDIATELY fetch initial data via REST API for instant display
  // This runs in parallel with WebSocket connection
  fetchInitialDataViaRest()
    .then(() => {
      isInitializing = false;
    })
    .catch((err) => {
      console.error('REST fetch error:', err);
      isInitializing = false;
    });
  
  // Connect to all symbols via single WebSocket (in parallel)
  connectAllSymbols();
  
  // Fallback: if WebSocket not connected within 5 seconds, use REST polling
  const fallbackTimeout = setTimeout(() => {
    if (!isConnected) {
      console.log('⚠️ WebSocket connection timeout, falling back to REST API polling...');
      startRestPolling();
    }
  }, 5000);
  
  // Return cleanup function (only first caller gets the real cleanup)
  return () => {
    console.log('🔌 Closing Binance connection...');
    clearTimeout(fallbackTimeout);
    stopRestPolling();
    if (wsConnection) {
      wsConnection.close();
      wsConnection = null;
    }
    isConnected = false;
    connectionStarted = false;
    isInitializing = false;
    listeners = [];
  };
}

/**
 * Subscribe to real-time metric updates
 */
export function subscribeToMetrics(
  callback: (data: { symbol: string; metrics: MicrostructureMetrics }) => void
): () => void {
  listeners.push(callback);
  
  // Send current data immediately
  for (const symbol of CRYPTO_SYMBOLS) {
    const metrics = calculateMetrics(symbol);
    if (metrics) {
      callback({ symbol, metrics });
    }
  }
  
  // Return unsubscribe function
  return () => {
    listeners = listeners.filter(l => l !== callback);
  };
}

/**
 * Get current metrics for a symbol (synchronous)
 */
export function getMetrics(symbol: string): MicrostructureMetrics | null {
  return calculateMetrics(symbol);
}

/**
 * Get all current metrics
 */
export function getAllMetrics(): Map<string, MicrostructureMetrics> {
  const result = new Map<string, MicrostructureMetrics>();
  for (const symbol of CRYPTO_SYMBOLS) {
    const metrics = calculateMetrics(symbol);
    if (metrics) {
      result.set(symbol, metrics);
    }
  }
  return result;
}

/**
 * Get current order book for a symbol
 */
export function getOrderBook(symbol: string): OrderBook | null {
  return orderBooks.get(symbol) || null;
}

/**
 * Get recent trades for a symbol
 */
export function getRecentTrades(symbol: string): Trade[] {
  return recentTrades.get(symbol) || [];
}

/**
 * Get 24h ticker for a symbol
 */
export function getTicker(symbol: string): Ticker24h | null {
  return tickers.get(symbol) || null;
}

/**
 * Check if WebSocket is connected
 */
export function isWebSocketConnected(): boolean {
  return isConnected && wsConnection !== null;
}
