import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  createChart, 
  ColorType, 
  CandlestickSeries, 
  HistogramSeries, 
  LineSeries,
  createSeriesMarkers,
} from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, SeriesMarker } from 'lightweight-charts';
import { useTranslation } from '@/i18n';

// ============================================================================
// ALGORITHM BACKTEST LAB - Full-Featured Trading Strategy Backtester
// Features:
// - TradingView-style candlestick chart with real-time Binance data
// - 5 configurable strategy templates
// - Full backtest engine with performance metrics
// - Trade log with entry/exit visualization
// - Equity curve with drawdown shading
// - Responsive design for mobile/desktop
// ============================================================================

// Types
interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface Trade {
  id: number;
  type: 'BUY' | 'SELL';
  entryPrice: number;
  exitPrice: number | null;
  entryTime: number;
  exitTime: number | null;
  quantity: number;
  pnl: number | null;
  pnlPercent: number | null;
  reason: string;
}

interface BacktestResult {
  trades: Trade[];
  equityCurve: { time: number; value: number }[];
  metrics: PerformanceMetrics;
}

interface PerformanceMetrics {
  totalReturn: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  winRate: number;
  profitFactor: number;
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  avgWin: number;
  avgLoss: number;
  largestWin: number;
  largestLoss: number;
  calmarRatio: number;
}

interface StrategyParams {
  maFast: number;
  maSlow: number;
  rsiPeriod: number;
  rsiOversold: number;
  rsiOverbought: number;
  bbPeriod: number;
  bbStdDev: number;
  macdFast: number;
  macdSlow: number;
  macdSignal: number;
  momentumPeriod: number;
  momentumThreshold: number;
}

type StrategyType = 'ma_crossover' | 'rsi_reversal' | 'bollinger_breakout' | 'macd' | 'momentum';

// Available crypto pairs
const CRYPTO_PAIRS = [
  { symbol: 'BTCUSDT', name: 'Bitcoin' },
  { symbol: 'ETHUSDT', name: 'Ethereum' },
  { symbol: 'BNBUSDT', name: 'BNB' },
  { symbol: 'SOLUSDT', name: 'Solana' },
  { symbol: 'XRPUSDT', name: 'XRP' },
  { symbol: 'DOGEUSDT', name: 'Dogecoin' },
  { symbol: 'ADAUSDT', name: 'Cardano' },
  { symbol: 'AVAXUSDT', name: 'Avalanche' },
];

// Timeframes for candles
const TIMEFRAMES = [
  { value: '1m', label: '1 Min', minutes: 1 },
  { value: '5m', label: '5 Min', minutes: 5 },
  { value: '15m', label: '15 Min', minutes: 15 },
  { value: '1h', label: '1 Hour', minutes: 60 },
  { value: '4h', label: '4 Hour', minutes: 240 },
  { value: '1d', label: '1 Day', minutes: 1440 },
];

// Strategy definitions
const STRATEGIES: { type: StrategyType; name: string; description: string; icon: string }[] = [
  { type: 'ma_crossover', name: 'MA Crossover', description: 'Buy when fast MA crosses above slow MA', icon: '📈' },
  { type: 'rsi_reversal', name: 'RSI Mean Reversion', description: 'Buy oversold, sell overbought', icon: '🔄' },
  { type: 'bollinger_breakout', name: 'Bollinger Bands', description: 'Trade on band breakouts', icon: '📊' },
  { type: 'macd', name: 'MACD', description: 'MACD signal line crossover', icon: '⚡' },
  { type: 'momentum', name: 'Momentum', description: 'Buy strong upward momentum', icon: '🚀' },
];

// ============================================================================
// TECHNICAL INDICATOR CALCULATIONS
// ============================================================================

function calculateSMA(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
    } else {
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / period);
    }
  }
  return result;
}

function calculateEMA(data: number[], period: number): number[] {
  const result: number[] = [];
  const multiplier = 2 / (period + 1);
  
  for (let i = 0; i < data.length; i++) {
    if (i === 0) {
      result.push(data[0]);
    } else if (i < period) {
      // Use SMA for initial values
      const sum = data.slice(0, i + 1).reduce((a, b) => a + b, 0);
      result.push(sum / (i + 1));
    } else {
      result.push((data[i] - result[i - 1]) * multiplier + result[i - 1]);
    }
  }
  return result;
}

function calculateRSI(closes: number[], period: number = 14): number[] {
  const result: number[] = [];
  const gains: number[] = [];
  const losses: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) {
      result.push(50);
      continue;
    }
    
    const change = closes[i] - closes[i - 1];
    gains.push(change > 0 ? change : 0);
    losses.push(change < 0 ? -change : 0);
    
    if (i < period) {
      result.push(50);
      continue;
    }
    
    const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
    const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
    
    if (avgLoss === 0) {
      result.push(100);
    } else {
      const rs = avgGain / avgLoss;
      result.push(100 - (100 / (1 + rs)));
    }
  }
  return result;
}

function calculateBollingerBands(closes: number[], period: number = 20, stdDev: number = 2): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = calculateSMA(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      const slice = closes.slice(i - period + 1, i + 1);
      const mean = middle[i];
      const variance = slice.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / period;
      const std = Math.sqrt(variance);
      upper.push(mean + stdDev * std);
      lower.push(mean - stdDev * std);
    }
  }
  
  return { upper, middle, lower };
}

