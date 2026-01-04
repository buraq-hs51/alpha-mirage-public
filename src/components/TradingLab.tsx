import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeftIcon, 
  ChartBarIcon, 
  CubeIcon,
  ArrowTrendingUpIcon,
  PlayIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import { 
  getHistoricalCandles, 
  getAllQuotes, 
  fetchAllMarketData,
  fetchAllCandles,
  type MarketQuote,
  type CandleData
} from '../services/marketData';
import { SystemHealthMonitor } from './SystemHealthMonitor';
import { TerminalEasterEgg } from './TerminalEasterEgg';
import { FeatureDiscoveryHints, ShortcutIndicator } from './FeatureDiscoveryHints';
import MarketMicrostructureDashboard from './MarketMicrostructureDashboard';
import LiveCryptoTickerTape from './LiveCryptoTickerTape';
import RealTimeVolatilityMonitor from './RealTimeVolatilityMonitor';
import TradeSignalDashboard from './TradeSignalDashboard';
import { ScrollToTop } from './ScrollToTop';
import AlgorithmBacktestLab from './AlgorithmBacktestLab';
import { startBinanceWebSocket } from '../services/binanceWebSocket';

// ============================================================================
// PRELOAD BINANCE DATA - Start connection immediately when this module loads
// This ensures data is fetched before components mount
// ============================================================================
let binanceCleanup: (() => void) | null = null;

// Start Binance connection immediately on module load (not waiting for component mount)
if (typeof window !== 'undefined') {
  binanceCleanup = startBinanceWebSocket();
  console.log('⚡ Binance preload started on module import');
}

// ============================================================================
// UTILITY FUNCTIONS - Calculate metrics from cached data
// ============================================================================

/**
 * Calculate daily log returns from price series
 */
function calculateReturns(closes: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < closes.length; i++) {
    if (closes[i - 1] > 0 && closes[i] > 0) {
      returns.push(Math.log(closes[i] / closes[i - 1]));
    }
  }
  return returns;
}

/**
 * Calculate mean of an array
 */
function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * Calculate standard deviation (sample)
 */
function stdDev(arr: number[]): number {
  if (arr.length < 2) return 0;
  const avg = mean(arr);
  const squaredDiffs = arr.map(x => Math.pow(x - avg, 2));
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (arr.length - 1));
}

/**
 * Calculate Pearson correlation between two arrays
 */
function correlation(x: number[], y: number[]): number {
  const n = Math.min(x.length, y.length);
  if (n < 2) return 0;
  
  const xSlice = x.slice(0, n);
  const ySlice = y.slice(0, n);
  
  const xMean = mean(xSlice);
  const yMean = mean(ySlice);
  
  let numerator = 0;
  let xSumSq = 0;
  let ySumSq = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = xSlice[i] - xMean;
    const yDiff = ySlice[i] - yMean;
    numerator += xDiff * yDiff;
    xSumSq += xDiff * xDiff;
    ySumSq += yDiff * yDiff;
  }
  
  const denominator = Math.sqrt(xSumSq * ySumSq);
  if (denominator === 0) return 0;
  
  return numerator / denominator;
}

/**
 * Calculate annualized volatility from daily returns
 */
function annualizedVolatility(dailyReturns: number[]): number {
  return stdDev(dailyReturns) * Math.sqrt(252);
}

// ============================================================================
// LIVE CORRELATION HEATMAP WIDGET
// Uses cached candle data - NO API calls
// ============================================================================

interface CorrelationHeatmapProps {
  candleData: Map<string, CandleData>;
}

