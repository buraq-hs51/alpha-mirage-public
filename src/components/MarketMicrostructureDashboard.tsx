// ============================================================================
// MARKET MICROSTRUCTURE DASHBOARD
// Real-time crypto market microstructure analysis using Binance WebSocket
// ALL DATA IS REAL - No synthetic or dummy values
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BoltIcon,
  ScaleIcon,
  CurrencyDollarIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import {
  startBinanceWebSocket,
  subscribeToMetrics,
  getOrderBook,
  getRecentTrades,
  CRYPTO_SYMBOLS,
  type MicrostructureMetrics,
  type OrderBook,
  type Trade
} from '../services/binanceWebSocket';

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

// Order Book Visualization (DOM - Depth of Market)
interface OrderBookVizProps {
  orderBook: OrderBook | null;
  metrics: MicrostructureMetrics | null;
}

function OrderBookVisualization({ orderBook, metrics }: OrderBookVizProps) {
  const { t } = useTranslation();
  
  if (!orderBook || orderBook.bids.length === 0 || orderBook.asks.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-gray-500 text-sm">
        {t("Waiting for order book data...")}
      </div>
    );
  }
  
  const maxQty = Math.max(
    ...orderBook.bids.slice(0, 10).map(l => l.quantity),
    ...orderBook.asks.slice(0, 10).map(l => l.quantity)
  );
  
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-3 text-[10px] text-gray-500 font-mono mb-1">
        <span>{t("Price")}</span>
        <span className="text-center">{t("Size")}</span>
        <span className="text-right">{t("Depth")}</span>
      </div>
      
      {/* Asks (sells) - reversed so lowest ask is at bottom */}
      <div className="space-y-0.5">
        {orderBook.asks.slice(0, 8).reverse().map((level, i) => (
          <div key={`ask-${i}`} className="relative grid grid-cols-3 text-[11px] font-mono h-5 items-center">
            {/* Background bar */}
            <div 
              className="absolute right-0 top-0 bottom-0 bg-red-500/10"
              style={{ width: `${(level.quantity / maxQty) * 100}%` }}
            />
            <span className="relative text-red-400">${level.price.toFixed(2)}</span>
            <span className="relative text-center text-gray-400">{level.quantity.toFixed(4)}</span>
            <span className="relative text-right text-gray-500">
              {((level.quantity / maxQty) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
      
      {/* Spread indicator */}
      <div className="py-2 text-center border-y border-gray-700/50">
        <span className="text-[10px] text-gray-500">{t("Spread")}: </span>
        <span className="text-[11px] font-mono text-cyan-400">
          ${metrics?.bidAskSpread.toFixed(2)} ({metrics?.spreadBps.toFixed(1)} bps)
        </span>
      </div>
      
      {/* Bids (buys) */}
      <div className="space-y-0.5">
        {orderBook.bids.slice(0, 8).map((level, i) => (
          <div key={`bid-${i}`} className="relative grid grid-cols-3 text-[11px] font-mono h-5 items-center">
            {/* Background bar */}
            <div 
              className="absolute left-0 top-0 bottom-0 bg-green-500/10"
              style={{ width: `${(level.quantity / maxQty) * 100}%` }}
            />
            <span className="relative text-green-400">${level.price.toFixed(2)}</span>
            <span className="relative text-center text-gray-400">{level.quantity.toFixed(4)}</span>
            <span className="relative text-right text-gray-500">
              {((level.quantity / maxQty) * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Trade Flow Tape (Time & Sales)
interface TradeFlowProps {
  trades: Trade[];
}

function TradeFlowTape({ trades }: TradeFlowProps) {
  const { t } = useTranslation();
  
  if (trades.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-gray-500 text-sm">
        {t("Waiting for trades...")}
      </div>
    );
  }
  
  // Show last 20 trades with scroll for more data visibility
  const recentTrades = trades.slice(-20).reverse();
  
  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="grid grid-cols-4 text-[10px] text-gray-500 font-mono mb-1">
        <span>{t("Time")}</span>
        <span>{t("Side")}</span>
        <span className="text-right">{t("Price")}</span>
        <span className="text-right">{t("Size")}</span>
      </div>
      
      {/* Trade entries - scrollable for lots of data */}
      <div className="space-y-0.5 max-h-56 overflow-y-auto">
        {recentTrades.map((trade) => {
          const time = new Date(trade.time);
          const isBuy = !trade.isBuyerMaker;
          
          return (
            <motion.div 
              key={trade.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="grid grid-cols-4 text-[11px] font-mono"
            >
              <span className="text-gray-500">
                {time.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
              <span className={isBuy ? 'text-green-400' : 'text-red-400'}>
                {isBuy ? 'BUY' : 'SELL'}
              </span>
              <span className="text-right text-gray-300">
                ${trade.price.toFixed(2)}
              </span>
              <span className={`text-right ${isBuy ? 'text-green-400/70' : 'text-red-400/70'}`}>
                {trade.quantity.toFixed(4)}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

// Imbalance Gauge
interface ImbalanceGaugeProps {
  imbalance: number; // -1 to 1
  label: string;
}

function ImbalanceGauge({ imbalance, label }: ImbalanceGaugeProps) {
  // Clamp between -1 and 1
  const value = Math.max(-1, Math.min(1, imbalance));
  // Convert to 0-100 scale where 50 is neutral
  const position = (value + 1) * 50;
  
  const color = value > 0.2 ? 'text-green-400' : value < -0.2 ? 'text-red-400' : 'text-gray-400';
  const bgColor = value > 0.2 ? 'from-green-500/30' : value < -0.2 ? 'from-red-500/30' : 'from-gray-500/30';
  
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[10px]">
        <span className="text-gray-500">{label}</span>
        <span className={`font-mono ${color}`}>
          {value > 0 ? '+' : ''}{(value * 100).toFixed(1)}%
        </span>
      </div>
      <div className="relative h-2 bg-gray-800 rounded-full overflow-hidden">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />
        {/* Fill */}
        <div 
          className={`absolute top-0 bottom-0 bg-gradient-to-r ${bgColor} to-transparent transition-all duration-300`}
          style={{
            left: value >= 0 ? '50%' : `${position}%`,
            right: value >= 0 ? `${100 - position}%` : '50%',
          }}
        />
        {/* Indicator */}
        <div 
          className={`absolute top-0 bottom-0 w-1 ${value > 0.2 ? 'bg-green-400' : value < -0.2 ? 'bg-red-400' : 'bg-gray-400'} rounded transition-all duration-300`}
          style={{ left: `calc(${position}% - 2px)` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-gray-600">
        <span>Sellers</span>
        <span>Buyers</span>
      </div>
    </div>
  );
}

// Metric Card
interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}

function MetricCard({ icon, label, value, subValue, trend, color = 'text-cyan-400' }: MetricCardProps) {
  return (
    <div className="bg-gray-800/30 rounded-lg p-3 border border-gray-700/30">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-gray-500">{icon}</span>
        <span className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-lg font-mono ${color}`}>{value}</span>
        {trend && (
          <span className={trend === 'up' ? 'text-green-400' : trend === 'down' ? 'text-red-400' : 'text-gray-400'}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
          </span>
        )}
      </div>
      {subValue && <span className="text-[10px] text-gray-500">{subValue}</span>}
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MarketMicrostructureDashboard() {
  const { t } = useTranslation();
  const [selectedSymbol, setSelectedSymbol] = useState<string>(CRYPTO_SYMBOLS[0]);
  const [metrics, setMetrics] = useState<Map<string, MicrostructureMetrics>>(new Map());
  const [orderBook, setOrderBook] = useState<OrderBook | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const lastMetricUpdateRef = React.useRef<number>(0);
  
  // Start WebSocket connection
  useEffect(() => {
    const cleanup = startBinanceWebSocket();
    
    // Subscribe to metric updates - throttled to 300ms for faster updates
    const unsubscribe = subscribeToMetrics(({ symbol, metrics: newMetrics }) => {
      const now = Date.now();
      
      // Throttle updates to every 300ms for snappier UI
      if (now - lastMetricUpdateRef.current < 300) {
        // Still set connected status even if throttled
        setIsConnected(true);
        return;
      }
      lastMetricUpdateRef.current = now;
      
      setMetrics(prev => {
        const updated = new Map(prev);
        updated.set(symbol, newMetrics);
        return updated;
      });
      setIsConnected(true);
      setLastUpdate(Date.now());
    });
    
    // Poll for order book and trades updates - 300ms for faster, snappier updates
    const pollInterval = setInterval(() => {
      const ob = getOrderBook(selectedSymbol);
      const tr = getRecentTrades(selectedSymbol);
      setOrderBook(ob);
      setTrades(tr);
    }, 300); // 300ms polling for faster updates
    
    return () => {
      cleanup();
      unsubscribe();
      clearInterval(pollInterval);
    };
  }, [selectedSymbol]);
  
  const currentMetrics = metrics.get(selectedSymbol);
  
  // Calculate aggregate metrics
  const aggregateMetrics = useMemo(() => {
    const allMetrics = Array.from(metrics.values());
    if (allMetrics.length === 0) return null;
    
    const avgSpread = allMetrics.reduce((sum, m) => sum + m.spreadBps, 0) / allMetrics.length;
    const avgImbalance = allMetrics.reduce((sum, m) => sum + m.orderBookImbalance, 0) / allMetrics.length;
    const totalBuyVol = allMetrics.reduce((sum, m) => sum + m.buyVolume, 0);
    const totalSellVol = allMetrics.reduce((sum, m) => sum + m.sellVolume, 0);
    const avgTradeIntensity = allMetrics.reduce((sum, m) => sum + m.tradeIntensity, 0) / allMetrics.length;
    
    return {
      avgSpread,
      avgImbalance,
      totalBuyVol,
      totalSellVol,
      netFlow: totalBuyVol - totalSellVol,
      avgTradeIntensity
    };
  }, [metrics]);
  
  // Format helpers
  const formatPrice = (price: number) => {
    if (price >= 10000) return `$${(price / 1000).toFixed(1)}K`;
    if (price >= 100) return `$${price.toFixed(0)}`;
    return `$${price.toFixed(2)}`;
  };
  
  const formatVolume = (vol: number) => {
    if (vol >= 1000000) return `${(vol / 1000000).toFixed(2)}M`;
    if (vol >= 1000) return `${(vol / 1000).toFixed(2)}K`;
    return vol.toFixed(4);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl p-3 sm:p-5 border border-gray-700/50 min-h-[500px] sm:min-h-[600px] lg:h-[680px] flex flex-col"
    >
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-3 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
            <ChartBarIcon className="w-4 h-4 sm:w-5 sm:h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm sm:text-lg font-semibold text-white flex items-center gap-2">
              {t("Market Microstructure")}
              <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 bg-purple-500/20 text-purple-300 rounded-full font-normal">
                LIVE
              </span>
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">
              {t("Real-time order book & trade flow from Binance")}
            </p>
          </div>
        </div>
        
        {/* Symbol Selector - Responsive */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 w-full sm:w-auto">
          <div className="flex flex-wrap gap-1">
            {CRYPTO_SYMBOLS.slice(0, 6).map((symbol) => (
              <button
                key={symbol}
                onClick={() => setSelectedSymbol(symbol)}
                className={`px-1.5 sm:px-2 py-0.5 sm:py-1 text-[9px] sm:text-[10px] font-mono rounded transition-all ${
                  selectedSymbol === symbol
                    ? 'bg-purple-500/30 text-purple-300 border border-purple-500/50'
                    : 'bg-gray-800/50 text-gray-500 hover:text-gray-300 border border-transparent'
                }`}
              >
                {symbol.replace('USDT', '')}
              </button>
            ))}
          </div>
          
          {/* Connection status */}
          <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
            <span className="text-[9px] sm:text-[10px] text-gray-500">
              {isConnected ? 'Connected' : 'Connecting...'}
            </span>
          </div>
        </div>
      </div>
      
      {/* Loading state - centered in flex container */}
      {!currentMetrics && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-purple-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{t("Connecting to Binance...")}</p>
            <p className="text-[10px] text-gray-500 mt-1">{t("Trying WebSocket, will fallback to REST API if needed")}</p>
            <p className="text-[10px] text-gray-600 mt-2">{t("Please wait up to 10 seconds...")}</p>
          </div>
        </div>
      )}
      
      {/* Main content - responsive layout with scroll on mobile */}
      {currentMetrics && (
        <div className="flex-1 min-h-0 overflow-y-auto sm:overflow-visible">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {/* Left Column: Order Book */}
          <div className="bg-gray-800/20 rounded-xl p-3 sm:p-4 border border-gray-700/30">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
              <h4 className="text-xs sm:text-sm font-medium text-gray-300 flex items-center gap-2">
                <ScaleIcon className="w-3 h-3 sm:w-4 sm:h-4 text-gray-500" />
                {t("Order Book")}
              </h4>
              <span className="text-[9px] sm:text-[10px] text-gray-500 font-mono">
                {selectedSymbol}
              </span>
            </div>
            <OrderBookVisualization orderBook={orderBook} metrics={currentMetrics} />
          </div>
          
          {/* Center Column: Metrics */}
          <div className="space-y-4">
            {/* Price & VWAP */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                icon={<CurrencyDollarIcon className="w-4 h-4" />}
                label={t("Mid Price")}
                value={formatPrice(currentMetrics.midPrice)}
                color="text-white"
              />
              <MetricCard
                icon={<ArrowTrendingUpIcon className="w-4 h-4" />}
                label="VWAP"
                value={formatPrice(currentMetrics.vwap)}
                subValue={`Δ ${((currentMetrics.midPrice - currentMetrics.vwap) / currentMetrics.vwap * 100).toFixed(3)}%`}
                color="text-amber-400"
              />
            </div>
            
            {/* Spread & Trade Intensity */}
            <div className="grid grid-cols-2 gap-3">
              <MetricCard
                icon={<ScaleIcon className="w-4 h-4" />}
                label={t("Spread")}
                value={`${currentMetrics.spreadBps.toFixed(1)} bps`}
                subValue={formatPrice(currentMetrics.bidAskSpread)}
                color={currentMetrics.spreadBps < 5 ? 'text-green-400' : currentMetrics.spreadBps < 15 ? 'text-yellow-400' : 'text-red-400'}
              />
              <MetricCard
                icon={<BoltIcon className="w-4 h-4" />}
                label={t("Trade Intensity")}
                value={`${currentMetrics.tradeIntensity.toFixed(1)}/s`}
                subValue={`Avg: ${formatVolume(currentMetrics.avgTradeSize)}`}
                color="text-cyan-400"
              />
            </div>
            
            {/* Order Book Imbalance */}
            <div className="bg-gray-800/20 rounded-xl p-4 border border-gray-700/30">
              <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                {t("Order Book Imbalance")}
              </h4>
              <ImbalanceGauge 
                imbalance={currentMetrics.orderBookImbalance} 
                label={t("Bid/Ask Volume")}
              />
              <div className="grid grid-cols-2 gap-4 mt-3 text-[11px]">
                <div>
                  <span className="text-gray-500">{t("Bid Depth")}: </span>
                  <span className="text-green-400 font-mono">{formatVolume(currentMetrics.bidDepth)}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">{t("Ask Depth")}: </span>
                  <span className="text-red-400 font-mono">{formatVolume(currentMetrics.askDepth)}</span>
                </div>
              </div>
            </div>
            
            {/* Net Order Flow */}
            <div className="bg-gray-800/20 rounded-xl p-4 border border-gray-700/30">
              <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                {t("Trade Flow (Last 100)")}
              </h4>
              <ImbalanceGauge 
                imbalance={currentMetrics.buyVolume + currentMetrics.sellVolume > 0 
                  ? (currentMetrics.buyVolume - currentMetrics.sellVolume) / (currentMetrics.buyVolume + currentMetrics.sellVolume)
                  : 0
                } 
                label={t("Buy/Sell Volume")}
              />
              <div className="grid grid-cols-2 gap-4 mt-3 text-[11px]">
                <div>
                  <span className="text-gray-500">{t("Buy Vol")}: </span>
                  <span className="text-green-400 font-mono">{formatVolume(currentMetrics.buyVolume)}</span>
                </div>
                <div className="text-right">
                  <span className="text-gray-500">{t("Sell Vol")}: </span>
                  <span className="text-red-400 font-mono">{formatVolume(currentMetrics.sellVolume)}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right Column: Trade Tape */}
          <div className="bg-gray-800/20 rounded-xl p-4 border border-gray-700/30">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                <ClockIcon className="w-4 h-4 text-gray-500" />
                {t("Time & Sales")}
              </h4>
              <span className="text-[10px] text-gray-500">
                {trades.length} {t("trades")}
              </span>
            </div>
            <TradeFlowTape trades={trades} />
            
            {/* Volatility indicator */}
            {currentMetrics.realizedVolatility > 0 && (
              <div className="mt-4 pt-3 border-t border-gray-700/30">
                <div className="flex justify-between text-[11px]">
                  <span className="text-gray-500">{t("Realized Vol (ann.)")}</span>
                  <span className={`font-mono ${
                    currentMetrics.realizedVolatility > 100 ? 'text-red-400' : 
                    currentMetrics.realizedVolatility > 50 ? 'text-yellow-400' : 
                    'text-green-400'
                  }`}>
                    {currentMetrics.realizedVolatility.toFixed(1)}%
                  </span>
                </div>
              </div>
            )}
          </div>
          </div>
        </div>
      )}
      
      {/* Footer */}
      <div className="mt-auto pt-3 border-t border-gray-700/30 flex items-center justify-between text-[10px] text-gray-500 flex-shrink-0">
        <span>
          {t("Data source")}: Binance WebSocket (wss://stream.binance.com) • {t("No API key required")}
        </span>
        <span className="font-mono">
          {lastUpdate > 0 ? `Last update: ${new Date(lastUpdate).toLocaleTimeString()}` : ''}
        </span>
      </div>
    </motion.div>
  );
}
