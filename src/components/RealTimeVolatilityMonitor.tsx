// ============================================================================
// REAL-TIME VOLATILITY MONITOR
// Live volatility calculations from Binance WebSocket trade data
// Shows realized vol, vol regime, and vol surface approximation
// ============================================================================

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { ChartBarIcon, BoltIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import {
  subscribeToMetrics,
  startBinanceWebSocket,
  getRecentTrades,
  CRYPTO_SYMBOLS,
  type MicrostructureMetrics,
  type Trade
} from '../services/binanceWebSocket';

interface VolatilityData {
  symbol: string;
  realizedVol: number;      // Annualized realized vol from trades
  impliedRegime: 'low' | 'normal' | 'high' | 'extreme';
  volOfVol: number;         // Volatility of volatility
  volHistory: number[];     // Last 20 vol readings
  tradeIntensity: number;
  avgTradeSize: number;
}

// Volatility bar visualization
function VolBar({ vol, maxVol = 200 }: { vol: number; maxVol?: number }) {
  const percentage = Math.min((vol / maxVol) * 100, 100);
  
  const getColor = () => {
    if (vol < 30) return 'bg-green-500';
    if (vol < 60) return 'bg-yellow-500';
    if (vol < 100) return 'bg-orange-500';
    return 'bg-red-500';
  };
  
  return (
    <div className="h-2 w-full bg-gray-800 rounded-full overflow-hidden">
      <motion.div
        className={`h-full ${getColor()}`}
        initial={{ width: 0 }}
        animate={{ width: `${percentage}%` }}
        transition={{ duration: 0.3 }}
      />
    </div>
  );
}

// Mini sparkline for vol history
function VolSparkline({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  
  const width = 80;
  const height = 24;
  
  const points = data.map((val, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  // Color based on trend
  const trend = data.length > 1 ? data[data.length - 1] - data[0] : 0;
  const strokeColor = trend > 0 ? '#f59e0b' : '#22c55e'; // Orange if rising, green if falling
  
  return (
    <svg width={width} height={height} className="overflow-visible">
      <polyline
        fill="none"
        stroke={strokeColor}
        strokeWidth="1.5"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Regime badge - clear labels
function RegimeBadge({ regime }: { regime: VolatilityData['impliedRegime'] }) {
  const config = {
    low: { bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/50', label: 'LOW' },
    normal: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/50', label: 'NORMAL' },
    high: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/50', label: 'HIGH' },
    extreme: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/50', label: 'EXTREME' }
  };
  
  const { bg, text, border, label } = config[regime];
  
  return (
    <span className={`px-1.5 py-0.5 ${bg} ${text} border ${border} rounded text-[9px] font-bold`}>
      {label}
    </span>
  );
}

// Calculate volatility regime
function getVolRegime(vol: number): VolatilityData['impliedRegime'] {
  if (vol < 30) return 'low';
  if (vol < 60) return 'normal';
  if (vol < 100) return 'high';
  return 'extreme';
}

// Single volatility card - Clear and readable
function VolCard({ data }: { data: VolatilityData }) {
  const symbol = data.symbol.replace('USDT', '');
  
  return (
    <div className="bg-gray-800/30 rounded-xl p-3 border border-gray-700/30">
      {/* Header with symbol and regime */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-base font-bold text-white">{symbol}</span>
          <RegimeBadge regime={data.impliedRegime} />
        </div>
      </div>
      
      {/* Volatility value and bar */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-gray-500">Realized Volatility</span>
          <span className={`font-mono font-bold ${
            data.realizedVol > 100 ? 'text-red-400' : data.realizedVol > 60 ? 'text-orange-400' : 'text-green-400'
          }`}>
            {data.realizedVol.toFixed(1)}%
          </span>
        </div>
        <VolBar vol={data.realizedVol} />
      </div>
      
      {/* Sparkline + intensity */}
      <div className="flex items-center justify-between text-[10px]">
        <VolSparkline data={data.volHistory} />
        <div>
          <span className="text-gray-500">Trades: </span>
          <span className="text-cyan-400 font-mono">{data.tradeIntensity.toFixed(1)}/s</span>
        </div>
      </div>
    </div>
  );
}

export default function RealTimeVolatilityMonitor() {
  const { t } = useTranslation();
  const [volData, setVolData] = useState<Map<string, VolatilityData>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  // Per-symbol throttle tracking to ensure all symbols get updated
  const lastUpdateRef = React.useRef<Map<string, number>>(new Map());
  
  useEffect(() => {
    const cleanup = startBinanceWebSocket();
    
    const unsubscribe = subscribeToMetrics(({ symbol, metrics }) => {
      setIsConnected(true);
      
      // Per-symbol throttle - each symbol can update every 300ms independently (faster updates)
      const now = Date.now();
      const lastUpdate = lastUpdateRef.current.get(symbol) || 0;
      if (now - lastUpdate < 300) {
        return;
      }
      lastUpdateRef.current.set(symbol, now);
      
      setVolData(prev => {
        const existing = prev.get(symbol);
        const volHistory = existing?.volHistory || [];
        
        // Add new vol reading to history (keep last 20)
        const newHistory = [...volHistory, metrics.realizedVolatility].slice(-20);
        
        // Calculate vol of vol (std dev of vol readings)
        let volOfVol = 0;
        if (newHistory.length > 2) {
          const mean = newHistory.reduce((a, b) => a + b, 0) / newHistory.length;
          const variance = newHistory.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / newHistory.length;
          volOfVol = Math.sqrt(variance);
        }
        
        const newData: VolatilityData = {
          symbol,
          realizedVol: metrics.realizedVolatility,
          impliedRegime: getVolRegime(metrics.realizedVolatility),
          volOfVol,
          volHistory: newHistory,
          tradeIntensity: metrics.tradeIntensity,
          avgTradeSize: metrics.avgTradeSize * metrics.lastPrice // Convert to USD
        };
        
        const newMap = new Map(prev);
        newMap.set(symbol, newData);
        return newMap;
      });
    });
    
    return () => {
      cleanup();
      unsubscribe();
    };
  }, []);
  
  // Calculate aggregate metrics
  const aggregateMetrics = useMemo(() => {
    const allVols = Array.from(volData.values());
    if (allVols.length === 0) return null;
    
    const avgVol = allVols.reduce((sum, d) => sum + d.realizedVol, 0) / allVols.length;
    const maxVol = Math.max(...allVols.map(d => d.realizedVol));
    const minVol = Math.min(...allVols.map(d => d.realizedVol));
    const extremeCount = allVols.filter(d => d.impliedRegime === 'extreme' || d.impliedRegime === 'high').length;
    
    return { avgVol, maxVol, minVol, extremeCount, totalSymbols: allVols.length };
  }, [volData]);
  
  const sortedVolData = useMemo(() => {
    // Limit to top 6 by volatility for clean display without scrolling
    return Array.from(volData.values()).sort((a, b) => b.realizedVol - a.realizedVol).slice(0, 6);
  }, [volData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl p-3 sm:p-4 border border-gray-700/50 min-h-[350px] sm:min-h-[400px] lg:h-[420px] flex flex-col"
    >
      {/* Header - Responsive */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="p-1 sm:p-1.5 bg-orange-500/20 rounded-lg">
            <BoltIcon className="w-4 h-4 text-orange-400" />
          </div>
          <h3 className="text-xs sm:text-sm font-semibold text-white flex items-center gap-2">
            {t("Volatility Monitor")}
            <span className="text-[8px] sm:text-[9px] px-1 sm:px-1.5 py-0.5 bg-orange-500/20 text-orange-300 rounded-full font-normal">
              LIVE
            </span>
          </h3>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-800/50 rounded">
          <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-[9px] text-gray-500">
            {isConnected ? 'Live' : '...'}
          </span>
        </div>
      </div>
      
      {/* Loading state */}
      {!isConnected && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-gray-400 text-xs">{t("Calculating...")}</p>
          </div>
        </div>
      )}
      
      {isConnected && aggregateMetrics && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Aggregate Stats - Responsive layout */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-gray-800/40 rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 mb-3 gap-2 sm:gap-0">
            <div className="flex items-center gap-3 sm:gap-5 flex-wrap">
              <div className="text-center">
                <div className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5">Avg Vol</div>
                <span className={`text-xs sm:text-sm font-bold font-mono ${
                  aggregateMetrics.avgVol > 80 ? 'text-red-400' : aggregateMetrics.avgVol > 50 ? 'text-orange-400' : 'text-green-400'
                }`}>{aggregateMetrics.avgVol.toFixed(1)}%</span>
              </div>
              <div className="text-center">
                <div className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5">Max Vol</div>
                <span className="text-xs sm:text-sm font-bold font-mono text-red-400">{aggregateMetrics.maxVol.toFixed(1)}%</span>
              </div>
              <div className="text-center">
                <div className="text-[9px] sm:text-[10px] text-gray-500 mb-0.5">Min Vol</div>
                <span className="text-xs sm:text-sm font-bold font-mono text-green-400">{aggregateMetrics.minVol.toFixed(1)}%</span>
              </div>
            </div>
            <div className={`text-[10px] sm:text-xs px-2 py-1 rounded-lg font-medium ${
              aggregateMetrics.avgVol > 80 ? 'bg-red-500/20 text-red-400' : 'bg-green-500/20 text-green-400'
            }`}>
              {aggregateMetrics.avgVol > 80 ? '⚠ HIGH VOL' : '✓ NORMAL'}
            </div>
          </div>
          
          {/* Volatility Cards Grid - responsive columns */}
          <div className="flex-1 overflow-y-auto sm:overflow-visible">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {sortedVolData.map(data => (
                <VolCard key={data.symbol} data={data} />
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* Footer - Compact */}
      <div className="mt-2 pt-2 border-t border-gray-700/30 text-[9px] text-gray-500">
        {t("Realized vol from trade-by-trade returns (annualized)")}
      </div>
    </motion.div>
  );
}
