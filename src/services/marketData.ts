// ============================================
// LIVE MARKET DATA SERVICE - FINNHUB ONLY
// Centralized caching to prevent API rate limit issues
// Finnhub limit: 60 API calls/min
// ============================================

const FINNHUB_API_KEY = 'd57urc1r01qptoap74k0d57urc1r01qptoap74kg';
const FINNHUB_BASE_URL = 'https://finnhub.io/api/v1';

export interface MarketQuote {
  symbol: string;
  price: number;
  change: number; // percentage change
  prevClose: number;
  high: number;
  low: number;
  isLive: boolean;
}

// ALL symbols needed across the entire app - fetched once, shared everywhere
const ALL_SYMBOLS = [
  // ETFs & Indices (needed by Greeks, ML Trading, Portfolio)
  'SPY', 'QQQ', 'DIA', 'IWM',
  // Big Tech (needed by Stock Ticker, ML Trading, Portfolio)
  'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META',
  // Financials (Stock Ticker)
  'JPM', 'GS', 'BAC',
  // Other (Stock Ticker)
  'AMD', 'INTC', 'NFLX',
  // Singapore & Asia (Market Overview, ML Alpha)
  'EWS',   // iShares MSCI Singapore ETF
  'EWH',   // iShares MSCI Hong Kong ETF
];

// ============================================
// GLOBAL CACHE - Shared across all widgets
// ============================================
interface CachedQuote extends MarketQuote {
  timestamp: number;
}

const globalCache: Map<string, CachedQuote> = new Map();
let lastGlobalFetch = 0;
let isFetching = false;
let fetchPromise: Promise<void> | null = null;
const CACHE_TTL = 180000; // 3 minutes cache validity
const MIN_FETCH_INTERVAL = 180000; // 3 minutes between fetches (safe: ~18 calls / 3 min = 6/min)

// ============================================
// FINNHUB API - Stock Quotes
// ============================================
interface FinnhubQuote {
  c: number;  // Current price
  d: number;  // Change
  dp: number; // Percent change
  h: number;  // High
  l: number;  // Low
  o: number;  // Open
  pc: number; // Previous close
  t: number;  // Timestamp
}

async function fetchSingleQuote(symbol: string): Promise<MarketQuote | null> {
  try {
    const response = await fetch(
      `${FINNHUB_BASE_URL}/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`
    );
    
    if (!response.ok) {
      if (response.status === 429) {
        console.warn(`⚠️ Rate limited on ${symbol}`);
      }
      return null;
    }
    
    const data: FinnhubQuote = await response.json();
    
    if (!data.c || data.c === 0) {
      return null;
    }
    
    return {
      symbol,
      price: data.c,
      change: data.dp || 0,
      prevClose: data.pc || data.c,
      high: data.h || data.c,
      low: data.l || data.c,
      isLive: true,
    };
  } catch (error) {
    console.warn(`Failed to fetch ${symbol}:`, error);
    return null;
  }
}

// ============================================
// MAIN FETCH - Fetches ALL symbols once
// All widgets use getQuote() to read from cache
// ============================================
async function refreshGlobalCache(): Promise<void> {
  // If already fetching, wait for that fetch to complete
  if (isFetching && fetchPromise) {
    return fetchPromise;
  }
  
  const now = Date.now();
  if (now - lastGlobalFetch < MIN_FETCH_INTERVAL && globalCache.size > 0) {
    console.log('📈 Using cached quote data');
    return; // Use cache
  }
  
  isFetching = true;
  console.log('📈 Fetching market data for all widgets...');
  
  fetchPromise = (async () => {
    try {
      // Fetch all symbols in parallel
      const results = await Promise.all(
        ALL_SYMBOLS.map(symbol => fetchSingleQuote(symbol))
      );
      
      // Update cache
      const fetchTime = Date.now();
      results.forEach(quote => {
        if (quote) {
          globalCache.set(quote.symbol, { ...quote, timestamp: fetchTime });
        }
      });
      
      lastGlobalFetch = fetchTime;
      console.log(`✅ Cached ${globalCache.size} quotes (next refresh in 3 min)`);
    } catch (error) {
      console.warn('Cache refresh failed:', error);
    } finally {
      isFetching = false;
      fetchPromise = null;
    }
  })();
  
  return fetchPromise;
}

// ============================================
// PUBLIC API - Used by all widgets
// ============================================

// Get a single quote from cache (instant, no API call)
export function getQuote(symbol: string): MarketQuote | null {
  const cached = globalCache.get(symbol);
  if (cached) {
    return cached;
  }
  return null;
}

// Get multiple quotes from cache
export function getQuotes(symbols: string[]): MarketQuote[] {
  return symbols
    .map(s => getQuote(s))
    .filter((q): q is MarketQuote => q !== null);
}

// Get all cached quotes
export function getAllQuotes(): MarketQuote[] {
  return Array.from(globalCache.values());
}

// Check if cache has data
export function hasCachedData(): boolean {
  return globalCache.size > 0;
}

// Check if candle cache has data
export function hasCandleData(): boolean {
  return candleCache.size > 0;
}

// ============================================
// HISTORICAL CANDLES - For Alpha Signals
// Fetches 30-day daily candles for technical analysis
// Cached for 1 hour (historical data doesn't change frequently)
// ============================================
export interface CandleData {
  closes: number[];
  highs: number[];
  lows: number[];
  volumes: number[];
  timestamp: number;
}

const candleCache: Map<string, CandleData> = new Map();
const CANDLE_CACHE_TTL = 3600000; // 1 hour cache for historical data
let isFetchingCandles = false;
let candleFetchPromise: Promise<void> | null = null;
let lastCandleFetch = 0;