function calculateMACD(closes: number[], fast: number = 12, slow: number = 26, signal: number = 9): { macd: number[]; signal: number[]; histogram: number[] } {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);
  const macdLine: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    macdLine.push(emaFast[i] - emaSlow[i]);
  }
  
  const signalLine = calculateEMA(macdLine, signal);
  const histogram: number[] = [];
  
  for (let i = 0; i < closes.length; i++) {
    histogram.push(macdLine[i] - signalLine[i]);
  }
  
  return { macd: macdLine, signal: signalLine, histogram };
}

function calculateMomentum(closes: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period) {
      result.push(0);
    } else {
      result.push(((closes[i] - closes[i - period]) / closes[i - period]) * 100);
    }
  }
  return result;
}

// ============================================================================
// BACKTEST ENGINE
// ============================================================================

function runBacktest(
  candles: Candle[],
  strategy: StrategyType,
  params: StrategyParams,
  initialCapital: number = 10000,
  timeframeMinutes: number = 60 // Default to 1h
): BacktestResult {
  const closes = candles.map(c => c.close);
  const trades: Trade[] = [];
  const equityCurve: { time: number; value: number }[] = [];
  
  let capital = initialCapital;
  let position: 'long' | 'flat' = 'flat';
  let entryPrice = 0;
  let entryTime = 0;
  let tradeId = 0;
  
  // Calculate indicators based on strategy
  let signals: ('BUY' | 'SELL' | 'HOLD')[] = [];
  
  switch (strategy) {
    case 'ma_crossover': {
      const fastMA = calculateSMA(closes, params.maFast);
      const slowMA = calculateSMA(closes, params.maSlow);
      signals = closes.map((_, i) => {
        if (i < params.maSlow) return 'HOLD';
        const prevFast = fastMA[i - 1];
        const prevSlow = slowMA[i - 1];
        const currFast = fastMA[i];
        const currSlow = slowMA[i];
        if (prevFast <= prevSlow && currFast > currSlow) return 'BUY';
        if (prevFast >= prevSlow && currFast < currSlow) return 'SELL';
        return 'HOLD';
      });
      break;
    }
    case 'rsi_reversal': {
      const rsi = calculateRSI(closes, params.rsiPeriod);
      signals = rsi.map((val, i) => {
        if (i < params.rsiPeriod) return 'HOLD';
        const prevRsi = rsi[i - 1];
        if (prevRsi < params.rsiOversold && val >= params.rsiOversold) return 'BUY';
        if (prevRsi > params.rsiOverbought && val <= params.rsiOverbought) return 'SELL';
        return 'HOLD';
      });
      break;
    }
    case 'bollinger_breakout': {
      const bb = calculateBollingerBands(closes, params.bbPeriod, params.bbStdDev);
      signals = closes.map((price, i) => {
        if (i < params.bbPeriod) return 'HOLD';
        const prevPrice = closes[i - 1];
        if (prevPrice <= bb.lower[i - 1] && price > bb.lower[i]) return 'BUY';
        if (prevPrice >= bb.upper[i - 1] && price < bb.upper[i]) return 'SELL';
        return 'HOLD';
      });
      break;
    }
    case 'macd': {
      const macd = calculateMACD(closes, params.macdFast, params.macdSlow, params.macdSignal);
      signals = closes.map((_, i) => {
        if (i < params.macdSlow + params.macdSignal) return 'HOLD';
        const prevHist = macd.histogram[i - 1];
        const currHist = macd.histogram[i];
        if (prevHist <= 0 && currHist > 0) return 'BUY';
        if (prevHist >= 0 && currHist < 0) return 'SELL';
        return 'HOLD';
      });
      break;
    }
    case 'momentum': {
      const mom = calculateMomentum(closes, params.momentumPeriod);
      signals = mom.map((val, i) => {
        if (i < params.momentumPeriod) return 'HOLD';
        const prevMom = mom[i - 1];
        if (prevMom <= params.momentumThreshold && val > params.momentumThreshold) return 'BUY';
        if (prevMom >= -params.momentumThreshold && val < -params.momentumThreshold) return 'SELL';
        return 'HOLD';
      });
      break;
    }
  }
  
  // Execute trades
  let entryQuantity = 0; // Track quantity at entry
  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const signal = signals[i];
    
    if (position === 'flat' && signal === 'BUY') {
      position = 'long';
      entryPrice = candle.close;
      entryTime = candle.time;
      entryQuantity = capital / entryPrice; // Calculate quantity at entry
      tradeId++;
    } else if (position === 'long' && signal === 'SELL') {
      const exitPrice = candle.close;
      const pnl = (exitPrice - entryPrice) * entryQuantity; // Use entry quantity
      const pnlPercent = ((exitPrice - entryPrice) / entryPrice) * 100;
      
      trades.push({
        id: tradeId,
        type: 'BUY',
        entryPrice,
        exitPrice,
        entryTime,
        exitTime: candle.time,
        quantity: entryQuantity, // Use entry quantity
        pnl,
        pnlPercent,
        reason: `${strategy} signal`,
      });
      
      capital += pnl; // Update capital after recording trade
      position = 'flat';
    }
    
    equityCurve.push({ time: candle.time, value: position === 'long' ? capital * (candle.close / entryPrice) : capital });
  }
  
  // Close any open position at the end
  if (position === 'long') {
    const lastCandle = candles[candles.length - 1];
    const pnl = (lastCandle.close - entryPrice) * entryQuantity; // Use entry quantity
    const pnlPercent = ((lastCandle.close - entryPrice) / entryPrice) * 100;
    trades.push({
      id: tradeId,
      type: 'BUY',
      entryPrice,
      exitPrice: lastCandle.close,
      entryTime,
      exitTime: lastCandle.time,
      quantity: entryQuantity, // Use entry quantity
      pnl,
      pnlPercent,
      reason: 'End of backtest',
    });
  }
  
  // Calculate metrics with timeframe for proper annualization
  const metrics = calculatePerformanceMetrics(trades, equityCurve, initialCapital, timeframeMinutes);
  
  return { trades, equityCurve, metrics };
}

