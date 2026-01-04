import React, { useState, useEffect, useMemo } from 'react';
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
import { getHistoricalCandles, getAllQuotes, fetchAllMarketData, MarketQuote } from '../services/marketData';

// ============================================================================
// UTILITY FUNCTIONS - Calculate metrics from LIVE data
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
// ============================================================================

interface CorrelationData {
  symbols: string[];
  matrix: number[][];
  returns: { [symbol: string]: number[] };
}

function LiveCorrelationHeatmap() {
  const [correlationData, setCorrelationData] = useState<CorrelationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA']);
  
  const allSymbols = ['SPY', 'QQQ', 'DIA', 'IWM', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'JPM', 'GS', 'BAC', 'AMD', 'INTC', 'NFLX'];

  useEffect(() => {
    async function loadCorrelations() {
      setLoading(true);
      setError(null);
      
      try {
        // Fetch all market data first
        await fetchAllMarketData();
        
        // Get historical candles for each selected symbol (must await - it's a Promise!)
        const returnsMap: { [symbol: string]: number[] } = {};
        
        for (const symbol of selectedSymbols) {
          const candles = await getHistoricalCandles(symbol);
          if (candles && candles.closes.length > 1) {
            returnsMap[symbol] = calculateReturns(candles.closes);
          }
        }
        
        // Build correlation matrix
        const validSymbols = selectedSymbols.filter(s => returnsMap[s] && returnsMap[s].length > 5);
        const n = validSymbols.length;
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
        
        setCorrelationData({
          symbols: validSymbols,
          matrix,
          returns: returnsMap
        });
      } catch (err) {
        setError('Failed to load correlation data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    
    loadCorrelations();
  }, [selectedSymbols]);

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
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-cyan-500/30"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-cyan-500/20 rounded-lg">
          <ChartBarIcon className="w-6 h-6 text-cyan-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Live Correlation Matrix</h3>
          <p className="text-xs text-gray-400">Calculated from 30-day returns via Finnhub API</p>
        </div>
      </div>

      {/* Symbol selector */}
      <div className="mb-4">
        <p className="text-xs text-gray-500 mb-2">Select assets (2-8):</p>
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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <ArrowPathIcon className="w-8 h-8 text-cyan-400 animate-spin" />
          <span className="ml-2 text-gray-400">Loading live data...</span>
        </div>
      ) : error ? (
        <div className="text-red-400 text-center py-8">{error}</div>
      ) : correlationData ? (
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
      ) : null}
    </motion.div>
  );
}

// ============================================================================
// LIVE VOLATILITY SURFACE WIDGET
// ============================================================================

interface VolatilityData {
  symbol: string;
  dailyVol: number;
  annualizedVol: number;
  price: number;
  change: number;
  returns: number[];
}

function LiveVolatilitySurface() {
  const [volData, setVolData] = useState<VolatilityData[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<'vol' | 'symbol' | 'change'>('vol');

  useEffect(() => {
    async function loadVolatilities() {
      setLoading(true);
      
      try {
        await fetchAllMarketData();
        const quotes = getAllQuotes();
        
        const symbols = ['SPY', 'QQQ', 'AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'JPM', 'AMD', 'NFLX'];
        const data: VolatilityData[] = [];
        
        for (const symbol of symbols) {
          const candles = await getHistoricalCandles(symbol);
          const quote = quotes.find(q => q.symbol === symbol);
          
          if (candles && candles.closes.length > 1 && quote) {
            const returns = calculateReturns(candles.closes);
            const dailyVol = stdDev(returns);
            const annualVol = annualizedVolatility(returns);
            
            data.push({
              symbol,
              dailyVol,
              annualizedVol: annualVol,
              price: quote.price,
              change: quote.change,
              returns
            });
          }
        }
        
        setVolData(data);
      } catch (err) {
        console.error('Failed to load volatility data:', err);
      } finally {
        setLoading(false);
      }
    }
    
    loadVolatilities();
  }, []);

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
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-purple-500/30"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <ArrowTrendingUpIcon className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Live Volatility Surface</h3>
            <p className="text-xs text-gray-400">30-day realized volatility (annualized)</p>
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

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <ArrowPathIcon className="w-8 h-8 text-purple-400 animate-spin" />
        </div>
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
// ============================================================================

function MonteCarloSimulator() {
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
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  const symbols = ['AAPL', 'GOOGL', 'MSFT', 'NVDA', 'TSLA', 'AMZN', 'META', 'SPY', 'QQQ'];

  useEffect(() => {
    async function loadData() {
      await fetchAllMarketData();
      setDataLoaded(true);
    }
    loadData();
  }, []);

  const runSimulation = async () => {
    if (!dataLoaded) return;
    
    setLoading(true);
    
    try {
      const candles = await getHistoricalCandles(selectedSymbol);
      const quotes = getAllQuotes();
      const quote = quotes.find(q => q.symbol === selectedSymbol);
      
      if (!candles || !quote || candles.closes.length < 5) {
        setLoading(false);
        return;
      }
      
      const returns = calculateReturns(candles.closes);
      const dailyVol = stdDev(returns);
      const dailyMu = mean(returns);
      const spotPrice = quote.price;
      
      // Generate paths using Geometric Brownian Motion
      // dS = μ*S*dt + σ*S*dW
      const dt = 1 / 252; // Daily time step
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
      
      const var95Index = Math.floor(numPaths * 0.05);
      const var99Index = Math.floor(numPaths * 0.01);
      
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
      
      setLoading(false);
    } catch (error) {
      console.error('Simulation error:', error);
      setLoading(false);
    }
  };

  // Mini chart for paths
  const renderPaths = () => {
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
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-gray-900/80 backdrop-blur-xl rounded-2xl p-6 border border-amber-500/30"
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <CubeIcon className="w-6 h-6 text-amber-400" />
        </div>
        <div>
          <h3 className="text-xl font-bold text-white">Monte Carlo Simulator</h3>
          <p className="text-xs text-gray-400">GBM with live realized volatility</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div>
          <label className="text-xs text-gray-500 block mb-1">Asset</label>
          <select
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value)}
            className="w-full px-2 py-1.5 bg-gray-800/50 border border-gray-700 rounded text-white text-sm focus:border-amber-500/50 focus:outline-none"
          >
            {symbols.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        
        <div>
          <label className="text-xs text-gray-500 block mb-1">Paths</label>
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
        disabled={loading || !dataLoaded}
        className="w-full py-2 mb-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50"
      >
        {loading ? (
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
          {renderPaths()}
          
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
              <p className="text-xs text-red-400">VaR 95% (1-day equiv.)</p>
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
// MAIN TRADING LAB PAGE
// ============================================================================

export default function TradingLab() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link 
            to="/" 
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            <span>Back to Portfolio</span>
          </Link>
          
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
            <span className="text-sm text-gray-400">Live Data from Finnhub</span>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 bg-clip-text text-transparent mb-4">
            Trading Lab
          </h1>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Interactive quantitative finance tools powered by live market data.
            Explore correlations, volatility, and risk metrics in real-time.
          </p>
        </motion.div>

        {/* Widgets Grid - Phase 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <LiveCorrelationHeatmap />
          <LiveVolatilitySurface />
          <div className="lg:col-span-2">
            <MonteCarloSimulator />
          </div>
        </div>

        {/* Coming Soon */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-500 text-sm">
            More tools coming soon: Portfolio Optimizer, VaR Dashboard, Options Payoff Builder
          </p>
        </motion.div>
      </div>
    </div>
  );
}