// Fetch a single symbol's candles (internal use only)
// NOTE: Finnhub free tier doesn't have candle access, so we generate
// synthetic historical data based on the current quote for demo purposes
async function fetchSingleCandle(symbol: string): Promise<CandleData | null> {
  try {
    // Get current quote from cache first
    const quote = globalCache.get(symbol);
    if (!quote) {
      console.warn(`No quote data for ${symbol} to generate candles`);
      return null;
    }
    
    // Generate 30 days of synthetic historical data
    // This uses realistic volatility based on the stock type
    const currentPrice = quote.price;
    const dailyChange = Math.abs(quote.change) / 100; // Convert to decimal
    
    // Estimate daily volatility (annualized vol / sqrt(252))
    // Use the current day's change as a proxy, with some smoothing
    const estimatedDailyVol = Math.max(0.01, Math.min(0.05, dailyChange * 0.5 + 0.015));
    
    const closes: number[] = [];
    const highs: number[] = [];
    const lows: number[] = [];
    const volumes: number[] = [];
    
    // Work backwards from current price
    let price = currentPrice;
    
    // Generate 30 days of data (most recent first, then reverse)
    for (let i = 0; i < 30; i++) {
      // Random walk with mean reversion tendency
      const randomReturn = (Math.random() - 0.5) * 2 * estimatedDailyVol;
      const dailyRange = price * estimatedDailyVol * (0.5 + Math.random());
      
      closes.unshift(price);
      highs.unshift(price + dailyRange * 0.6);
      lows.unshift(price - dailyRange * 0.4);
      volumes.unshift(Math.floor(10000000 + Math.random() * 50000000));
      
      // Move price back in time
      price = price / (1 + randomReturn);
    }
    
    return {
      closes,
      highs,
      lows,
      volumes,
      timestamp: Date.now(),
    };
  } catch (error) {
    console.warn(`Error generating candles for ${symbol}:`, error);
    return null;
  }
}

// BATCH fetch all candles at once (call once at startup)
// NOTE: Must be called AFTER fetchAllMarketData() since we need quotes first
export async function fetchAllCandles(): Promise<void> {
  // If already fetching, wait for that fetch to complete
  if (isFetchingCandles && candleFetchPromise) {
    return candleFetchPromise;
  }
  
  const now = Date.now();
  // Only refetch if cache is empty or expired
  if (candleCache.size > 0 && now - lastCandleFetch < CANDLE_CACHE_TTL) {
    console.log('📊 Using cached candle data');
    return;
  }
  
  // Wait for quote cache to be populated first
  if (globalCache.size === 0) {
    console.log('📊 Waiting for quote data before generating candles...');
    await refreshGlobalCache();
  }
  
  isFetchingCandles = true;
  console.log('📊 Generating historical candle data from quotes...');
  
  candleFetchPromise = (async () => {
    try {
      // Generate candles for key symbols
      const candleSymbols = ['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'JPM', 'AMD', 'NFLX'];
      
      for (const symbol of candleSymbols) {
        const candle = await fetchSingleCandle(symbol);
        if (candle) {
          candleCache.set(symbol, candle);
        }
      }
      
      lastCandleFetch = Date.now();
      console.log(`✅ Generated candles for ${candleCache.size} symbols`);
    } catch (error) {
      console.warn('Candle generation failed:', error);
    } finally {
      isFetchingCandles = false;
      candleFetchPromise = null;
    }
  })();
  
  return candleFetchPromise;
}

// Get candles from cache ONLY (synchronous, no API call)
export function getHistoricalCandles(symbol: string): CandleData | null {
  return candleCache.get(symbol) || null;
}

// Legacy async version - now just returns from cache
export async function getHistoricalCandlesAsync(symbol: string): Promise<CandleData | null> {
  // Check cache first
  const cached = candleCache.get(symbol);
  if (cached && Date.now() - cached.timestamp < CANDLE_CACHE_TTL) {
    return cached;
  }

  try {
    // Get 30 days of daily candles
    const to = Math.floor(Date.now() / 1000);
    const from = to - (30 * 24 * 60 * 60); // 30 days ago
    
    const response = await fetch(
      `${FINNHUB_BASE_URL}/stock/candle?symbol=${symbol}&resolution=D&from=${from}&to=${to}&token=${FINNHUB_API_KEY}`
    );
    
    if (!response.ok) {
      console.warn(`Failed to fetch candles for ${symbol}: ${response.status}`);
      return null;
    }
    
    const data = await response.json();
    
    if (data.s !== 'ok' || !data.c || data.c.length === 0) {
      console.warn(`No candle data for ${symbol}`);
      return null;
    }
    
    const candleData: CandleData = {
      closes: data.c,
      highs: data.h,
      lows: data.l,
      volumes: data.v,
      timestamp: Date.now(),
    };
    
    candleCache.set(symbol, candleData);
    return candleData;
  } catch (error) {
    console.warn(`Error fetching candles for ${symbol}:`, error);
    return null;
  }
}

// Force refresh (used on initial page load)
export async function fetchAllMarketData(): Promise<MarketQuote[]> {
  await refreshGlobalCache();
  return getAllQuotes();
}

// Start auto-refresh (call once on app mount)
let refreshInterval: NodeJS.Timeout | null = null;
export function startAutoRefresh(): () => void {
  // Initial fetch
  refreshGlobalCache();
  
  // Refresh every 3 minutes
  if (!refreshInterval) {
    refreshInterval = setInterval(refreshGlobalCache, MIN_FETCH_INTERVAL);
  }
  
  // Return cleanup function
  return () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  };
}
