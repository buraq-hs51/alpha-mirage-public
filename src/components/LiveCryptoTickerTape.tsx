// ============================================================================
// LIVE CRYPTO TICKER TAPE
// Real-time scrolling ticker like Bloomberg/CNBC with Binance WebSocket
// Shows live prices, changes, and sparklines
// Uses CSS animation to prevent flickering on data updates
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  subscribeToMetrics,
  startBinanceWebSocket,
  CRYPTO_SYMBOLS,
  getTicker,
  type MicrostructureMetrics,
  type Ticker24h
} from '../services/binanceWebSocket';

interface TickerData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  high: number;
  low: number;
  volume: number;
  sparkline: number[]; // Last 20 prices for mini chart
}

// Mini sparkline component
function Sparkline({ data, isPositive }: { data: number[]; isPositive: boolean }) {
  if (data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const width = 50;
  const height = 20;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={isPositive ? '#22c55e' : '#ef4444'}
        strokeWidth="1.5"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Single ticker item
function TickerItem({ data }: { data: TickerData }) {
  const isPositive = data.change >= 0;
  const symbol = data.symbol.replace('USDT', '');
  
  const formatPrice = (price: number) => {
    if (price >= 10000) return `$${price.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    if (price >= 100) return `$${price.toFixed(2)}`;
    if (price >= 1) return `$${price.toFixed(3)}`;
    return `$${price.toFixed(4)}`;
  };
  
  const formatVolume = (vol: number) => {
    if (vol >= 1e9) return `$${(vol / 1e9).toFixed(1)}B`;
    if (vol >= 1e6) return `$${(vol / 1e6).toFixed(1)}M`;
    if (vol >= 1e3) return `$${(vol / 1e3).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };
  
  return (
    <div className="inline-flex items-center gap-4 px-6 py-2 border-r border-gray-700/30">
      {/* Symbol */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-bold text-white">{symbol}</span>
        <span className="text-[10px] text-gray-500">/USDT</span>
      </div>
      
      {/* Price */}
      <div className="text-sm font-mono font-medium text-white">
        {formatPrice(data.price)}
      </div>
      
      {/* Change */}
      <div className={`flex items-center gap-1 ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
        <span className="text-sm font-mono">
          {isPositive ? '+' : ''}{data.changePercent.toFixed(2)}%
        </span>
        <span className="text-[10px]">
          {isPositive ? '▲' : '▼'}
        </span>
      </div>
      
      {/* Sparkline */}
      <Sparkline data={data.sparkline} isPositive={isPositive} />
      
      {/* 24h Volume */}
      <div className="text-[10px] text-gray-500">
        Vol: {formatVolume(data.volume)}
      </div>
    </div>
  );
}

export default function LiveCryptoTickerTape() {
  const [tickerData, setTickerData] = useState<Map<string, TickerData>>(new Map());
  const [priceHistory, setPriceHistory] = useState<Map<string, number[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const lastUpdateRef = React.useRef<number>(0);
  
  // Start WebSocket and subscribe to updates
  useEffect(() => {
    const cleanup = startBinanceWebSocket();
    
    const unsubscribe = subscribeToMetrics(({ symbol, metrics }) => {
      setIsConnected(true);
      
      // Throttle updates to prevent flickering - 500ms minimum between updates
      const now = Date.now();
      if (now - lastUpdateRef.current < 500) {
        return;
      }
      lastUpdateRef.current = now;
      
      // Update price history (keep last 20 prices)
      setPriceHistory(prev => {
        const history = prev.get(symbol) || [];
        const updated = [...history, metrics.lastPrice].slice(-20);
        const newMap = new Map(prev);
        newMap.set(symbol, updated);
        return newMap;
      });
      
      // Get ticker data
      const ticker = getTicker(symbol);
      if (ticker) {
        setTickerData(prev => {
          const newMap = new Map(prev);
          const history = priceHistory.get(symbol) || [metrics.lastPrice];
          newMap.set(symbol, {
            symbol: symbol,
            price: metrics.lastPrice,
            change: ticker.priceChange,
            changePercent: ticker.priceChangePercent,
            high: ticker.highPrice,
            low: ticker.lowPrice,
            volume: ticker.quoteVolume,
            sparkline: history
          });
          return newMap;
        });
      }
    });
    
    return () => {
      cleanup();
      unsubscribe();
    };
  }, []);
  
  // Update sparklines when price history changes
  useEffect(() => {
    setTickerData(prev => {
      const newMap = new Map(prev);
      for (const [symbol, data] of prev) {
        const history = priceHistory.get(symbol);
        if (history) {
          newMap.set(symbol, { ...data, sparkline: history });
        }
      }
      return newMap;
    });
  }, [priceHistory]);
  
  // Sort by volume (highest first)
  const sortedTickers = useMemo(() => {
    return Array.from(tickerData.values()).sort((a, b) => b.volume - a.volume);
  }, [tickerData]);
  
  if (!isConnected || sortedTickers.length === 0) {
    return (
      <div className="w-full bg-gray-900/80 border-y border-gray-700/50 py-2 overflow-hidden">
        <div className="flex items-center justify-center gap-2 text-gray-500 text-sm">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span>Connecting to live crypto feed...</span>
        </div>
      </div>
    );
  }
  
  // Duplicate content for seamless scrolling (3x for smooth loop)
  const tickerContent = [...sortedTickers, ...sortedTickers, ...sortedTickers];
  
  // Calculate animation duration based on number of items (faster with more items)
  const animationDuration = Math.max(15, sortedTickers.length * 3);
  
  return (
    <div className="w-full bg-gray-900/80 border-y border-gray-700/50 overflow-hidden">
      {/* CSS animation keyframes */}
      <style>{`
        @keyframes ticker-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-33.333%); }
        }
        .ticker-animate {
          animation: ticker-scroll ${animationDuration}s linear infinite;
        }
        .ticker-animate:hover {
          animation-play-state: paused;
        }
      `}</style>
      
      <div className="relative">
        {/* Live indicator */}
        <div className="absolute left-0 top-0 bottom-0 z-10 flex items-center px-3 bg-gradient-to-r from-gray-900 via-gray-900 to-transparent">
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-red-500/20 border border-red-500/50 rounded text-[10px] text-red-400 font-medium">
            <div className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </div>
        </div>
        
        {/* Scrolling ticker - CSS animation prevents flickering on data updates */}
        <div className="flex whitespace-nowrap py-2 pl-20 ticker-animate">
          {tickerContent.map((data, i) => (
            <TickerItem key={`${data.symbol}-${i}`} data={data} />
          ))}
        </div>
        
        {/* Right fade */}
        <div className="absolute right-0 top-0 bottom-0 w-20 bg-gradient-to-l from-gray-900 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}