function LiveCorrelationHeatmap({ candleData }: CorrelationHeatmapProps) {
  const { t } = useTranslation();
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA']);
  
  const allSymbols = ['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'JPM', 'AMD', 'NFLX'];

  // Calculate correlation matrix from cached data (synchronous)
  const correlationData = useMemo(() => {
    const returnsMap: { [symbol: string]: number[] } = {};
    
    // Get returns from cached candle data
    for (const symbol of selectedSymbols) {
      const candles = candleData.get(symbol);
      if (candles && candles.closes.length > 1) {
        returnsMap[symbol] = calculateReturns(candles.closes);
      }
    }
    
    // Build correlation matrix
    const validSymbols = selectedSymbols.filter(s => returnsMap[s] && returnsMap[s].length > 5);
    const n = validSymbols.length;
    
    if (n === 0) return null;
    
    const matrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          matrix[i][j] = 1;
        } else {
          matrix[i][j] = correlation(returnsMap[validSymbols[i]], returnsMap[validSymbols[j]]);
        }
      }
    }
    
    return { symbols: validSymbols, matrix };
  }, [selectedSymbols, candleData]);

  const getCorrelationColor = (corr: number): string => {
    // Blue for negative, white for zero, red for positive
    if (corr >= 0) {
      const intensity = Math.min(255, Math.round(corr * 255));
      return `rgb(${intensity}, ${Math.round(intensity * 0.3)}, ${Math.round(intensity * 0.3)})`;
    } else {
      const intensity = Math.min(255, Math.round(Math.abs(corr) * 255));
      return `rgb(${Math.round(intensity * 0.3)}, ${Math.round(intensity * 0.3)}, ${intensity})`;
    }
  };

  const toggleSymbol = (symbol: string) => {
    if (selectedSymbols.includes(symbol)) {
      if (selectedSymbols.length > 2) {
        setSelectedSymbols(selectedSymbols.filter(s => s !== symbol));
      }
    } else if (selectedSymbols.length < 8) {
      setSelectedSymbols([...selectedSymbols, symbol]);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-cyan-500/30"
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 bg-cyan-500/20 rounded-lg">
          <ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-base sm:text-xl font-bold text-white">{t("Live Correlation Matrix")}</h3>
          <p className="text-[10px] sm:text-xs text-gray-400">{t("Calculated from 30-day returns via Finnhub API")}</p>
        </div>
      </div>

      {/* Symbol selector */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">{t("Select assets (2-8)")}:</p>
        <div className="flex flex-wrap gap-1">
          {allSymbols.map(symbol => (
            <button
              key={symbol}
              onClick={() => toggleSymbol(symbol)}
              className={`px-2 py-1 text-xs rounded transition-all ${
                selectedSymbols.includes(symbol)
                  ? 'bg-cyan-500/30 text-cyan-300 border border-cyan-500/50'
                  : 'bg-gray-800/50 text-gray-500 border border-gray-700/50 hover:border-gray-600'
              }`}
            >
              {symbol}
            </button>
          ))}
        </div>
      </div>

      {!correlationData ? (
        <div className="text-gray-400 text-center py-8">{t("No data available")}</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="p-1"></th>
                {correlationData.symbols.map(symbol => (
                  <th key={symbol} className="p-1 text-cyan-300 font-medium">{symbol}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {correlationData.symbols.map((rowSymbol, i) => (
                <tr key={rowSymbol}>
                  <td className="p-1 text-cyan-300 font-medium">{rowSymbol}</td>
                  {correlationData.matrix[i].map((corr, j) => (
                    <td
                      key={j}
                      className="p-1 text-center text-white font-mono"
                      style={{
                        backgroundColor: getCorrelationColor(corr),
                        minWidth: '45px'
                      }}
                      title={`${rowSymbol} vs ${correlationData.symbols[j]}: ${corr.toFixed(3)}`}
                    >
                      {corr.toFixed(2)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="mt-4 flex items-center justify-center gap-4 text-xs">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(0, 0, 255)' }}></div>
              <span className="text-gray-400">-1.0</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-gray-600"></div>
              <span className="text-gray-400">0.0</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded" style={{ backgroundColor: 'rgb(255, 76, 76)' }}></div>
              <span className="text-gray-400">+1.0</span>
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

// ============================================================================
// LIVE VOLATILITY SURFACE WIDGET
// Uses cached data - NO API calls
// ============================================================================

interface VolatilitySurfaceProps {
  candleData: Map<string, CandleData>;
  quotes: MarketQuote[];
}

function LiveVolatilitySurface({ candleData, quotes }: VolatilitySurfaceProps) {
  const { t } = useTranslation();
  const [sortBy, setSortBy] = useState<'vol' | 'symbol' | 'change'>('vol');

  // Calculate volatility from cached data (synchronous)
  const volData = useMemo(() => {
    const symbols = ['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'JPM', 'AMD', 'NFLX'];
    const data: { symbol: string; annualizedVol: number; price: number; change: number }[] = [];
    
    for (const symbol of symbols) {
      const candles = candleData.get(symbol);
      const quote = quotes.find(q => q.symbol === symbol);
      
      if (candles && candles.closes.length > 1 && quote) {
        const returns = calculateReturns(candles.closes);
        const annualVol = annualizedVolatility(returns);
        
        data.push({
          symbol,
          annualizedVol: annualVol,
          price: quote.price,
          change: quote.change,
        });
      }
    }
    
    return data;
  }, [candleData, quotes]);

  const sortedData = useMemo(() => {
    const sorted = [...volData];
    switch (sortBy) {
      case 'vol':
        sorted.sort((a, b) => b.annualizedVol - a.annualizedVol);
        break;
      case 'symbol':
        sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
        break;
      case 'change':
        sorted.sort((a, b) => b.change - a.change);
        break;
    }
    return sorted;
  }, [volData, sortBy]);

  const maxVol = Math.max(...volData.map(d => d.annualizedVol), 0.01);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-purple-500/30"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-purple-500/20 rounded-lg">
            <ArrowTrendingUpIcon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-bold text-white">{t("Live Volatility Surface")}</h3>
            <p className="text-[10px] sm:text-xs text-gray-400">{t("30-day realized volatility (annualized)")}</p>
          </div>
        </div>
        
        <div className="flex gap-1">
          {(['vol', 'symbol', 'change'] as const).map(option => (
            <button
              key={option}
              onClick={() => setSortBy(option)}
              className={`px-2 py-1 text-xs rounded ${
                sortBy === option
                  ? 'bg-purple-500/30 text-purple-300'
                  : 'bg-gray-800/50 text-gray-500 hover:text-gray-300'
              }`}
            >
              {option === 'vol' ? 'σ' : option === 'symbol' ? 'A-Z' : 'Δ%'}
            </button>
          ))}
        </div>
      </div>

      {sortedData.length === 0 ? (
        <div className="text-gray-400 text-center py-8">{t("No volatility data available")}</div>
      ) : (
        <div className="space-y-2">
          {sortedData.map((item, idx) => (
            <div key={item.symbol} className="flex items-center gap-3">
              <span className="w-12 text-sm font-mono text-purple-300">{item.symbol}</span>
              <div className="flex-1 h-6 bg-gray-800/50 rounded overflow-hidden relative">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(item.annualizedVol / maxVol) * 100}%` }}
                  transition={{ delay: idx * 0.05, duration: 0.5 }}
                  className="h-full rounded"
                  style={{
                    background: `linear-gradient(90deg, 
                      ${item.annualizedVol < 0.3 ? '#22c55e' : item.annualizedVol < 0.5 ? '#eab308' : '#ef4444'}88,
                      ${item.annualizedVol < 0.3 ? '#22c55e' : item.annualizedVol < 0.5 ? '#eab308' : '#ef4444'}
                    )`
                  }}
                />
                <span className="absolute inset-0 flex items-center justify-end pr-2 text-xs text-white font-mono">
                  {(item.annualizedVol * 100).toFixed(1)}%
                </span>
              </div>
              <span className={`w-16 text-right text-xs font-mono ${
                item.change >= 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-4 flex items-center justify-center gap-4 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-green-500"></div> Low (&lt;30%)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-yellow-500"></div> Medium (30-50%)
        </span>
        <span className="flex items-center gap-1">
          <div className="w-3 h-3 rounded bg-red-500"></div> High (&gt;50%)
        </span>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MONTE CARLO SIMULATOR WITH LIVE VOLATILITY
// Uses cached data - NO API calls during simulation
// ============================================================================

interface MonteCarloProps {
  candleData: Map<string, CandleData>;
  quotes: MarketQuote[];
}

function MonteCarloSimulator({ candleData, quotes }: MonteCarloProps) {
  const { t } = useTranslation();
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [numPaths, setNumPaths] = useState(100);
  const [horizon, setHorizon] = useState(30);
  const [simResults, setSimResults] = useState<{
    paths: number[][];
    spotPrice: number;
    volatility: number;
    expectedReturn: number;
    var95: number;
    var99: number;
    expectedPrice: number;
  } | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  const availableSymbols = useMemo(() => {
    return ['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'SPY', 'QQQ'].filter(
      s => candleData.has(s) && quotes.some(q => q.symbol === s)
    );
  }, [candleData, quotes]);

  const runSimulation = useCallback(() => {
    const candles = candleData.get(selectedSymbol);
    const quote = quotes.find(q => q.symbol === selectedSymbol);
    
    if (!candles || !quote || candles.closes.length < 5) {
      console.warn('No data for', selectedSymbol);
      return;
    }
    
    setIsRunning(true);
    
    // Use requestAnimationFrame to not block UI
    requestAnimationFrame(() => {
      const returns = calculateReturns(candles.closes);
      const dailyVol = stdDev(returns);
      const dailyMu = mean(returns);
      const spotPrice = quote.price;
      
      // Generate paths using Geometric Brownian Motion
      // dS = μ*S*dt + σ*S*dW
      const dt = 1; // Daily time step (already in daily units)
      const paths: number[][] = [];
      const finalPrices: number[] = [];
      
      for (let p = 0; p < numPaths; p++) {
        const path = [spotPrice];
        let price = spotPrice;
        
        for (let t = 1; t <= horizon; t++) {
          // Box-Muller transform for normal random
          const u1 = Math.random();
          const u2 = Math.random();
          const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
          
          // GBM step: S(t+dt) = S(t) * exp((μ - σ²/2)*dt + σ*√dt*Z)
          const drift = (dailyMu - 0.5 * dailyVol * dailyVol) * dt;
          const diffusion = dailyVol * Math.sqrt(dt) * z;
          price = price * Math.exp(drift + diffusion);
          path.push(price);
        }
        
        paths.push(path);
        finalPrices.push(path[path.length - 1]);
      }
      
      // Calculate VaR (loss relative to spot)
      const sortedReturns = finalPrices
        .map(p => (p - spotPrice) / spotPrice)
        .sort((a, b) => a - b);
      
      // VaR at α confidence = (1-α) percentile of returns
      // For 95% confidence, we want the 5th percentile (worst 5%)
      // For 99% confidence, we want the 1st percentile (worst 1%)
      const var95Index = Math.max(0, Math.ceil(numPaths * 0.05) - 1);
      const var99Index = Math.max(0, Math.ceil(numPaths * 0.01) - 1);
      
      // VaR is the loss at percentile (negative of the return)
      const var95 = -sortedReturns[var95Index] * spotPrice;
      const var99 = -sortedReturns[var99Index] * spotPrice;
      
      const expectedPrice = mean(finalPrices);
      const expectedReturn = (expectedPrice - spotPrice) / spotPrice;
      
      setSimResults({
        paths,
        spotPrice,
        volatility: dailyVol * Math.sqrt(252),
        expectedReturn,
        var95,
        var99,
        expectedPrice
      });
      
      setIsRunning(false);
    });
  }, [selectedSymbol, numPaths, horizon, candleData, quotes]);

  // Mini chart for paths
  const pathsChart = useMemo(() => {
    if (!simResults) return null;
    
    const { paths, spotPrice } = simResults;
    const allPrices = paths.flat();
    const minPrice = Math.min(...allPrices) * 0.98;
    const maxPrice = Math.max(...allPrices) * 1.02;
    const width = 100;
    const height = 100;
    
    const scaleY = (price: number) => height - ((price - minPrice) / (maxPrice - minPrice)) * height;
    const scaleX = (t: number) => (t / horizon) * width;
    
    // Show subset of paths for performance
    const displayPaths = paths.slice(0, Math.min(50, paths.length));
    
    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-48" preserveAspectRatio="none">
        {/* Spot price line */}
        <line
          x1={0}
          y1={scaleY(spotPrice)}
          x2={width}
          y2={scaleY(spotPrice)}
          stroke="#6b7280"
          strokeDasharray="2,2"
          strokeWidth={0.5}
        />
        
        {/* Monte Carlo paths */}
        {displayPaths.map((path, i) => {
          const d = path.map((price, t) => 
            `${t === 0 ? 'M' : 'L'} ${scaleX(t).toFixed(2)} ${scaleY(price).toFixed(2)}`
          ).join(' ');
          
          const finalPrice = path[path.length - 1];
          const color = finalPrice >= spotPrice ? '#22c55e' : '#ef4444';
          
          return (
            <path
              key={i}
              d={d}
              fill="none"
              stroke={color}
              strokeWidth={0.3}
              opacity={0.4}
            />
          );
        })}
      </svg>
    );
  }, [simResults, horizon]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-amber-500/30"
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 bg-amber-500/20 rounded-lg">
          <CubeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-base sm:text-xl font-bold text-white">{t("Monte Carlo Simulator")}</h3>
          <p className="text-[10px] sm:text-xs text-gray-400">{t("GBM with live realized volatility")}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <label className="text-[10px] sm:text-xs text-gray-500 block mb-1">{t("Asset")}</label>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-amber-500/50 focus:outline-none"
          >
            {availableSymbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">{t("Paths")}</label>
          <select
            value={numPaths}
            onChange={(e) => setNumPaths(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-amber-500/50 focus:outline-none"
          >
            <option value={50}>50</option>
            <option value={100}>100</option>
            <option value={500}>500</option>
            <option value={1000}>1000</option>
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">Horizon (days)</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-amber-500/50 focus:outline-none"
          >
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
            <option value={60}>60</option>
          </select>
        </div>
      </div>

      <button
        onClick={runSimulation}
        disabled={isRunning || availableSymbols.length === 0}
        className="w-full py-2 mb-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
      >
        {isRunning ? (
          <ArrowPathIcon className="w-5 h-5 animate-spin" />
        ) : (
          <>
            <PlayIcon className="w-5 h-5" />
            Run Simulation
          </>
        )}
      </button>

      {simResults && (
        <>
          {pathsChart}
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Spot Price</p>
              <p className="text-lg font-mono text-white">${simResults.spotPrice.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Expected Price</p>
              <p className="text-lg font-mono text-white">${simResults.expectedPrice.toFixed(2)}</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Realized Vol (Ann.)</p>
              <p className="text-lg font-mono text-purple-400">{(simResults.volatility * 100).toFixed(1)}%</p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-3">
              <p className="text-xs text-gray-500">Expected Return</p>
              <p className={`text-lg font-mono ${simResults.expectedReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {(simResults.expectedReturn * 100).toFixed(2)}%
              </p>
            </div>
            <div className="bg-red-900/30 rounded-lg p-3 border border-red-500/30">
              <p className="text-xs text-red-400">VaR 95%</p>
              <p className="text-lg font-mono text-red-400">-${simResults.var95.toFixed(2)}</p>
            </div>
            <div className="bg-red-900/30 rounded-lg p-3 border border-red-500/30">
              <p className="text-xs text-red-400">VaR 99%</p>
              <p className="text-lg font-mono text-red-400">-${simResults.var99.toFixed(2)}</p>
            </div>
          </div>
          
          <p className="text-xs text-gray-500 mt-3 text-center">
            Based on {horizon}-day {numPaths} simulations using GBM: dS = μSdt + σSdW
          </p>
        </>
      )}
    </motion.div>
  );
}

// ============================================================================
// LIVE PORTFOLIO TRACKER WIDGET
// Track portfolio with real allocations and live P&L
// ============================================================================

interface PortfolioPosition {
  symbol: string;
  shares: number;
  costBasis: number;
  currentPrice: number;
  value: number;
  pnl: number;
  pnlPercent: number;
  weight: number;
}

interface PortfolioTrackerProps {
  quotes: MarketQuote[];
}

function LivePortfolioTracker({ quotes }: PortfolioTrackerProps) {
  const { t } = useTranslation();
  // Sample portfolio - users can modify this
  const [portfolio, setPortfolio] = useState<{ symbol: string; shares: number; costBasis: number }[]>([
    { symbol: 'AAPL', shares: 50, costBasis: 180 },
    { symbol: 'GOOGL', shares: 20, costBasis: 140 },
    { symbol: 'MSFT', shares: 30, costBasis: 380 },
    { symbol: 'NVDA', shares: 25, costBasis: 120 },
    { symbol: 'SPY', shares: 40, costBasis: 450 },
  ]);
  
  const [editMode, setEditMode] = useState(false);

  // Calculate positions with live prices
  const positions = useMemo<PortfolioPosition[]>(() => {
    const pos: PortfolioPosition[] = [];
    let totalValue = 0;
    
    // First pass: calculate values
    for (const holding of portfolio) {
      const quote = quotes.find(q => q.symbol === holding.symbol);
      if (quote) {
        const value = holding.shares * quote.price;
        totalValue += value;
        pos.push({
          symbol: holding.symbol,
          shares: holding.shares,
          costBasis: holding.costBasis,
          currentPrice: quote.price,
          value,
          pnl: (quote.price - holding.costBasis) * holding.shares,
          pnlPercent: ((quote.price - holding.costBasis) / holding.costBasis) * 100,
          weight: 0, // calculated below
        });
      }
    }
    
    // Second pass: calculate weights
    for (const p of pos) {
      p.weight = totalValue > 0 ? (p.value / totalValue) * 100 : 0;
    }
    
    return pos.sort((a, b) => b.weight - a.weight);
  }, [portfolio, quotes]);

  const totalValue = positions.reduce((sum, p) => sum + p.value, 0);
  const totalCost = positions.reduce((sum, p) => sum + (p.costBasis * p.shares), 0);
  const totalPnL = totalValue - totalCost;
  const totalPnLPercent = totalCost > 0 ? (totalPnL / totalCost) * 100 : 0;

  const updatePosition = (index: number, field: 'shares' | 'costBasis', value: number) => {
    const newPortfolio = [...portfolio];
    newPortfolio[index] = { ...newPortfolio[index], [field]: value };
    setPortfolio(newPortfolio);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-green-500/30"
    >
      <div className="flex items-center justify-between mb-3 sm:mb-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-green-500/20 rounded-lg">
            <ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-green-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-bold text-white">{t("Live Portfolio Tracker")}</h3>
            <p className="text-[10px] sm:text-xs text-gray-400">{t("Real-time P&L with Finnhub prices")}</p>
          </div>
        </div>
        <button
          onClick={() => setEditMode(!editMode)}
          className={`px-2 sm:px-3 py-1 text-[10px] sm:text-xs rounded ${
            editMode ? 'bg-green-500/30 text-green-300' : 'bg-gray-700/50 text-gray-400'
          }`}
        >
          {editMode ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* Portfolio Summary - Responsive grid */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3 text-center">
          <p className="text-[9px] sm:text-xs text-gray-500">Total Value</p>
          <p className="text-sm sm:text-xl font-mono text-white">${totalValue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3 text-center">
          <p className="text-[9px] sm:text-xs text-gray-500">Total P&L</p>
          <p className={`text-sm sm:text-xl font-mono ${totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-2 sm:p-3 text-center">
          <p className="text-[9px] sm:text-xs text-gray-500">Return</p>
          <p className={`text-xl font-mono ${totalPnLPercent >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPnLPercent >= 0 ? '+' : ''}{totalPnLPercent.toFixed(2)}%
          </p>
        </div>
      </div>

      {/* Positions Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="text-left py-2">Symbol</th>
              <th className="text-right py-2">Shares</th>
              <th className="text-right py-2">Cost</th>
              <th className="text-right py-2">Price</th>
              <th className="text-right py-2">Value</th>
              <th className="text-right py-2">P&L</th>
              <th className="text-right py-2">Weight</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((pos, idx) => (
              <tr key={pos.symbol} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 font-mono text-green-300">{pos.symbol}</td>
                <td className="py-2 text-right">
                  {editMode ? (
                    <input
                      type="number"
                      value={portfolio[idx]?.shares || 0}
                      onChange={(e) => updatePosition(idx, 'shares', Number(e.target.value))}
                      className="w-16 px-1 py-0.5 bg-gray-700 rounded text-right text-white text-xs"
                    />
                  ) : (
                    <span className="text-white">{pos.shares}</span>
                  )}
                </td>
                <td className="py-2 text-right">
                  {editMode ? (
                    <input
                      type="number"
                      value={portfolio[idx]?.costBasis || 0}
                      onChange={(e) => updatePosition(idx, 'costBasis', Number(e.target.value))}
                      className="w-16 px-1 py-0.5 bg-gray-700 rounded text-right text-white text-xs"
                    />
                  ) : (
                    <span className="text-gray-400">${pos.costBasis.toFixed(2)}</span>
                  )}
                </td>
                <td className="py-2 text-right text-white">${pos.currentPrice.toFixed(2)}</td>
                <td className="py-2 text-right text-white">${pos.value.toLocaleString()}</td>
                <td className={`py-2 text-right font-mono ${pos.pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pos.pnl >= 0 ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                </td>
                <td className="py-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <div className="w-12 h-2 bg-gray-700 rounded overflow-hidden">
                      <div 
                        className="h-full bg-green-500/70 rounded"
                        style={{ width: `${pos.weight}%` }}
                      />
                    </div>
                    <span className="text-gray-400 text-xs w-10">{pos.weight.toFixed(1)}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}

// ============================================================================
// LIVE VAR DASHBOARD WIDGET
// Portfolio VaR with correlation matrix
// ============================================================================

interface VaRDashboardProps {
  candleData: Map<string, CandleData>;
  quotes: MarketQuote[];
}

function LiveVaRDashboard({ candleData, quotes }: VaRDashboardProps) {
  const { t } = useTranslation();
  const [portfolioValue, setPortfolioValue] = useState(100000);
  const [confidence, setConfidence] = useState<95 | 99>(95);
  const [horizon, setHorizon] = useState(1);

  // Calculate portfolio VaR
  const varMetrics = useMemo(() => {
    // Get weights for a sample diversified portfolio
    const portfolioSymbols = ['SPY', 'QQQ', 'AAPL', 'MSFT', 'NVDA'];
    const weights = [0.30, 0.25, 0.20, 0.15, 0.10]; // Example weights
    
    // Get volatilities
    const volatilities: number[] = [];
    const returnArrays: number[][] = [];
    
    for (const symbol of portfolioSymbols) {
      const candles = candleData.get(symbol);
      if (candles && candles.closes.length > 1) {
        const returns = calculateReturns(candles.closes);
        returnArrays.push(returns);
        volatilities.push(stdDev(returns));
      }
    }
    
    if (volatilities.length < portfolioSymbols.length) {
      return null;
    }
    
    // Build correlation matrix
    const n = portfolioSymbols.length;
    const corrMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          corrMatrix[i][j] = 1;
        } else {
          corrMatrix[i][j] = correlation(returnArrays[i], returnArrays[j]);
        }
      }
    }
    
    // Calculate portfolio variance using matrix multiplication
    // σ²_p = w' * Σ * w where Σ = Diag(σ) * Corr * Diag(σ)
    let portfolioVariance = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        portfolioVariance += weights[i] * weights[j] * volatilities[i] * volatilities[j] * corrMatrix[i][j];
      }
    }
    
    const dailyPortfolioVol = Math.sqrt(portfolioVariance);
    const annualizedPortfolioVol = dailyPortfolioVol * Math.sqrt(252);
    
    // Z-scores for confidence levels
    const zScore = confidence === 95 ? 1.645 : 2.326;
    
    // Parametric VaR = Portfolio Value * z * σ * √t
    const var1Day = portfolioValue * zScore * dailyPortfolioVol;
    const varHorizon = portfolioValue * zScore * dailyPortfolioVol * Math.sqrt(horizon);
    
    // Component VaR (marginal contribution)
    // Marginal VaR_i = ∂σ_p/∂w_i = (1/σ_p) * Σⱼ wⱼσᵢσⱼρᵢⱼ
    // Component VaR_i = wᵢ × Marginal VaR_i × Z × √t × V
    const componentVaR = portfolioSymbols.map((symbol, i) => {
      let marginalContrib = 0;
      for (let j = 0; j < n; j++) {
        marginalContrib += weights[j] * volatilities[i] * volatilities[j] * corrMatrix[i][j];
      }
      // Marginal volatility contribution
      const marginalVol = marginalContrib / dailyPortfolioVol;
      return {
        symbol,
        weight: weights[i] * 100,
        volatility: volatilities[i] * Math.sqrt(252) * 100,
        // Component VaR = weight × marginal × Z × √t × V
        componentVaR: weights[i] * marginalVol * portfolioValue * zScore * Math.sqrt(horizon),
      };
    });
    
    return {
      dailyVol: dailyPortfolioVol * 100,
      annualizedVol: annualizedPortfolioVol * 100,
      var1Day,
      varHorizon,
      componentVaR,
      corrMatrix,
      symbols: portfolioSymbols,
    };
  }, [candleData, portfolioValue, confidence, horizon]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-red-500/30"
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 bg-red-500/20 rounded-lg">
          <ArrowTrendingUpIcon className="w-5 h-5 sm:w-6 sm:h-6 text-red-400" />
        </div>
        <div>
          <h3 className="text-base sm:text-xl font-bold text-white">{t("Live VaR Dashboard")}</h3>
          <p className="text-[10px] sm:text-xs text-gray-400">{t("Portfolio Value-at-Risk with correlation")}</p>
        </div>
      </div>

      {/* Controls - Responsive grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div>
          <label className="text-[10px] sm:text-xs text-gray-500 block mb-1">{t("Portfolio Value")}</label>
          <input
            type="number"
            value={portfolioValue}
            onChange={(e) => setPortfolioValue(Number(e.target.value))}
            className="w-full px-2 py-1 sm:py-1.5 bg-gray-800/50 border border-gray-700 rounded text-white text-xs sm:text-sm"
          />
        </div>
        <div>
          <label className="text-[10px] sm:text-xs text-gray-500 block mb-1">Confidence</label>
          <select
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value) as 95 | 99)}
            className="w-full px-2 py-1 sm:py-1.5 bg-gray-800/50 border border-gray-700 rounded text-white text-xs sm:text-sm"
          >
            <option value={95}>95%</option>
            <option value={99}>99%</option>
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="text-[10px] sm:text-xs text-gray-500 block mb-1">Horizon (days)</label>
          <select
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
            className="w-full px-2 py-1 sm:py-1.5 bg-gray-800/50 border border-gray-700 rounded text-white text-xs sm:text-sm"
          >
            <option value={1}>1 day</option>
            <option value={5}>5 days</option>
            <option value={10}>10 days</option>
            <option value={21}>21 days</option>
          </select>
        </div>
      </div>

      {varMetrics ? (
        <>
          {/* VaR Summary */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-red-900/30 rounded-lg p-4 border border-red-500/30">
              <p className="text-xs text-red-400 mb-1">VaR ({confidence}%, {horizon}-day)</p>
              <p className="text-2xl font-mono text-red-400">
                -${varMetrics.varHorizon.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                {((varMetrics.varHorizon / portfolioValue) * 100).toFixed(2)}% of portfolio
              </p>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <p className="text-xs text-gray-500 mb-1">Portfolio Volatility</p>
              <p className="text-2xl font-mono text-purple-400">
                {varMetrics.annualizedVol.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 mt-1">annualized</p>
            </div>
          </div>

          {/* Component VaR */}
          <div className="mb-4">
            <p className="text-xs text-gray-500 mb-2">Component VaR Breakdown</p>
            <div className="space-y-2">
              {varMetrics.componentVaR.map(comp => (
                <div key={comp.symbol} className="flex items-center gap-2">
                  <span className="w-12 text-sm font-mono text-gray-300">{comp.symbol}</span>
                  <div className="flex-1 h-4 bg-gray-800/50 rounded overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-red-500/50 to-red-500"
                      style={{ width: `${(comp.componentVaR / varMetrics.varHorizon) * 100}%` }}
                    />
                  </div>
                  <span className="text-xs text-red-400 w-20 text-right">
                    -${comp.componentVaR.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Parametric VaR using variance-covariance method: VaR = Z × σ_p × √t × V
          </p>
        </>
      ) : (
        <div className="text-gray-400 text-center py-8">Calculating VaR...</div>
      )}
    </motion.div>
  );
}

// ============================================================================
// OPTIONS PAYOFF BUILDER WIDGET
// Interactive options strategy builder with preset strategies
// ============================================================================

interface OptionLeg {
  id: number;
  type: 'call' | 'put';
  position: 'long' | 'short';
  strike: number;
  premium: number;
  quantity: number;
}

interface StrategyPreset {
  name: string;
  description: string;
  sentiment: 'bullish' | 'bearish' | 'neutral' | 'volatile';
  legs: (spot: number) => Omit<OptionLeg, 'id'>[];
}

const STRATEGY_PRESETS: StrategyPreset[] = [
  {
    name: 'Long Call',
    description: 'Bullish bet with unlimited upside, limited downside',
    sentiment: 'bullish',
    legs: (spot) => [
      { type: 'call', position: 'long', strike: Math.round(spot), premium: spot * 0.03, quantity: 1 },
    ],
  },
  {
    name: 'Long Put',
    description: 'Bearish bet with large downside profit potential',
    sentiment: 'bearish',
    legs: (spot) => [
      { type: 'put', position: 'long', strike: Math.round(spot), premium: spot * 0.03, quantity: 1 },
    ],
  },
  {
    name: 'Covered Call',
    description: 'Own stock + sell call for income (simulated)',
    sentiment: 'neutral',
    legs: (spot) => [
      { type: 'call', position: 'short', strike: Math.round(spot * 1.05), premium: spot * 0.02, quantity: 1 },
    ],
  },
  {
    name: 'Bull Call Spread',
    description: 'Buy lower strike call, sell higher strike call',
    sentiment: 'bullish',
    legs: (spot) => [
      { type: 'call', position: 'long', strike: Math.round(spot * 0.95), premium: spot * 0.05, quantity: 1 },
      { type: 'call', position: 'short', strike: Math.round(spot * 1.05), premium: spot * 0.02, quantity: 1 },
    ],
  },
  {
    name: 'Bear Put Spread',
    description: 'Buy higher strike put, sell lower strike put',
    sentiment: 'bearish',
    legs: (spot) => [
      { type: 'put', position: 'long', strike: Math.round(spot * 1.05), premium: spot * 0.05, quantity: 1 },
      { type: 'put', position: 'short', strike: Math.round(spot * 0.95), premium: spot * 0.02, quantity: 1 },
    ],
  },
  {
    name: 'Long Straddle',
    description: 'Buy call + put at same strike - profit from big moves',
    sentiment: 'volatile',
    legs: (spot) => [
      { type: 'call', position: 'long', strike: Math.round(spot), premium: spot * 0.03, quantity: 1 },
      { type: 'put', position: 'long', strike: Math.round(spot), premium: spot * 0.03, quantity: 1 },
    ],
  },
  {
    name: 'Long Strangle',
    description: 'Buy OTM call + OTM put - cheaper volatility bet',
    sentiment: 'volatile',
    legs: (spot) => [
      { type: 'call', position: 'long', strike: Math.round(spot * 1.05), premium: spot * 0.02, quantity: 1 },
      { type: 'put', position: 'long', strike: Math.round(spot * 0.95), premium: spot * 0.02, quantity: 1 },
    ],
  },
  {
    name: 'Iron Condor',
    description: 'Sell strangle + buy wings - profit from low volatility',
    sentiment: 'neutral',
    legs: (spot) => [
      { type: 'put', position: 'long', strike: Math.round(spot * 0.90), premium: spot * 0.01, quantity: 1 },
      { type: 'put', position: 'short', strike: Math.round(spot * 0.95), premium: spot * 0.02, quantity: 1 },
      { type: 'call', position: 'short', strike: Math.round(spot * 1.05), premium: spot * 0.02, quantity: 1 },
      { type: 'call', position: 'long', strike: Math.round(spot * 1.10), premium: spot * 0.01, quantity: 1 },
    ],
  },
  {
    name: 'Iron Butterfly',
    description: 'Sell straddle + buy wings - max profit if price unchanged',
    sentiment: 'neutral',
    legs: (spot) => [
      { type: 'put', position: 'long', strike: Math.round(spot * 0.95), premium: spot * 0.015, quantity: 1 },
      { type: 'put', position: 'short', strike: Math.round(spot), premium: spot * 0.03, quantity: 1 },
      { type: 'call', position: 'short', strike: Math.round(spot), premium: spot * 0.03, quantity: 1 },
      { type: 'call', position: 'long', strike: Math.round(spot * 1.05), premium: spot * 0.015, quantity: 1 },
    ],
  },
  {
    name: 'Call Butterfly',
    description: 'Buy 1 ITM call, sell 2 ATM calls, buy 1 OTM call',
    sentiment: 'neutral',
    legs: (spot) => [
      { type: 'call', position: 'long', strike: Math.round(spot * 0.95), premium: spot * 0.06, quantity: 1 },
      { type: 'call', position: 'short', strike: Math.round(spot), premium: spot * 0.03, quantity: 2 },
      { type: 'call', position: 'long', strike: Math.round(spot * 1.05), premium: spot * 0.015, quantity: 1 },
    ],
  },
  {
    name: 'Protective Put',
    description: 'Long stock + long put for downside protection (simulated)',
    sentiment: 'bullish',
    legs: (spot) => [
      { type: 'put', position: 'long', strike: Math.round(spot * 0.95), premium: spot * 0.02, quantity: 1 },
    ],
  },
  {
    name: 'Collar',
    description: 'Long stock + protective put + covered call (simulated)',
    sentiment: 'neutral',
    legs: (spot) => [
      { type: 'put', position: 'long', strike: Math.round(spot * 0.95), premium: spot * 0.02, quantity: 1 },
      { type: 'call', position: 'short', strike: Math.round(spot * 1.05), premium: spot * 0.02, quantity: 1 },
    ],
  },
];

interface OptionsPayoffProps {
  quotes: MarketQuote[];
}

function OptionsPayoffBuilder({ quotes }: OptionsPayoffProps) {
  const { t } = useTranslation();
  const [selectedSymbol, setSelectedSymbol] = useState('AAPL');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('Long Call');
  const [legs, setLegs] = useState<OptionLeg[]>([
    { id: 1, type: 'call', position: 'long', strike: 180, premium: 5, quantity: 1 },
  ]);

  const spotPrice = quotes.find(q => q.symbol === selectedSymbol)?.price || 180;

  // Apply strategy preset
  const applyStrategy = useCallback((strategyName: string) => {
    const strategy = STRATEGY_PRESETS.find(s => s.name === strategyName);
    if (strategy) {
      const newLegs = strategy.legs(spotPrice).map((leg, idx) => ({
        ...leg,
        id: idx + 1,
        premium: Math.round(leg.premium * 100) / 100,
      }));
      setLegs(newLegs);
      setSelectedStrategy(strategyName);
    }
  }, [spotPrice]);

  // Initialize with Long Call on mount or symbol change
  useEffect(() => {
    applyStrategy(selectedStrategy);
  }, [spotPrice]);

  const addLeg = () => {
    const newId = Math.max(...legs.map(l => l.id), 0) + 1;
    setLegs([...legs, {
      id: newId,
      type: 'call',
      position: 'long',
      strike: Math.round(spotPrice),
      premium: Math.round(spotPrice * 0.03 * 100) / 100,
      quantity: 1,
    }]);
    setSelectedStrategy('Custom');
  };

  const removeLeg = (id: number) => {
    if (legs.length > 1) {
      setLegs(legs.filter(l => l.id !== id));
      setSelectedStrategy('Custom');
    }
  };

  const updateLeg = (id: number, field: keyof OptionLeg, value: any) => {
    setLegs(legs.map(l => l.id === id ? { ...l, [field]: value } : l));
    setSelectedStrategy('Custom');
  };

  const currentStrategy = STRATEGY_PRESETS.find(s => s.name === selectedStrategy);

  // Calculate payoff at expiration
  const calculatePayoff = useCallback((priceAtExpiry: number): number => {
    let totalPayoff = 0;
    
    for (const leg of legs) {
      const multiplier = leg.position === 'long' ? 1 : -1;
      let intrinsicValue = 0;
      
      if (leg.type === 'call') {
        intrinsicValue = Math.max(0, priceAtExpiry - leg.strike);
      } else {
        intrinsicValue = Math.max(0, leg.strike - priceAtExpiry);
      }
      
      // Payoff = (Intrinsic Value - Premium) × Quantity × Position Multiplier
      // For long: pay premium, receive intrinsic
      // For short: receive premium, pay intrinsic
      const legPayoff = multiplier * (intrinsicValue - leg.premium) * leg.quantity * 100;
      totalPayoff += legPayoff;
    }
    
    return totalPayoff;
  }, [legs]);

  // Generate payoff curve data
  const payoffData = useMemo(() => {
    const minPrice = spotPrice * 0.7;
    const maxPrice = spotPrice * 1.3;
    const step = (maxPrice - minPrice) / 100;
    
    const data: { price: number; payoff: number }[] = [];
    for (let price = minPrice; price <= maxPrice; price += step) {
      data.push({ price, payoff: calculatePayoff(price) });
    }
    
    return data;
  }, [spotPrice, calculatePayoff]);

  const maxProfit = Math.max(...payoffData.map(d => d.payoff));
  const maxLoss = Math.min(...payoffData.map(d => d.payoff));
  
  // Find ALL breakeven points (where payoff crosses zero)
  const breakevenPoints: number[] = [];
  for (let i = 1; i < payoffData.length; i++) {
    const prev = payoffData[i - 1];
    const curr = payoffData[i];
    // Check if payoff crosses zero between these two points
    if ((prev.payoff < 0 && curr.payoff >= 0) || (prev.payoff > 0 && curr.payoff <= 0) ||
        (prev.payoff > 0 && curr.payoff < 0) || (prev.payoff < 0 && curr.payoff > 0)) {
      // Linear interpolation to find exact breakeven
      const ratio = Math.abs(prev.payoff) / (Math.abs(prev.payoff) + Math.abs(curr.payoff));
      const breakeven = prev.price + ratio * (curr.price - prev.price);
      breakevenPoints.push(breakeven);
    }
  }

  // Total premium paid/received
  const totalPremium = legs.reduce((sum, leg) => {
    const mult = leg.position === 'long' ? -1 : 1;
    return sum + mult * leg.premium * leg.quantity * 100;
  }, 0);

  // SVG chart
  const chartWidth = 100;
  const chartHeight = 60;
  const minPayoff = Math.min(...payoffData.map(d => d.payoff));
  const maxPayoffVal = Math.max(...payoffData.map(d => d.payoff));
  const payoffRange = maxPayoffVal - minPayoff || 1;

  const scaleX = (price: number) => ((price - payoffData[0].price) / (payoffData[payoffData.length - 1].price - payoffData[0].price)) * chartWidth;
  const scaleY = (payoff: number) => chartHeight - ((payoff - minPayoff) / payoffRange) * chartHeight;
  const zeroY = scaleY(0);

  const pathD = payoffData.map((d, i) => 
    `${i === 0 ? 'M' : 'L'} ${scaleX(d.price).toFixed(2)} ${scaleY(d.payoff).toFixed(2)}`
  ).join(' ');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-blue-500/30"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 sm:mb-4 gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="p-1.5 sm:p-2 bg-blue-500/20 rounded-lg">
            <CubeIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-xl font-bold text-white">{t("Options Payoff Builder")}</h3>
            <p className="text-[10px] sm:text-xs text-gray-400">{t("Build and visualize options strategies")}</p>
          </div>
        </div>
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="px-2 py-1 bg-gray-800/50 border border-gray-700 rounded text-white text-sm"
        >
          {['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'SPY'].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* Strategy Selector - Responsive grid */}
      <div className="mb-3 sm:mb-4">
        <p className="text-[10px] sm:text-xs text-gray-500 mb-2">Select Strategy:</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
          {STRATEGY_PRESETS.map(strategy => {
            const sentimentColors = {
              bullish: 'border-green-500/50 bg-green-500/10 hover:bg-green-500/20',
              bearish: 'border-red-500/50 bg-red-500/10 hover:bg-red-500/20',
              neutral: 'border-yellow-500/50 bg-yellow-500/10 hover:bg-yellow-500/20',
              volatile: 'border-purple-500/50 bg-purple-500/10 hover:bg-purple-500/20',
            };
            const sentimentTextColors = {
              bullish: 'text-green-400',
              bearish: 'text-red-400',
              neutral: 'text-yellow-400',
              volatile: 'text-purple-400',
            };
            const isSelected = selectedStrategy === strategy.name;
            
            return (
              <button
                key={strategy.name}
                onClick={() => applyStrategy(strategy.name)}
                className={`px-2 py-1.5 rounded border text-xs transition-all ${
                  isSelected 
                    ? `${sentimentColors[strategy.sentiment]} ${sentimentTextColors[strategy.sentiment]} ring-1 ring-offset-1 ring-offset-gray-900`
                    : 'border-gray-700 bg-gray-800/30 text-gray-400 hover:border-gray-600'
                }`}
                title={strategy.description}
              >
                {strategy.name}
              </button>
            );
          })}
        </div>
        {currentStrategy && (
          <div className="mt-2 flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded text-xs ${
              currentStrategy.sentiment === 'bullish' ? 'bg-green-500/20 text-green-400' :
              currentStrategy.sentiment === 'bearish' ? 'bg-red-500/20 text-red-400' :
              currentStrategy.sentiment === 'neutral' ? 'bg-yellow-500/20 text-yellow-400' :
              'bg-purple-500/20 text-purple-400'
            }`}>
              {currentStrategy.sentiment.charAt(0).toUpperCase() + currentStrategy.sentiment.slice(1)}
            </span>
            <span className="text-xs text-gray-500">{currentStrategy.description}</span>
          </div>
        )}
        {selectedStrategy === 'Custom' && (
          <div className="mt-2">
            <span className="px-2 py-0.5 rounded text-xs bg-gray-500/20 text-gray-400">Custom Strategy</span>
          </div>
        )}
      </div>

      {/* Spot price */}
      <div className="mb-4 px-3 py-2 bg-blue-900/20 rounded-lg border border-blue-500/30">
        <span className="text-xs text-blue-300">Current {selectedSymbol} Price:</span>
        <span className="text-lg font-mono text-white ml-2">${spotPrice.toFixed(2)}</span>
      </div>

      {/* Option Legs */}
      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500 uppercase tracking-wide">Option Legs</span>
          {selectedStrategy !== 'Custom' && (
            <span className="text-xs text-blue-400 italic">Editing marks as "Custom"</span>
          )}
        </div>
        {legs.map((leg, idx) => (
          <div key={leg.id} className="flex items-center gap-2 p-2 bg-gray-800/30 rounded-lg">
            <select
              value={leg.position}
              onChange={(e) => updateLeg(leg.id, 'position', e.target.value)}
              className="px-2 py-1 bg-gray-700 rounded text-white text-xs"
            >
              <option value="long">Long</option>
              <option value="short">Short</option>
            </select>
            <select
              value={leg.type}
              onChange={(e) => updateLeg(leg.id, 'type', e.target.value)}
              className="px-2 py-1 bg-gray-700 rounded text-white text-xs"
            >
              <option value="call">Call</option>
              <option value="put">Put</option>
            </select>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">K:</span>
              <input
                type="number"
                value={leg.strike}
                onChange={(e) => updateLeg(leg.id, 'strike', Number(e.target.value))}
                className="w-16 px-1 py-1 bg-gray-700 rounded text-white text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">$:</span>
              <input
                type="number"
                value={leg.premium}
                step={0.5}
                onChange={(e) => updateLeg(leg.id, 'premium', Number(e.target.value))}
                className="w-14 px-1 py-1 bg-gray-700 rounded text-white text-xs"
              />
            </div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">Qty:</span>
              <input
                type="number"
                value={leg.quantity}
                min={1}
                onChange={(e) => updateLeg(leg.id, 'quantity', Number(e.target.value))}
                className="w-12 px-1 py-1 bg-gray-700 rounded text-white text-xs"
              />
            </div>
            <button
              onClick={() => removeLeg(leg.id)}
              className="px-2 py-1 text-red-400 hover:bg-red-500/20 rounded text-xs"
              disabled={legs.length === 1}
            >
              ✕
            </button>
          </div>
        ))}
        <button
          onClick={addLeg}
          className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 text-sm hover:border-blue-500 hover:text-blue-400 transition-colors"
        >
          + Add Leg
        </button>
      </div>

      {/* Payoff Chart */}
      <div className="bg-gray-800/30 rounded-lg p-4 mb-4">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-40" preserveAspectRatio="none">
          {/* Zero line */}
          <line x1={0} y1={zeroY} x2={chartWidth} y2={zeroY} stroke="#4b5563" strokeWidth={0.3} strokeDasharray="2,2" />
          
          {/* Spot price line */}
          <line 
            x1={scaleX(spotPrice)} 
            y1={0} 
            x2={scaleX(spotPrice)} 
            y2={chartHeight} 
            stroke="#3b82f6" 
            strokeWidth={0.5} 
            strokeDasharray="2,2"
          />
          
          {/* Payoff curve */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#payoffGradient)"
            strokeWidth={1}
          />
          
          {/* Gradient definition */}
          <defs>
            <linearGradient id="payoffGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="50%" stopColor="#f59e0b" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>
          
          {/* Fill area */}
          <path
            d={`${pathD} L ${chartWidth} ${zeroY} L 0 ${zeroY} Z`}
            fill="url(#payoffFill)"
            opacity={0.2}
          />
          <defs>
            <linearGradient id="payoffFill" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#22c55e" />
              <stop offset="50%" stopColor="transparent" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Strategy Metrics */}
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="bg-gray-800/50 rounded p-2">
          <p className="text-xs text-gray-500">Max Profit</p>
          <p className={`text-sm font-mono ${maxProfit === Infinity ? 'text-green-400' : maxProfit > 0 ? 'text-green-400' : 'text-gray-400'}`}>
            {maxProfit === Infinity ? '∞' : maxProfit > 10000 ? '∞' : `$${maxProfit.toFixed(0)}`}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <p className="text-xs text-gray-500">Max Loss</p>
          <p className={`text-sm font-mono ${maxLoss < -10000 ? 'text-red-400' : 'text-red-400'}`}>
            {maxLoss < -10000 ? '-∞' : `$${maxLoss.toFixed(0)}`}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <p className="text-xs text-gray-500">Breakeven{breakevenPoints.length > 1 ? 's' : ''}</p>
          <p className="text-sm font-mono text-blue-400">
            {breakevenPoints.length > 0 
              ? breakevenPoints.map(b => `$${b.toFixed(0)}`).join(', ')
              : 'N/A'}
          </p>
        </div>
        <div className="bg-gray-800/50 rounded p-2">
          <p className="text-xs text-gray-500">Net Premium</p>
          <p className={`text-sm font-mono ${totalPremium >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {totalPremium >= 0 ? '+' : ''}{totalPremium.toFixed(0)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// EFFICIENT FRONTIER / PORTFOLIO OPTIMIZER WIDGET
// Modern Portfolio Theory with live covariance matrix
// ============================================================================

interface EfficientFrontierProps {
  candleData: Map<string, CandleData>;
  quotes: MarketQuote[];
}

function EfficientFrontierOptimizer({ candleData, quotes }: EfficientFrontierProps) {
  const { t } = useTranslation();
  const [targetReturn, setTargetReturn] = useState(0.15); // 15% annual target
  const [riskFreeRate] = useState(0.05); // 5% risk-free rate

  // Calculate optimal portfolio using Markowitz Mean-Variance Optimization
  const portfolioData = useMemo(() => {
    const symbols = ['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA'];
    
    // Get returns for each asset
    const returnsMap: { [symbol: string]: number[] } = {};
    const annualReturns: number[] = [];
    const annualVols: number[] = [];
    
    for (const symbol of symbols) {
      const candles = candleData.get(symbol);
      if (candles && candles.closes.length > 5) {
        const dailyReturns = calculateReturns(candles.closes);
        returnsMap[symbol] = dailyReturns;
        
        // Annualized expected return (historical mean × 252)
        const annualReturn = mean(dailyReturns) * 252;
        annualReturns.push(annualReturn);
        
        // Annualized volatility
        const annualVol = stdDev(dailyReturns) * Math.sqrt(252);
        annualVols.push(annualVol);
      }
    }
    
    if (annualReturns.length < symbols.length) return null;
    
    const n = symbols.length;
    
    // Build covariance matrix (annualized)
    // Cov(i,j) = σᵢ × σⱼ × ρᵢⱼ × 252
    const covMatrix: number[][] = Array(n).fill(null).map(() => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) {
          // Variance = σ² (already daily, multiply by 252)
          const dailyVol = stdDev(returnsMap[symbols[i]]);
          covMatrix[i][j] = dailyVol * dailyVol * 252;
        } else {
          // Covariance = σᵢ × σⱼ × ρᵢⱼ × 252
          const dailyVolI = stdDev(returnsMap[symbols[i]]);
          const dailyVolJ = stdDev(returnsMap[symbols[j]]);
          const corr = correlation(returnsMap[symbols[i]], returnsMap[symbols[j]]);
          covMatrix[i][j] = dailyVolI * dailyVolJ * corr * 252;
        }
      }
    }
    
    // Generate efficient frontier points
    // For each target return, find minimum variance portfolio
    const frontierPoints: { return: number; volatility: number; sharpe: number; weights: number[] }[] = [];
    
    // Simple approach: generate random portfolios and find Pareto optimal ones
    const numPortfolios = 2000;
    const allPortfolios: { return: number; volatility: number; sharpe: number; weights: number[] }[] = [];
    
    for (let p = 0; p < numPortfolios; p++) {
      // Generate random weights that sum to 1 (Dirichlet-like)
      const rawWeights = symbols.map(() => Math.random());
      const sumWeights = rawWeights.reduce((a, b) => a + b, 0);
      const weights = rawWeights.map(w => w / sumWeights);
      
      // Portfolio return = Σ wᵢ × μᵢ
      let portfolioReturn = 0;
      for (let i = 0; i < n; i++) {
        portfolioReturn += weights[i] * annualReturns[i];
      }
      
      // Portfolio variance = w' × Σ × w
      let portfolioVariance = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          portfolioVariance += weights[i] * weights[j] * covMatrix[i][j];
        }
      }
      const portfolioVol = Math.sqrt(portfolioVariance);
      
      // Sharpe ratio = (μₚ - rғ) / σₚ
      const sharpe = portfolioVol > 0 ? (portfolioReturn - riskFreeRate) / portfolioVol : 0;
      
      allPortfolios.push({
        return: portfolioReturn,
        volatility: portfolioVol,
        sharpe,
        weights
      });
    }
    
    // Find efficient frontier (Pareto optimal portfolios)
    // Sort by return and keep only those with minimum volatility for their return level
    allPortfolios.sort((a, b) => a.return - b.return);
    
    let minVolSeen = Infinity;
    for (const port of allPortfolios) {
      if (port.volatility <= minVolSeen * 1.02) { // Small tolerance
        frontierPoints.push(port);
        minVolSeen = Math.min(minVolSeen, port.volatility);
      }
    }
    
    // Find maximum Sharpe ratio portfolio (tangency portfolio)
    const maxSharpePortfolio = allPortfolios.reduce((best, curr) => 
      curr.sharpe > best.sharpe ? curr : best
    , allPortfolios[0]);
    
    // Find minimum variance portfolio
    const minVarPortfolio = allPortfolios.reduce((best, curr) => 
      curr.volatility < best.volatility ? curr : best
    , allPortfolios[0]);
    
    // Find portfolio closest to target return
    const targetPortfolio = allPortfolios.reduce((best, curr) => 
      Math.abs(curr.return - targetReturn) < Math.abs(best.return - targetReturn) ? curr : best
    , allPortfolios[0]);
    
    return {
      symbols,
      annualReturns,
      annualVols,
      frontierPoints: frontierPoints.filter((_, i) => i % 5 === 0), // Sample for performance
      maxSharpePortfolio,
      minVarPortfolio,
      targetPortfolio,
      allPortfolios: allPortfolios.filter((_, i) => i % 10 === 0), // Sample for scatter
    };
  }, [candleData, targetReturn, riskFreeRate]);

  if (!portfolioData) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/30"
      >
        <div className="text-gray-400 text-center py-8">Loading portfolio data...</div>
      </motion.div>
    );
  }

  const { symbols, annualReturns, annualVols, frontierPoints, maxSharpePortfolio, minVarPortfolio, targetPortfolio, allPortfolios } = portfolioData;

  // SVG chart dimensions
  const chartWidth = 300;
  const chartHeight = 200;
  const padding = 40;
  
  // Scale functions
  const allVols = allPortfolios.map(p => p.volatility);
  const allRets = allPortfolios.map(p => p.return);
  const minVol = Math.min(...allVols) * 0.9;
  const maxVol = Math.max(...allVols) * 1.1;
  const minRet = Math.min(...allRets) * 0.9;
  const maxRet = Math.max(...allRets) * 1.1;
  
  const scaleX = (vol: number) => padding + ((vol - minVol) / (maxVol - minVol)) * (chartWidth - 2 * padding);
  const scaleY = (ret: number) => chartHeight - padding - ((ret - minRet) / (maxRet - minRet)) * (chartHeight - 2 * padding);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-emerald-500/30"
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 bg-emerald-500/20 rounded-lg">
          <ArrowTrendingUpIcon className="w-5 h-5 sm:w-6 sm:h-6 text-emerald-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">{t("Efficient Frontier Optimizer")}</h3>
          <p className="text-xs text-gray-400">{t("Markowitz Mean-Variance Optimization")}</p>
        </div>
      </div>

      {/* Target Return Slider */}
      <div className="mb-4">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>{t("Target Return")}</span>
          <span className="text-emerald-400">{(targetReturn * 100).toFixed(1)}%</span>
        </div>
        <input
          type="range"
          min={0}
          max={0.5}
          step={0.01}
          value={targetReturn}
          onChange={(e) => setTargetReturn(Number(e.target.value))}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
        />
      </div>

      {/* Efficient Frontier Chart */}
      <div className="bg-gray-800/30 rounded-lg p-2 mb-4">
        <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-48">
          {/* Grid lines */}
          {[0.1, 0.2, 0.3, 0.4].map(vol => (
            <line
              key={`v-${vol}`}
              x1={scaleX(vol)}
              y1={padding}
              x2={scaleX(vol)}
              y2={chartHeight - padding}
              stroke="#374151"
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
          ))}
          {[-0.1, 0, 0.1, 0.2, 0.3, 0.4].map(ret => (
            <line
              key={`r-${ret}`}
              x1={padding}
              y1={scaleY(ret)}
              x2={chartWidth - padding}
              y2={scaleY(ret)}
              stroke="#374151"
              strokeWidth={0.5}
              strokeDasharray="2,2"
            />
          ))}
          
          {/* All portfolios (gray dots) */}
          {allPortfolios.map((p, i) => (
            <circle
              key={i}
              cx={scaleX(p.volatility)}
              cy={scaleY(p.return)}
              r={1.5}
              fill="#6b7280"
              opacity={0.3}
            />
          ))}
          
          {/* Efficient frontier line */}
          {frontierPoints.length > 1 && (
            <path
              d={frontierPoints
                .sort((a, b) => a.volatility - b.volatility)
                .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p.volatility)} ${scaleY(p.return)}`)
                .join(' ')}
              fill="none"
              stroke="#10b981"
              strokeWidth={2}
            />
          )}
          
          {/* Capital Market Line (from risk-free to tangency) */}
          <line
            x1={scaleX(0)}
            y1={scaleY(riskFreeRate)}
            x2={scaleX(maxSharpePortfolio.volatility * 1.5)}
            y2={scaleY(riskFreeRate + maxSharpePortfolio.sharpe * maxSharpePortfolio.volatility * 1.5)}
            stroke="#fbbf24"
            strokeWidth={1}
            strokeDasharray="4,2"
          />
          
          {/* Min Variance Portfolio */}
          <circle
            cx={scaleX(minVarPortfolio.volatility)}
            cy={scaleY(minVarPortfolio.return)}
            r={5}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={1}
          />
          
          {/* Max Sharpe Portfolio (Tangency) */}
          <circle
            cx={scaleX(maxSharpePortfolio.volatility)}
            cy={scaleY(maxSharpePortfolio.return)}
            r={6}
            fill="#fbbf24"
            stroke="white"
            strokeWidth={1}
          />
          
          {/* Target Portfolio */}
          <circle
            cx={scaleX(targetPortfolio.volatility)}
            cy={scaleY(targetPortfolio.return)}
            r={5}
            fill="#10b981"
            stroke="white"
            strokeWidth={1}
          />
          
          {/* Axis labels */}
          <text x={chartWidth / 2} y={chartHeight - 5} textAnchor="middle" fill="#9ca3af" fontSize="10">
            Volatility (σ)
          </text>
          <text x={10} y={chartHeight / 2} textAnchor="middle" fill="#9ca3af" fontSize="10" transform={`rotate(-90, 10, ${chartHeight / 2})`}>
            Return (μ)
          </text>
        </svg>
        
        <div className="flex justify-center gap-4 text-xs mt-2">
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-blue-500"></div> Min Variance
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-yellow-500"></div> Max Sharpe
          </span>
          <span className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full bg-emerald-500"></div> Target
          </span>
        </div>
      </div>

      {/* Portfolio Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-yellow-900/20 rounded p-2 border border-yellow-500/30">
          <p className="text-xs text-yellow-400">Max Sharpe</p>
          <p className="text-lg font-mono text-white">{maxSharpePortfolio.sharpe.toFixed(2)}</p>
          <p className="text-xs text-gray-500">{(maxSharpePortfolio.return * 100).toFixed(1)}% ret</p>
        </div>
        <div className="bg-emerald-900/20 rounded p-2 border border-emerald-500/30">
          <p className="text-xs text-emerald-400">Target Portfolio</p>
          <p className="text-lg font-mono text-white">{(targetPortfolio.return * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500">{(targetPortfolio.volatility * 100).toFixed(1)}% vol</p>
        </div>
        <div className="bg-blue-900/20 rounded p-2 border border-blue-500/30">
          <p className="text-xs text-blue-400">Min Variance</p>
          <p className="text-lg font-mono text-white">{(minVarPortfolio.volatility * 100).toFixed(1)}%</p>
          <p className="text-xs text-gray-500">{(minVarPortfolio.return * 100).toFixed(1)}% ret</p>
        </div>
      </div>

      {/* Optimal Weights */}
      <div>
        <p className="text-xs text-gray-500 mb-2">Max Sharpe Portfolio Weights:</p>
        <div className="grid grid-cols-6 gap-1">
          {symbols.map((symbol, i) => (
            <div key={symbol} className="text-center">
              <p className="text-xs text-gray-400">{symbol}</p>
              <p className="text-sm font-mono text-emerald-400">
                {(maxSharpePortfolio.weights[i] * 100).toFixed(0)}%
              </p>
            </div>
          ))}
        </div>
      </div>
      
      <p className="text-xs text-gray-500 mt-3 text-center">
        σₚ² = w'Σw | Sharpe = (μₚ - rғ) / σₚ | rғ = {(riskFreeRate * 100)}%
      </p>
    </motion.div>
  );
}

// ============================================================================
// PAIRS TRADING / MEAN REVERSION SCANNER WIDGET
// Cointegration analysis and spread z-scores
// ============================================================================

interface PairsTradingProps {
  candleData: Map<string, CandleData>;
  quotes: MarketQuote[];
}

interface PairAnalysis {
  symbol1: string;
  symbol2: string;
  correlation: number;
  spreadZScore: number;
  halfLife: number;
  signal: 'LONG_SPREAD' | 'SHORT_SPREAD' | 'NEUTRAL';
  spreadHistory: number[];
}

function PairsTradingScanner({ candleData, quotes }: PairsTradingProps) {
  const { t } = useTranslation();
  const [selectedPair, setSelectedPair] = useState<PairAnalysis | null>(null);

  // Analyze all pairs
  const pairsAnalysis = useMemo(() => {
    const symbols = ['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'JPM', 'AMD', 'NFLX'];
    const pairs: PairAnalysis[] = [];
    
    // Get price series for each symbol
    const priceMap: { [symbol: string]: number[] } = {};
    for (const symbol of symbols) {
      const candles = candleData.get(symbol);
      if (candles && candles.closes.length > 10) {
        priceMap[symbol] = candles.closes;
      }
    }
    
    const validSymbols = symbols.filter(s => priceMap[s]);
    
    // Analyze each pair
    for (let i = 0; i < validSymbols.length; i++) {
      for (let j = i + 1; j < validSymbols.length; j++) {
        const sym1 = validSymbols[i];
        const sym2 = validSymbols[j];
        const prices1 = priceMap[sym1];
        const prices2 = priceMap[sym2];
        
        const n = Math.min(prices1.length, prices2.length);
        if (n < 10) continue;
        
        // Calculate log returns for correlation
        const returns1 = calculateReturns(prices1.slice(0, n));
        const returns2 = calculateReturns(prices2.slice(0, n));
        const corr = correlation(returns1, returns2);
        
        // Calculate spread using log price ratio (stationary for cointegrated pairs)
        // Spread = log(P1) - β × log(P2), simplified as log(P1/P2)
        const spreadHistory: number[] = [];
        for (let k = 0; k < n; k++) {
          const logRatio = Math.log(prices1[k] / prices2[k]);
          spreadHistory.push(logRatio);
        }
        
        // Calculate spread statistics
        const spreadMean = mean(spreadHistory);
        const spreadStd = stdDev(spreadHistory);
        const currentSpread = spreadHistory[spreadHistory.length - 1];
        const spreadZScore = spreadStd > 0 ? (currentSpread - spreadMean) / spreadStd : 0;
        
        // Estimate half-life using Ornstein-Uhlenbeck process
        // ΔS(t) = θ(μ - S(t-1)) + ε
        // Half-life = ln(2) / θ
        let sumXY = 0;
        let sumX2 = 0;
        for (let k = 1; k < spreadHistory.length; k++) {
          const deltaS = spreadHistory[k] - spreadHistory[k - 1];
          const lagS = spreadHistory[k - 1] - spreadMean;
          sumXY += deltaS * lagS;
          sumX2 += lagS * lagS;
        }
        const theta = sumX2 > 0 ? -sumXY / sumX2 : 0;
        const halfLife = theta > 0 ? Math.log(2) / theta : 999;
        
        // Generate signal based on z-score
        let signal: 'LONG_SPREAD' | 'SHORT_SPREAD' | 'NEUTRAL' = 'NEUTRAL';
        if (spreadZScore < -2) {
          signal = 'LONG_SPREAD'; // Spread is low, expect it to increase (buy sym1, sell sym2)
        } else if (spreadZScore > 2) {
          signal = 'SHORT_SPREAD'; // Spread is high, expect it to decrease (sell sym1, buy sym2)
        }
        
        // Only include pairs with meaningful correlation and reasonable half-life
        if (Math.abs(corr) > 0.3 && halfLife < 30 && halfLife > 0) {
          pairs.push({
            symbol1: sym1,
            symbol2: sym2,
            correlation: corr,
            spreadZScore,
            halfLife,
            signal,
            spreadHistory: spreadHistory.slice(-30), // Last 30 days
          });
        }
      }
    }
    
    // Sort by absolute z-score (best trading opportunities first)
    pairs.sort((a, b) => Math.abs(b.spreadZScore) - Math.abs(a.spreadZScore));
    
    return pairs.slice(0, 10); // Top 10 pairs
  }, [candleData]);

  // Set default selected pair
  useEffect(() => {
    if (pairsAnalysis.length > 0 && !selectedPair) {
      setSelectedPair(pairsAnalysis[0]);
    }
  }, [pairsAnalysis, selectedPair]);

  const getSignalColor = (signal: string) => {
    switch (signal) {
      case 'LONG_SPREAD': return 'text-green-400 bg-green-500/20';
      case 'SHORT_SPREAD': return 'text-red-400 bg-red-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const getZScoreColor = (z: number) => {
    const absZ = Math.abs(z);
    if (absZ > 2) return 'text-red-400';
    if (absZ > 1) return 'text-yellow-400';
    return 'text-gray-400';
  };

  // Spread chart for selected pair
  const spreadChart = useMemo(() => {
    if (!selectedPair) return null;
    
    const { spreadHistory } = selectedPair;
    const spreadMean = mean(spreadHistory);
    const spreadStd = stdDev(spreadHistory);
    
    const chartWidth = 280;
    const chartHeight = 80;
    const padding = 10;
    
    const minSpread = Math.min(...spreadHistory);
    const maxSpread = Math.max(...spreadHistory);
    const range = maxSpread - minSpread || 1;
    
    const scaleX = (i: number) => padding + (i / (spreadHistory.length - 1)) * (chartWidth - 2 * padding);
    const scaleY = (s: number) => chartHeight - padding - ((s - minSpread) / range) * (chartHeight - 2 * padding);
    
    const pathD = spreadHistory.map((s, i) => 
      `${i === 0 ? 'M' : 'L'} ${scaleX(i).toFixed(1)} ${scaleY(s).toFixed(1)}`
    ).join(' ');
    
    return (
      <svg viewBox={`0 0 ${chartWidth} ${chartHeight}`} className="w-full h-20">
        {/* Mean line */}
        <line
          x1={padding}
          y1={scaleY(spreadMean)}
          x2={chartWidth - padding}
          y2={scaleY(spreadMean)}
          stroke="#6b7280"
          strokeWidth={1}
          strokeDasharray="4,2"
        />
        
        {/* ±1 std bands */}
        <rect
          x={padding}
          y={scaleY(spreadMean + spreadStd)}
          width={chartWidth - 2 * padding}
          height={scaleY(spreadMean - spreadStd) - scaleY(spreadMean + spreadStd)}
          fill="#22c55e"
          opacity={0.1}
        />
        
        {/* ±2 std lines */}
        <line
          x1={padding}
          y1={scaleY(spreadMean + 2 * spreadStd)}
          x2={chartWidth - padding}
          y2={scaleY(spreadMean + 2 * spreadStd)}
          stroke="#ef4444"
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
        <line
          x1={padding}
          y1={scaleY(spreadMean - 2 * spreadStd)}
          x2={chartWidth - padding}
          y2={scaleY(spreadMean - 2 * spreadStd)}
          stroke="#ef4444"
          strokeWidth={0.5}
          strokeDasharray="2,2"
        />
        
        {/* Spread line */}
        <path
          d={pathD}
          fill="none"
          stroke="#8b5cf6"
          strokeWidth={1.5}
        />
        
        {/* Current point */}
        <circle
          cx={scaleX(spreadHistory.length - 1)}
          cy={scaleY(spreadHistory[spreadHistory.length - 1])}
          r={4}
          fill="#8b5cf6"
          stroke="white"
          strokeWidth={1}
        />
      </svg>
    );
  }, [selectedPair]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-4 sm:p-6 border border-violet-500/30"
    >
      <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
        <div className="p-1.5 sm:p-2 bg-violet-500/20 rounded-lg">
          <ArrowPathIcon className="w-5 h-5 sm:w-6 sm:h-6 text-violet-400" />
        </div>
        <div>
          <h3 className="text-base sm:text-xl font-bold text-white">{t("Pairs Trading Scanner")}</h3>
          <p className="text-[10px] sm:text-xs text-gray-400">{t("Mean reversion & cointegration analysis")}</p>
        </div>
      </div>

      {pairsAnalysis.length === 0 ? (
        <div className="text-gray-400 text-center py-8 text-sm">{t("Analyzing pairs...")}</div>
      ) : (
        <>
          {/* Pairs List - Responsive */}
          <div className="mb-3 sm:mb-4 max-h-32 sm:max-h-40 overflow-y-auto">
            <table className="w-full text-[10px] sm:text-xs">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="text-gray-500">
                  <th className="text-left py-1">{t("Pair")}</th>
                  <th className="text-right py-1">ρ</th>
                  <th className="text-right py-1">Z-Score</th>
                  <th className="text-right py-1">Half-Life</th>
                  <th className="text-right py-1">Signal</th>
                </tr>
              </thead>
              <tbody>
                {pairsAnalysis.map((pair, idx) => (
                  <tr 
                    key={`${pair.symbol1}-${pair.symbol2}`}
                    onClick={() => setSelectedPair(pair)}
                    className={`cursor-pointer hover:bg-gray-800/50 ${
                      selectedPair?.symbol1 === pair.symbol1 && selectedPair?.symbol2 === pair.symbol2
                        ? 'bg-violet-500/20'
                        : ''
                    }`}
                  >
                    <td className="py-1 font-mono text-violet-300">
                      {pair.symbol1}/{pair.symbol2}
                    </td>
                    <td className="py-1 text-right text-gray-400">
                      {pair.correlation.toFixed(2)}
                    </td>
                    <td className={`py-1 text-right font-mono ${getZScoreColor(pair.spreadZScore)}`}>
                      {pair.spreadZScore >= 0 ? '+' : ''}{pair.spreadZScore.toFixed(2)}
                    </td>
                    <td className="py-1 text-right text-gray-400">
                      {pair.halfLife.toFixed(1)}d
                    </td>
                    <td className="py-1 text-right">
                      <span className={`px-1.5 py-0.5 rounded text-xs ${getSignalColor(pair.signal)}`}>
                        {pair.signal === 'LONG_SPREAD' ? 'LONG' : pair.signal === 'SHORT_SPREAD' ? 'SHORT' : '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Selected Pair Details */}
          {selectedPair && (
            <div className="bg-gray-800/30 rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <span className="font-mono text-violet-300 text-lg">
                  {selectedPair.symbol1} / {selectedPair.symbol2}
                </span>
                <span className={`px-2 py-1 rounded text-sm ${getSignalColor(selectedPair.signal)}`}>
                  {selectedPair.signal === 'LONG_SPREAD' 
                    ? `Buy ${selectedPair.symbol1}, Sell ${selectedPair.symbol2}`
                    : selectedPair.signal === 'SHORT_SPREAD'
                    ? `Sell ${selectedPair.symbol1}, Buy ${selectedPair.symbol2}`
                    : 'No Signal'}
                </span>
              </div>
              
              {/* Spread Chart */}
              <div className="mb-2">
                <p className="text-xs text-gray-500 mb-1">Spread (log ratio) - Last 30 days</p>
                {spreadChart}
              </div>
              
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-xs text-gray-500">Correlation</p>
                  <p className="font-mono text-white">{selectedPair.correlation.toFixed(3)}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Z-Score</p>
                  <p className={`font-mono ${getZScoreColor(selectedPair.spreadZScore)}`}>
                    {selectedPair.spreadZScore >= 0 ? '+' : ''}{selectedPair.spreadZScore.toFixed(2)}σ
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Half-Life</p>
                  <p className="font-mono text-white">{selectedPair.halfLife.toFixed(1)} days</p>
                </div>
              </div>
            </div>
          )}
          
          <p className="text-xs text-gray-500 mt-3 text-center">
            Z = (S - μ) / σ | Half-Life = ln(2) / θ (OU process) | Signal @ |Z| &gt; 2
          </p>
        </>
      )}
    </motion.div>
  );
}

// ============================================================================
// MAIN TRADING LAB PAGE
// Fetches ALL data once at mount, then uses cache
// ============================================================================

export default function TradingLab() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState(true);
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [candleData, setCandleData] = useState<Map<string, CandleData>>(new Map());
  const [error, setError] = useState<string | null>(null);

  // Fetch all data ONCE at mount
  useEffect(() => {
    let isMounted = true;

    async function loadAllData() {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🚀 Trading Lab: Loading all market data...');
        
        // Step 1: Fetch quote data (will use cache if available)
        await fetchAllMarketData();
        const allQuotes = getAllQuotes();
        console.log(`📈 Got ${allQuotes.length} quotes from cache`);
        
        // Step 2: Fetch candle data (will use cache if available)
        await fetchAllCandles();
        
        // Step 3: Build candle map from cache
        const symbols = ['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'JPM', 'AMD', 'NFLX'];
        const candleMap = new Map<string, CandleData>();
        
        for (const symbol of symbols) {
          const candle = getHistoricalCandles(symbol);
          if (candle) {
            candleMap.set(symbol, candle);
          }
        }
        console.log(`📊 Got ${candleMap.size} candle series from cache`);
        
        if (isMounted) {
          setQuotes(allQuotes);
          setCandleData(candleMap);
          console.log(`✅ Trading Lab: Loaded ${allQuotes.length} quotes, ${candleMap.size} candle series`);
          
          if (allQuotes.length === 0 && candleMap.size === 0) {
            setError('No market data available. Please check your connection.');
          }
        }
      } catch (err) {
        console.error('Failed to load Trading Lab data:', err);
        if (isMounted) {
          setError('Failed to load market data. Please try again.');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadAllData();
    
    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Feature Discovery & Shortcuts */}
      <FeatureDiscoveryHints />
      <ShortcutIndicator />
      
      {/* System Health Monitor */}
      <SystemHealthMonitor />
      
      {/* Terminal Easter Egg */}
      <TerminalEasterEgg />
      
      {/* Header - Responsive */}
      <div className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-1.5 sm:gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="text-sm sm:text-base">{t("Back to Portfolio")}</span>
          </Link>
          
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Terminal & Shortcuts Hint - Hidden on mobile */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-black/30 backdrop-blur-sm border border-gray-700/50 rounded-lg">
              <div className="flex items-center gap-1.5 text-gray-500 hover:text-cyan-400 transition-colors cursor-default">
                <span className="text-[11px] font-mono">terminal</span>
                <kbd className="px-1.5 py-0.5 bg-cyan-500/10 border border-cyan-500/30 rounded text-[10px] font-mono text-cyan-400">
                  `
                </kbd>
              </div>
              <div className="w-px h-3 bg-gray-700" />
              <div className="flex items-center gap-1.5 text-gray-500 hover:text-purple-400 transition-colors cursor-default">
                <span className="text-[11px] font-mono">shortcuts</span>
                <kbd className="px-1.5 py-0.5 bg-purple-500/10 border border-purple-500/30 rounded text-[10px] font-mono text-purple-400">
                  ?
                </kbd>
              </div>
            </div>
            
            {/* Animated button to Alpha Engine */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
            >
              <Link to="/alpha-engine">
                <button className="relative overflow-hidden px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-cyan-600 via-purple-600 to-pink-600 text-white text-xs sm:text-sm font-medium border-0 shadow-[0_0_15px_rgba(139,92,246,0.3)] hover:shadow-[0_0_25px_rgba(139,92,246,0.5)] transition-all duration-300">
                  <motion.span
                    className="absolute inset-0 bg-gradient-to-r from-cyan-400/30 via-purple-400/30 to-pink-400/30"
                    animate={{
                      x: ['-100%', '100%'],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear",
                    }}
                  />
                  <span className="relative z-10 flex items-center gap-1.5">
                    <CubeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Alpha Engine</span>
                    <span className="sm:hidden">Alpha</span>
                  </span>
                </button>
              </Link>
            </motion.div>
            
            {/* Live Status - Responsive */}
            <div className="flex items-center gap-2 sm:gap-3">
              <div className={`h-2 w-2 rounded-full ${isLoading ? 'bg-yellow-500' : error ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}></div>
              <span className="text-xs sm:text-sm text-gray-400 hidden sm:inline">
                {isLoading ? 'Loading data...' : error ? 'Error' : `Live Data: ${quotes.length} quotes, ${candleData.size} series`}
              </span>
              <span className="text-xs text-gray-400 sm:hidden">
                {isLoading ? 'Loading...' : error ? 'Error' : 'Live'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Hero - Responsive */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6 sm:mb-8"
        >
          <h1 className="text-2xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent mb-2 sm:mb-4">
            {t("Quant Sandbox")}
          </h1>
          <p className="text-sm sm:text-base text-gray-400 max-w-2xl mx-auto px-4">
            {t("Interactive quantitative finance tools powered by live market data. Explore correlations, volatility, and risk metrics in real-time.")}
          </p>
        </motion.div>
        
        {/* Live Crypto Ticker Tape - Bloomberg Style */}
        <div className="mb-4 sm:mb-8 -mx-4 sm:-mx-6">
          <LiveCryptoTickerTape />
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12 sm:py-20">
            <ArrowPathIcon className="w-8 h-8 sm:w-12 sm:h-12 text-cyan-400 animate-spin mb-4" />
            <p className="text-sm sm:text-base text-gray-400">{t("Loading market data from Finnhub...")}</p>
            <p className="text-xs text-gray-500 mt-2">{t("Fetching quotes and 30-day candles for all symbols")}</p>
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="text-center py-12 sm:py-20">
            <p className="text-red-400 mb-4 text-sm sm:text-base">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-cyan-500/20 text-cyan-300 rounded-lg hover:bg-cyan-500/30 transition-colors text-sm"
            >
              {t("Retry")}
            </button>
          </div>
        )}

        {/* Widgets Grid - All widgets visible on all screen sizes */}
        {!isLoading && !error && (
          <>
            {/* FEATURED: Market Microstructure Dashboard (Crypto Real-Time Data) */}
            <div className="mb-4 sm:mb-6">
              <MarketMicrostructureDashboard />
            </div>
            
            {/* Real-Time Volatility Monitor */}
            <div className="mb-4 sm:mb-6">
              <RealTimeVolatilityMonitor />
            </div>
            
            {/* Trade Signals - Multi-Strategy Real-Time Order Flow Analysis */}
            <div className="mb-4 sm:mb-6">
              <TradeSignalDashboard />
            </div>

            {/* Algorithm Backtest Lab - Trading Strategy Backtester */}
            <div className="mb-4 sm:mb-6">
              <AlgorithmBacktestLab />
            </div>
            
            {/* Phase 1 Widgets - Stack on mobile, side by side on desktop */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <LiveCorrelationHeatmap candleData={candleData} />
              <LiveVolatilitySurface candleData={candleData} quotes={quotes} />
            </div>
            
            {/* Monte Carlo - Full Width */}
            <div className="mb-4 sm:mb-6">
              <MonteCarloSimulator candleData={candleData} quotes={quotes} />
            </div>

            {/* Phase 2 Widgets - Stack on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <LivePortfolioTracker quotes={quotes} />
              <LiveVaRDashboard candleData={candleData} quotes={quotes} />
            </div>

            {/* Options Payoff - Full Width */}
            <div className="mb-4 sm:mb-6">
              <OptionsPayoffBuilder quotes={quotes} />
            </div>

            {/* Phase 3 Widgets - Advanced Analytics - Stack on mobile */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
              <EfficientFrontierOptimizer candleData={candleData} quotes={quotes} />
              <PairsTradingScanner candleData={candleData} quotes={quotes} />
            </div>
          </>
        )}

        {/* Footer - Responsive */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-8 sm:mt-12 text-center"
        >
          <p className="text-gray-500 text-xs sm:text-sm px-4">
            {t("All calculations use live market data from Finnhub API & Binance WebSocket")} • {t("Built by Shadaab Ahmed")}
          </p>
        </motion.div>
      </div>
      
      {/* Scroll to Top Button */}
      <ScrollToTop />
    </div>
  );
}