function calculatePerformanceMetrics(
  trades: Trade[],
  equityCurve: { time: number; value: number }[],
  initialCapital: number,
  timeframeMinutes: number = 60
): PerformanceMetrics {
  const completedTrades = trades.filter(t => t.pnl !== null);
  const winningTrades = completedTrades.filter(t => (t.pnl ?? 0) > 0);
  const losingTrades = completedTrades.filter(t => (t.pnl ?? 0) <= 0);
  
  const totalPnl = completedTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const totalReturn = (totalPnl / initialCapital) * 100;
  
  const winRate = completedTrades.length > 0 ? (winningTrades.length / completedTrades.length) * 100 : 0;
  
  const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
  const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl ?? 0), 0));
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;
  
  const avgWin = winningTrades.length > 0 ? grossProfit / winningTrades.length : 0;
  const avgLoss = losingTrades.length > 0 ? grossLoss / losingTrades.length : 0;
  
  const largestWin = winningTrades.length > 0 ? Math.max(...winningTrades.map(t => t.pnl ?? 0)) : 0;
  const largestLoss = losingTrades.length > 0 ? Math.min(...losingTrades.map(t => t.pnl ?? 0)) : 0;
  
  // Max Drawdown
  let maxDrawdown = 0;
  let peak = equityCurve[0]?.value ?? initialCapital;
  for (const point of equityCurve) {
    if (point.value > peak) peak = point.value;
    const drawdown = ((peak - point.value) / peak) * 100;
    if (drawdown > maxDrawdown) maxDrawdown = drawdown;
  }
  
  // Calculate returns for Sharpe/Sortino
  const returns: number[] = [];
  for (let i = 1; i < equityCurve.length; i++) {
    returns.push((equityCurve[i].value - equityCurve[i - 1].value) / equityCurve[i - 1].value);
  }
  
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
  const stdDev = returns.length > 0 ? Math.sqrt(returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length) : 0;
  
  // Correct downside deviation: only negative returns, divided by count of negative returns
  const negativeReturns = returns.filter(r => r < 0);
  const downDev = negativeReturns.length > 0 
    ? Math.sqrt(negativeReturns.reduce((sum, r) => sum + r * r, 0) / negativeReturns.length) 
    : 0;
  
  // Calculate annualization factor based on timeframe
  // Periods per year = (365 days * 24 hours * 60 minutes) / timeframeMinutes
  const periodsPerYear = (365 * 24 * 60) / timeframeMinutes;
  const annualFactor = Math.sqrt(periodsPerYear);
  
  const sharpeRatio = stdDev > 0 ? (avgReturn / stdDev) * annualFactor : 0;
  const sortinoRatio = downDev > 0 ? (avgReturn / downDev) * annualFactor : 0;
  const calmarRatio = maxDrawdown > 0 ? totalReturn / maxDrawdown : 0;
  
  return {
    totalReturn,
    sharpeRatio,
    sortinoRatio,
    maxDrawdown,
    winRate,
    profitFactor,
    totalTrades: completedTrades.length,
    winningTrades: winningTrades.length,
    losingTrades: losingTrades.length,
    avgWin,
    avgLoss,
    largestWin,
    largestLoss,
    calmarRatio,
  };
}

// ============================================================================
// BINANCE DATA FETCHING
// ============================================================================

async function fetchHistoricalCandles(symbol: string, interval: string, limit: number = 500): Promise<Candle[]> {
  try {
    const response = await fetch(
      `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    );
    const data = await response.json();
    
    return data.map((k: any[]) => ({
      time: Math.floor(k[0] / 1000), // Convert to seconds
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }));
  } catch (error) {
    console.error('Failed to fetch candles:', error);
    return [];
  }
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function AlgorithmBacktestLab() {
  const { t } = useTranslation();
  
  // State
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('ma_crossover');
  const [isLoading, setIsLoading] = useState(true);
  const [isRunningBacktest, setIsRunningBacktest] = useState(false);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [isLiveMode, setIsLiveMode] = useState(false);
  const [showTradeLog, setShowTradeLog] = useState(false);
  
  // Strategy parameters
  const [params, setParams] = useState<StrategyParams>({
    maFast: 10,
    maSlow: 30,
    rsiPeriod: 14,
    rsiOversold: 30,
    rsiOverbought: 70,
    bbPeriod: 20,
    bbStdDev: 2,
    macdFast: 12,
    macdSlow: 26,
    macdSignal: 9,
    momentumPeriod: 10,
    momentumThreshold: 2,
  });
  
  // Chart refs
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);
  const maFastSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const maSlowSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const isChartDisposed = useRef(false);
  
  // WebSocket ref for live data
  const wsRef = useRef<WebSocket | null>(null);
  
  // Fetch historical data
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      const data = await fetchHistoricalCandles(selectedSymbol, selectedTimeframe, 500);
      setCandles(data);
      setIsLoading(false);
    };
    loadData();
  }, [selectedSymbol, selectedTimeframe]);
  
  // Initialize chart
  useEffect(() => {
    if (!chartContainerRef.current || candles.length === 0) return;
    
    // Reset disposal flag
    isChartDisposed.current = false;
    
    // Clear previous chart safely
    if (chartRef.current) {
      try {
        chartRef.current.remove();
      } catch {
        // Chart already disposed
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      maFastSeriesRef.current = null;
      maSlowSeriesRef.current = null;
    }
    
    // Create chart with v5 API - TradingView-style dark theme
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: '#131722' },
        textColor: '#787b86',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      },
      grid: {
        vertLines: { color: '#1e222d' },
        horzLines: { color: '#1e222d' },
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#2a2e39' },
        horzLine: { color: '#758696', width: 1, style: 3, labelBackgroundColor: '#2a2e39' },
      },
      rightPriceScale: {
        borderColor: '#2a2e39',
        scaleMargins: { top: 0.1, bottom: 0.2 },
      },
      timeScale: {
        borderColor: '#2a2e39',
        timeVisible: true,
        secondsVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });
    
    chartRef.current = chart;
    
    // Add candlestick series using v5 API
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#22c55e',
      downColor: '#ef4444',
      borderDownColor: '#ef4444',
      borderUpColor: '#22c55e',
      wickDownColor: '#ef4444',
      wickUpColor: '#22c55e',
    });
    candleSeriesRef.current = candleSeries as any;
    
    // Add volume series using v5 API
    const volumeSeries = chart.addSeries(HistogramSeries, {
      color: '#6366f1',
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: { top: 0.85, bottom: 0 },
    });
    volumeSeriesRef.current = volumeSeries as any;
    
    // Set candlestick data
    const candleData = candles.map(c => ({
      time: c.time as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    candleSeries.setData(candleData);
    
    // Set volume data
    const volumeData = candles.map(c => ({
      time: c.time as Time,
      value: c.volume,
      color: c.close >= c.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
    }));
    volumeSeries.setData(volumeData);
    
    // Add MA lines if MA crossover strategy
    if (selectedStrategy === 'ma_crossover') {
      const closes = candles.map(c => c.close);
      const fastMA = calculateSMA(closes, params.maFast);
      const slowMA = calculateSMA(closes, params.maSlow);
      
      const maFastSeries = chart.addSeries(LineSeries, {
        color: '#22d3ee',
        lineWidth: 2,
        title: `MA${params.maFast}`,
      });
      maFastSeriesRef.current = maFastSeries as any;
      
      const maSlowSeries = chart.addSeries(LineSeries, {
        color: '#f472b6',
        lineWidth: 2,
        title: `MA${params.maSlow}`,
      });
      maSlowSeriesRef.current = maSlowSeries as any;
      
      const fastData = candles
        .map((c, i) => ({ time: c.time as Time, value: fastMA[i] }))
        .filter(d => !isNaN(d.value));
      const slowData = candles
        .map((c, i) => ({ time: c.time as Time, value: slowMA[i] }))
        .filter(d => !isNaN(d.value));
      
      maFastSeries.setData(fastData);
      maSlowSeries.setData(slowData);
    }
    
    // Add trade markers if backtest result exists - v5 uses createSeriesMarkers
    if (backtestResult) {
      const buyMarkers: SeriesMarker<Time>[] = backtestResult.trades.map(trade => ({
        time: trade.entryTime as Time,
        position: 'belowBar',
        color: '#22c55e',
        shape: 'arrowUp',
        text: 'BUY',
      }));
      
      const sellMarkers: SeriesMarker<Time>[] = backtestResult.trades
        .filter(t => t.exitTime)
        .map(trade => ({
          time: trade.exitTime as Time,
          position: 'aboveBar',
          color: '#ef4444',
          shape: 'arrowDown',
          text: 'SELL',
        }));
      
      const allMarkers = [...buyMarkers, ...sellMarkers].sort((a, b) => 
        (a.time as number) - (b.time as number)
      );
      
      // v5 API: use createSeriesMarkers plugin
      createSeriesMarkers(candleSeries, allMarkers);
    }
    
    // Fit content
    chart.timeScale().fitContent();
    
    // Handle resize
    const handleResize = () => {
      if (isChartDisposed.current) return;
      if (chartContainerRef.current && chartRef.current) {
        try {
          chartRef.current.applyOptions({
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight,
          });
        } catch {
          // Chart disposed, ignore
        }
      }
    };
    
    window.addEventListener('resize', handleResize);
    handleResize();
    
    return () => {
      window.removeEventListener('resize', handleResize);
      isChartDisposed.current = true;
      try {
        chart.remove();
      } catch {
        // Already disposed
      }
      chartRef.current = null;
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      maFastSeriesRef.current = null;
      maSlowSeriesRef.current = null;
    };
  }, [candles, selectedStrategy, params.maFast, params.maSlow, backtestResult]);
  
  // WebSocket for live data
  useEffect(() => {
    if (!isLiveMode) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      return;
    }
    
    const ws = new WebSocket(`wss://stream.binance.com:9443/ws/${selectedSymbol.toLowerCase()}@kline_${selectedTimeframe}`);
    wsRef.current = ws;
    
    ws.onmessage = (event) => {
      // Guard against disposed chart
      if (isChartDisposed.current) return;
      
      const data = JSON.parse(event.data);
      if (data.k) {
        const kline = data.k;
        const newCandle: Candle = {
          time: Math.floor(kline.t / 1000),
          open: parseFloat(kline.o),
          high: parseFloat(kline.h),
          low: parseFloat(kline.l),
          close: parseFloat(kline.c),
          volume: parseFloat(kline.v),
        };
        
        // Update chart with try-catch for disposed series
        try {
          if (candleSeriesRef.current) {
            candleSeriesRef.current.update({
              time: newCandle.time as Time,
              open: newCandle.open,
              high: newCandle.high,
              low: newCandle.low,
              close: newCandle.close,
            });
          }
          
          if (volumeSeriesRef.current) {
            volumeSeriesRef.current.update({
              time: newCandle.time as Time,
              value: newCandle.volume,
              color: newCandle.close >= newCandle.open ? 'rgba(34, 197, 94, 0.3)' : 'rgba(239, 68, 68, 0.3)',
            });
          }
        } catch {
          // Chart disposed, ignore update
        }
      }
    };
    
    return () => {
      ws.close();
    };
  }, [isLiveMode, selectedSymbol, selectedTimeframe]);
  
  // Run backtest
  const handleRunBacktest = useCallback(() => {
    if (candles.length === 0) return;
    
    setIsRunningBacktest(true);
    
    // Get timeframe minutes for proper annualization
    const timeframeConfig = TIMEFRAMES.find(tf => tf.value === selectedTimeframe);
    const timeframeMinutes = timeframeConfig?.minutes ?? 60;
    
    // Use setTimeout to allow UI to update
    setTimeout(() => {
      const result = runBacktest(candles, selectedStrategy, params, 10000, timeframeMinutes);
      setBacktestResult(result);
      setIsRunningBacktest(false);
    }, 100);
  }, [candles, selectedStrategy, params, selectedTimeframe]);
  
  // Strategy parameter controls
  const renderStrategyParams = () => {
    switch (selectedStrategy) {
      case 'ma_crossover':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Fast MA Period: {params.maFast}</label>
              <input
                type="range"
                min="5"
                max="50"
                value={params.maFast}
                onChange={(e) => setParams(p => ({ ...p, maFast: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Slow MA Period: {params.maSlow}</label>
              <input
                type="range"
                min="20"
                max="200"
                value={params.maSlow}
                onChange={(e) => setParams(p => ({ ...p, maSlow: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-pink-500"
              />
            </div>
          </div>
        );
      case 'rsi_reversal':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">RSI Period: {params.rsiPeriod}</label>
              <input
                type="range"
                min="7"
                max="21"
                value={params.rsiPeriod}
                onChange={(e) => setParams(p => ({ ...p, rsiPeriod: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Oversold Level: {params.rsiOversold}</label>
              <input
                type="range"
                min="20"
                max="40"
                value={params.rsiOversold}
                onChange={(e) => setParams(p => ({ ...p, rsiOversold: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-green-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Overbought Level: {params.rsiOverbought}</label>
              <input
                type="range"
                min="60"
                max="80"
                value={params.rsiOverbought}
                onChange={(e) => setParams(p => ({ ...p, rsiOverbought: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-red-500"
              />
            </div>
          </div>
        );
      case 'bollinger_breakout':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">BB Period: {params.bbPeriod}</label>
              <input
                type="range"
                min="10"
                max="50"
                value={params.bbPeriod}
                onChange={(e) => setParams(p => ({ ...p, bbPeriod: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Std Deviation: {params.bbStdDev}</label>
              <input
                type="range"
                min="1"
                max="3"
                step="0.5"
                value={params.bbStdDev}
                onChange={(e) => setParams(p => ({ ...p, bbStdDev: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>
          </div>
        );
      case 'macd':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Fast EMA: {params.macdFast}</label>
              <input
                type="range"
                min="8"
                max="15"
                value={params.macdFast}
                onChange={(e) => setParams(p => ({ ...p, macdFast: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Slow EMA: {params.macdSlow}</label>
              <input
                type="range"
                min="20"
                max="35"
                value={params.macdSlow}
                onChange={(e) => setParams(p => ({ ...p, macdSlow: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Signal Line: {params.macdSignal}</label>
              <input
                type="range"
                min="5"
                max="15"
                value={params.macdSignal}
                onChange={(e) => setParams(p => ({ ...p, macdSignal: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-violet-500"
              />
            </div>
          </div>
        );
      case 'momentum':
        return (
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Lookback Period: {params.momentumPeriod}</label>
              <input
                type="range"
                min="5"
                max="30"
                value={params.momentumPeriod}
                onChange={(e) => setParams(p => ({ ...p, momentumPeriod: parseInt(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-teal-500"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Threshold (%): {params.momentumThreshold}</label>
              <input
                type="range"
                min="1"
                max="10"
                step="0.5"
                value={params.momentumThreshold}
                onChange={(e) => setParams(p => ({ ...p, momentumThreshold: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
              />
            </div>
          </div>
        );
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="bg-gradient-to-b from-[#0f1419] to-[#0a0d12] rounded-xl border border-gray-700/50 overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-800/50 via-slate-800/30 to-slate-800/50 border-b border-gray-700/50 px-4 sm:px-6 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-semibold text-white">
                {t('Strategy Backtester')}
              </h2>
              <p className="text-xs text-gray-400">{t('Quantitative strategy validation with historical market data')}</p>
            </div>
          </div>
          
          {/* Data Source Indicator */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-gray-500">
              <span>Data:</span>
              <span className="text-white font-medium">Binance API</span>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            </div>
            <button
              onClick={() => setIsLiveMode(!isLiveMode)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                isLiveMode
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-gray-800/60 text-gray-400 border border-gray-700/50 hover:border-gray-600'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${isLiveMode ? 'bg-emerald-500 animate-pulse' : 'bg-gray-500'}`} />
              {isLiveMode ? t('Live Feed') : t('Historical')}
            </button>
          </div>
        </div>
      </div>
      
      {/* Quick Stats Bar - Shows current data info */}
      <div className="bg-slate-900/40 border-b border-gray-800/30 px-4 sm:px-6 py-2.5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t('Symbol')}:</span>
          <span className="text-white font-mono font-medium">{selectedSymbol}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t('Interval')}:</span>
          <span className="text-white font-medium">{TIMEFRAMES.find(t => t.value === selectedTimeframe)?.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-500">{t('Sample Size')}:</span>
          <span className="text-blue-400 font-mono">{candles.length} candles</span>
        </div>
        {candles.length > 0 && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{t('Period')}:</span>
              <span className="text-white font-medium">
                {new Date(candles[0].time * 1000).toLocaleDateString()} - {new Date(candles[candles.length - 1].time * 1000).toLocaleDateString()}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">{t('Last Price')}:</span>
              <span className="text-emerald-400 font-mono font-medium">${candles[candles.length - 1]?.close.toLocaleString()}</span>
            </div>
          </>
        )}
      </div>
      
      {/* Main Content - Responsive Grid */}
      <div className="p-4 sm:p-6">
        {/* Controls Row - Symbol, Timeframe Selection */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          {/* Symbol Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline">{t('Asset')}:</span>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none cursor-pointer hover:bg-gray-700/80 transition-colors"
            >
              {CRYPTO_PAIRS.map(pair => (
                <option key={pair.symbol} value={pair.symbol}>{pair.name} ({pair.symbol})</option>
              ))}
            </select>
          </div>
          
          {/* Timeframe Selection */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 hidden sm:inline">{t('Interval')}:</span>
            <div className="flex rounded-lg overflow-hidden border border-gray-700 bg-gray-800/50">
              {TIMEFRAMES.map(tf => (
                <button
                  key={tf.value}
                  onClick={() => setSelectedTimeframe(tf.value)}
                  className={`px-3 py-2 text-xs font-medium transition-all ${
                    selectedTimeframe === tf.value
                      ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20'
                      : 'bg-transparent text-gray-400 hover:bg-gray-700/50 hover:text-white'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Main Grid - Chart and Strategy Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          {/* Chart Container - 2/3 width on desktop */}
          <div className="lg:col-span-2 relative rounded-lg overflow-hidden border border-gray-700/40 bg-[#131722]">
            {/* Chart Header - TradingView style */}
            <div className="absolute top-0 left-0 right-0 z-10 px-3 py-2 flex items-center justify-between pointer-events-none">
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-200">{selectedSymbol}</span>
                <span className="text-xs text-gray-500">•</span>
                <span className="text-xs text-gray-400">{TIMEFRAMES.find(tf => tf.value === selectedTimeframe)?.label}</span>
                {isLiveMode && (
                  <span className="flex items-center gap-1 text-xs text-emerald-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Live
                  </span>
                )}
              </div>
              {backtestResult && (
                <div className={`text-xs font-mono font-medium px-2 py-1 rounded ${
                  backtestResult.metrics.totalReturn >= 0 
                    ? 'bg-emerald-500/15 text-emerald-400' 
                    : 'bg-red-500/15 text-red-400'
                }`}>
                  {backtestResult.metrics.totalReturn >= 0 ? '+' : ''}{backtestResult.metrics.totalReturn.toFixed(2)}%
                </div>
              )}
            </div>
            <div 
              ref={chartContainerRef} 
              className="w-full h-[300px] sm:h-[400px] lg:h-[450px]"
            />
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-[#131722]/95">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  <span className="text-gray-400 text-sm">{t('Fetching market data...')}</span>
                </div>
              </div>
            )}
          </div>
          
          {/* Strategy Panel - 1/3 width on desktop */}
          <div className="bg-slate-800/40 rounded-lg border border-gray-700/40 p-4">
            <h3 className="text-sm font-medium text-gray-200 mb-3 flex items-center gap-2">
              <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {t('Select Strategy')}
            </h3>
            
            {/* Strategy Selection */}
            <div className="space-y-1.5 mb-4">
              {STRATEGIES.map(s => (
                <button
                  key={s.type}
                  onClick={() => setSelectedStrategy(s.type)}
                  className={`w-full text-left px-3 py-2 rounded-md text-sm transition-all ${
                    selectedStrategy === s.type
                      ? 'bg-blue-600/20 border border-blue-500/40 text-white'
                      : 'bg-slate-700/30 border border-transparent text-gray-300 hover:bg-slate-700/50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{s.icon}</span>
                    <span className="font-medium">{s.name}</span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5 ml-6">{s.description}</p>
                </button>
              ))}
            </div>
            
            {/* Strategy Parameters */}
            <div className="border-t border-gray-700 pt-4 mb-4">
              <h4 className="text-xs font-bold text-gray-400 uppercase mb-3">{t('Parameters')}</h4>
              {renderStrategyParams()}
            </div>
            
            {/* Run Backtest Button */}
            <button
              onClick={handleRunBacktest}
              disabled={isRunningBacktest || isLoading}
              className="w-full py-3 rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-sm
                         hover:from-indigo-500 hover:to-purple-500 transition-all
                         disabled:opacity-50 disabled:cursor-not-allowed
                         flex items-center justify-center gap-2"
            >
              {isRunningBacktest ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {t('Running...')}
                </>
              ) : (
                <>
                  <span>▶</span>
                  {t('Run Backtest')}
                </>
              )}
            </button>
          </div>
        </div>
        
        {/* Results Section - Show only after backtest */}
        <AnimatePresence>
          {backtestResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* Results Header */}
              <div className="bg-slate-800/30 rounded-lg border border-gray-700/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-white font-medium">
                        {STRATEGIES.find(s => s.type === selectedStrategy)?.name}
                      </h3>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400 text-sm">{selectedSymbol}</span>
                      <span className="text-gray-500">•</span>
                      <span className="text-gray-400 text-sm">{TIMEFRAMES.find(tf => tf.value === selectedTimeframe)?.label}</span>
                    </div>
                    <p className="text-gray-500 text-xs">
                      {backtestResult.metrics.totalTrades} trades • Win Rate: {backtestResult.metrics.winRate.toFixed(1)}% • 
                      {backtestResult.metrics.winningTrades}W / {backtestResult.metrics.losingTrades}L
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <div className={`text-2xl font-mono font-semibold ${backtestResult.metrics.totalReturn >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {backtestResult.metrics.totalReturn >= 0 ? '+' : ''}{backtestResult.metrics.totalReturn.toFixed(2)}%
                      </div>
                      <div className="text-[11px] text-gray-500 uppercase tracking-wider">{t('Total Return')}</div>
                    </div>
                    <div className="hidden sm:block text-right">
                      <div className={`text-xl font-mono font-semibold ${backtestResult.metrics.sharpeRatio >= 1 ? 'text-emerald-400' : backtestResult.metrics.sharpeRatio >= 0 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {backtestResult.metrics.sharpeRatio.toFixed(2)}
                      </div>
                      <div className="text-[11px] text-gray-500 uppercase tracking-wider">{t('Sharpe Ratio')}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Performance Metrics Grid */}
              <div className="bg-gray-900/50 rounded-xl border border-gray-800/80 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-200">
                    {t('Risk & Performance Metrics')}
                  </h3>
                  <span className="text-[10px] text-gray-500">{t('Hover for details')}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                  <MetricCard 
                    label={t('Return')} 
                    value={`${backtestResult.metrics.totalReturn >= 0 ? '+' : ''}${backtestResult.metrics.totalReturn.toFixed(2)}%`}
                    color={backtestResult.metrics.totalReturn >= 0 ? 'green' : 'red'}
                    tooltip={t('Net profit/loss as percentage of initial capital ($10,000)')}
                  />
                  <MetricCard 
                    label={t('Sharpe')} 
                    value={backtestResult.metrics.sharpeRatio.toFixed(2)}
                    color={backtestResult.metrics.sharpeRatio >= 1 ? 'green' : backtestResult.metrics.sharpeRatio >= 0 ? 'yellow' : 'red'}
                    tooltip={t('Risk-adjusted return (annualized). >1 good, >2 excellent')}
                  />
                  <MetricCard 
                    label={t('Sortino')} 
                    value={backtestResult.metrics.sortinoRatio.toFixed(2)}
                    color={backtestResult.metrics.sortinoRatio >= 1.5 ? 'green' : backtestResult.metrics.sortinoRatio >= 0 ? 'yellow' : 'red'}
                    tooltip={t('Sharpe variant using downside deviation only')}
                  />
                  <MetricCard 
                    label={t('Max DD')} 
                    value={`${backtestResult.metrics.maxDrawdown.toFixed(1)}%`}
                    color={backtestResult.metrics.maxDrawdown <= 10 ? 'green' : backtestResult.metrics.maxDrawdown <= 20 ? 'yellow' : 'red'}
                    tooltip={t('Maximum peak-to-trough equity decline')}
                  />
                  <MetricCard 
                    label={t('Win Rate')} 
                    value={`${backtestResult.metrics.winRate.toFixed(0)}%`}
                    color={backtestResult.metrics.winRate >= 50 ? 'green' : 'yellow'}
                    tooltip={t('Percentage of trades that were profitable')}
                  />
                  <MetricCard 
                    label={t('Profit Factor')} 
                    value={backtestResult.metrics.profitFactor === Infinity ? '∞' : backtestResult.metrics.profitFactor.toFixed(2)}
                    color={backtestResult.metrics.profitFactor >= 1.5 ? 'green' : backtestResult.metrics.profitFactor >= 1 ? 'yellow' : 'red'}
                    tooltip={t('Gross profits / gross losses. >1.5 indicates edge')}
                  />
                  <MetricCard 
                    label={t('Trades')} 
                    value={backtestResult.metrics.totalTrades.toString()}
                    color="blue"
                    tooltip={t('Total number of completed round-trip trades')}
                  />
                </div>
                
                {/* Trade Statistics */}
                <div className="mt-4 pt-3 border-t border-gray-700/50 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('Avg Win')}</span>
                    <span className="text-emerald-400 font-mono">${backtestResult.metrics.avgWin.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">{t('Avg Loss')}</span>
                    <span className="text-red-400 font-mono">-${backtestResult.metrics.avgLoss.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('Largest Win')}:</span>
                    <span className="ml-2 text-green-400 font-medium">${backtestResult.metrics.largestWin.toFixed(2)}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">{t('Largest Loss')}:</span>
                    <span className="ml-2 text-red-400 font-medium">${Math.abs(backtestResult.metrics.largestLoss).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              
              {/* Trade Log Toggle */}
              <button
                onClick={() => setShowTradeLog(!showTradeLog)}
                className="w-full py-3 px-4 rounded-xl bg-gray-900/50 border border-gray-800/80 text-sm text-gray-300 
                           hover:bg-gray-800/50 hover:border-gray-700 transition-all flex items-center justify-between group"
              >
                <span className="flex items-center gap-2">
                  <span className="text-purple-400">📋</span>
                  {t('Trade Log')} 
                  <span className="px-2 py-0.5 rounded-full bg-gray-800 text-xs text-gray-400">
                    {backtestResult.trades.length} {t('trades')}
                  </span>
                </span>
                <span className="transform transition-transform group-hover:text-white" style={{ transform: showTradeLog ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                  ▼
                </span>
              </button>
              
              {/* Trade Log Table */}
              <AnimatePresence>
                {showTradeLog && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-gray-900/50 rounded-xl border border-gray-800/80 overflow-hidden"
                  >
                    <div className="overflow-x-auto max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-gray-700">
                      <table className="w-full text-xs">
                        <thead className="bg-gray-800/80 sticky top-0">
                          <tr>
                            <th className="px-3 py-2.5 text-left text-gray-400 font-medium">#</th>
                            <th className="px-3 py-2.5 text-left text-gray-400 font-medium">{t('Entry Date')}</th>
                            <th className="px-3 py-2.5 text-left text-gray-400 font-medium">{t('Exit Date')}</th>
                            <th className="px-3 py-2.5 text-right text-gray-400 font-medium">{t('Entry')}</th>
                            <th className="px-3 py-2.5 text-right text-gray-400 font-medium">{t('Exit')}</th>
                            <th className="px-3 py-2.5 text-right text-gray-400 font-medium">{t('P&L ($)')}</th>
                            <th className="px-3 py-2.5 text-right text-gray-400 font-medium">{t('Return')}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {backtestResult.trades.map((trade, idx) => (
                            <tr key={trade.id} className={`border-t border-gray-800/50 hover:bg-gray-800/30 transition-colors ${
                              (trade.pnl ?? 0) >= 0 ? 'hover:bg-green-500/5' : 'hover:bg-red-500/5'
                            }`}>
                              <td className="px-3 py-2.5 text-gray-400">{idx + 1}</td>
                              <td className="px-3 py-2.5 text-gray-300">{new Date(trade.entryTime * 1000).toLocaleDateString()}</td>
                              <td className="px-3 py-2.5 text-gray-300">{trade.exitTime ? new Date(trade.exitTime * 1000).toLocaleDateString() : '-'}</td>
                              <td className="px-3 py-2.5 text-right text-cyan-400 font-mono">${trade.entryPrice.toLocaleString()}</td>
                              <td className="px-3 py-2.5 text-right text-cyan-400 font-mono">{trade.exitPrice ? `$${trade.exitPrice.toLocaleString()}` : '-'}</td>
                              <td className={`px-3 py-2.5 text-right font-bold font-mono ${(trade.pnl ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                {trade.pnl !== null ? `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}` : '-'}
                              </td>
                              <td className={`px-3 py-2.5 text-right font-bold ${(trade.pnlPercent ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                <span className={`px-1.5 py-0.5 rounded ${(trade.pnlPercent ?? 0) >= 0 ? 'bg-green-500/20' : 'bg-red-500/20'}`}>
                                  {trade.pnlPercent !== null ? `${trade.pnlPercent >= 0 ? '+' : ''}${trade.pnlPercent.toFixed(2)}%` : '-'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

function MetricCard({ label, value, color, tooltip }: { label: string; value: string; color: 'green' | 'red' | 'yellow' | 'blue'; tooltip?: string }) {
  const colorClasses = {
    green: 'text-green-400 bg-green-500/10 border-green-500/30 hover:bg-green-500/20',
    red: 'text-red-400 bg-red-500/10 border-red-500/30 hover:bg-red-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/30 hover:bg-yellow-500/20',
    blue: 'text-blue-400 bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20',
  };
  
  return (
    <div 
      className={`rounded-lg border p-3 transition-all cursor-help group relative ${colorClasses[color]}`}
      title={tooltip}
    >
      <div className="text-[10px] uppercase tracking-wider opacity-70 mb-1">{label}</div>
      <div className="text-lg font-bold">{value}</div>
      {tooltip && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-900 border border-gray-700 rounded text-xs text-gray-300 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50 pointer-events-none shadow-lg">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </div>
      )}
    </div>
  );
}
