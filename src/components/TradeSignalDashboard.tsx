// ============================================================================
// REAL-TIME MULTI-STRATEGY TRADE SIGNAL DASHBOARD
// Generates signals from multiple algorithmic strategies:
// - Momentum: Trend following based on order flow
// - Mean Reversion: Counter-trend when extremes detected
// - Order Flow: Pure microstructure signal
// - Trend Following: MACD-like trend detection
// - Composite: Weighted combination of all strategies
// ============================================================================

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  SignalIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  MinusIcon,
  BoltIcon,
  CubeIcon,
  ChartBarSquareIcon,
  ArrowPathRoundedSquareIcon,
  PresentationChartLineIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { useTranslation } from '@/i18n';
import {
  startBinanceWebSocket,
  subscribeToMetrics,
  CRYPTO_SYMBOLS,
  type MicrostructureMetrics
} from '../services/binanceWebSocket';

// Strategy types
type StrategyType = 'MOMENTUM' | 'MEAN_REVERSION' | 'ORDER_FLOW' | 'TREND' | 'COMPOSITE';
type SignalDirection = 'LONG' | 'SHORT' | 'NEUTRAL';
type SignalStrength = 'STRONG' | 'MODERATE' | 'WEAK';

interface Strategy {
  id: StrategyType;
  name: string;
  shortName: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgColor: string;
  description: string;
}

const STRATEGIES: Strategy[] = [
  { 
    id: 'MOMENTUM', 
    name: 'Momentum', 
    shortName: 'MOM',
    icon: ArrowTrendingUpIcon, 
    color: 'text-green-400', 
    bgColor: 'bg-green-500/20',
    description: 'Follows strong directional moves'
  },
  { 
    id: 'MEAN_REVERSION', 
    name: 'Mean Reversion', 
    shortName: 'MR',
    icon: ArrowPathRoundedSquareIcon, 
    color: 'text-purple-400', 
    bgColor: 'bg-purple-500/20',
    description: 'Counter-trend at extremes'
  },
  { 
    id: 'ORDER_FLOW', 
    name: 'Order Flow', 
    shortName: 'OF',
    icon: ChartBarSquareIcon, 
    color: 'text-cyan-400', 
    bgColor: 'bg-cyan-500/20',
    description: 'Pure microstructure signals'
  },
  { 
    id: 'TREND', 
    name: 'Trend Following', 
    shortName: 'TF',
    icon: PresentationChartLineIcon, 
    color: 'text-orange-400', 
    bgColor: 'bg-orange-500/20',
    description: 'Long-term trend detection'
  },
  { 
    id: 'COMPOSITE', 
    name: 'Composite', 
    shortName: 'ALL',
    icon: SparklesIcon, 
    color: 'text-yellow-400', 
    bgColor: 'bg-yellow-500/20',
    description: 'Multi-strategy ensemble'
  }
];

interface TradingSignal {
  symbol: string;
  strategy: StrategyType;
  direction: SignalDirection;
  strength: SignalStrength;
  confidence: number;
  reasons: string[];
  timestamp: number;
  metrics: {
    orderFlowImbalance: number;
    spreadBps: number;
    tradeIntensity: number;
    depthRatio: number;
    netOrderFlow: number;
  };
}

interface SignalHistory {
  direction: SignalDirection;
  imbalance: number;
  intensity: number;
  timestamp: number;
}

// Momentum Strategy: Follow strong directional moves
function calculateMomentumSignal(
  symbol: string,
  metrics: MicrostructureMetrics,
  history: SignalHistory[]
): TradingSignal {
  const reasons: string[] = [];
  let bullScore = 0;
  let bearScore = 0;
  
  const netFlow = metrics.netOrderFlow;
  const totalVolume = metrics.buyVolume + metrics.sellVolume;
  const flowRatio = totalVolume > 0 ? netFlow / totalVolume : 0;
  
  // Strong flow = strong momentum
  if (flowRatio > 0.4) {
    bullScore += 40;
    reasons.push('Strong buying momentum');
  } else if (flowRatio > 0.2) {
    bullScore += 25;
    reasons.push('Building buy momentum');
  } else if (flowRatio < -0.4) {
    bearScore += 40;
    reasons.push('Strong selling momentum');
  } else if (flowRatio < -0.2) {
    bearScore += 25;
    reasons.push('Building sell momentum');
  }
  
  // Intensity amplifies momentum
  if (metrics.tradeIntensity > 15) {
    const multiplier = 1.4;
    bullScore *= bullScore > bearScore ? multiplier : 1;
    bearScore *= bearScore > bullScore ? multiplier : 1;
    reasons.push(`High intensity momentum (${metrics.tradeIntensity.toFixed(0)}/s)`);
  }
  
  // Consistent direction in history
  if (history.length >= 3) {
    const recentBullish = history.slice(0, 3).filter(h => h.direction === 'LONG').length;
    const recentBearish = history.slice(0, 3).filter(h => h.direction === 'SHORT').length;
    if (recentBullish >= 3) {
      bullScore += 20;
      reasons.push('Sustained bullish momentum');
    } else if (recentBearish >= 3) {
      bearScore += 20;
      reasons.push('Sustained bearish momentum');
    }
  }
  
  return buildSignal(symbol, 'MOMENTUM', bullScore, bearScore, reasons, metrics);
}

// Mean Reversion Strategy: Counter-trend at extremes
function calculateMeanReversionSignal(
  symbol: string,
  metrics: MicrostructureMetrics,
  history: SignalHistory[]
): TradingSignal {
  const reasons: string[] = [];
  let bullScore = 0;
  let bearScore = 0;
  
  const imbalance = metrics.orderBookImbalance;
  
  // Extreme imbalance = reversal opportunity (counter-trend)
  if (imbalance > 0.5) {
    // Extremely bullish = expect mean reversion SHORT
    bearScore += 35;
    reasons.push('Extreme bid imbalance - reversal likely');
  } else if (imbalance < -0.5) {
    // Extremely bearish = expect mean reversion LONG
    bullScore += 35;
    reasons.push('Extreme ask imbalance - reversal likely');
  }
  
  // Check for exhaustion (high intensity + extreme imbalance)
  if (metrics.tradeIntensity > 20 && Math.abs(imbalance) > 0.4) {
    const exhaustionBonus = 25;
    if (imbalance > 0) {
      bearScore += exhaustionBonus;
      reasons.push('Buying exhaustion detected');
    } else {
      bullScore += exhaustionBonus;
      reasons.push('Selling exhaustion detected');
    }
  }
  
  // Wide spread at extremes = reversal imminent
  if (metrics.spreadBps > 8 && Math.abs(imbalance) > 0.3) {
    const bonus = 15;
    if (imbalance > 0) bearScore += bonus;
    else bullScore += bonus;
    reasons.push('Spread widening at extreme');
  }
  
  return buildSignal(symbol, 'MEAN_REVERSION', bullScore, bearScore, reasons, metrics);
}

// Order Flow Strategy: Pure microstructure
function calculateOrderFlowSignal(
  symbol: string,
  metrics: MicrostructureMetrics,
  history: SignalHistory[]
): TradingSignal {
  const reasons: string[] = [];
  let bullScore = 0;
  let bearScore = 0;
  
  // Order book imbalance
  const imbalance = metrics.orderBookImbalance;
  if (imbalance > 0.25) {
    bullScore += 30;
    reasons.push(`Bid imbalance: ${(imbalance * 100).toFixed(0)}%`);
  } else if (imbalance < -0.25) {
    bearScore += 30;
    reasons.push(`Ask imbalance: ${(imbalance * 100).toFixed(0)}%`);
  }
  
  // Depth ratio
  if (metrics.depthRatio > 1.4) {
    bullScore += 25;
    reasons.push(`Strong bid depth (${metrics.depthRatio.toFixed(2)}x)`);
  } else if (metrics.depthRatio < 0.7) {
    bearScore += 25;
    reasons.push(`Weak bid depth (${metrics.depthRatio.toFixed(2)}x)`);
  }
  
  // Net flow
  const flowRatio = (metrics.buyVolume - metrics.sellVolume) / Math.max(metrics.buyVolume + metrics.sellVolume, 1);
  if (flowRatio > 0.2) {
    bullScore += 20;
    reasons.push('Net buying flow');
  } else if (flowRatio < -0.2) {
    bearScore += 20;
    reasons.push('Net selling flow');
  }
  
  // Tight spread = confidence boost
  if (metrics.spreadBps < 3) {
    bullScore *= 1.1;
    bearScore *= 1.1;
    reasons.push('Tight spread (high liquidity)');
  }
  
  return buildSignal(symbol, 'ORDER_FLOW', bullScore, bearScore, reasons, metrics);
}

// Trend Following Strategy: Longer-term trend
function calculateTrendSignal(
  symbol: string,
  metrics: MicrostructureMetrics,
  history: SignalHistory[]
): TradingSignal {
  const reasons: string[] = [];
  let bullScore = 0;
  let bearScore = 0;
  
  if (history.length < 5) {
    return buildSignal(symbol, 'TREND', 0, 0, ['Building trend data...'], metrics);
  }
  
  // Calculate trend from history
  const recentImbalances = history.slice(0, 5).map(h => h.imbalance);
  const avgImbalance = recentImbalances.reduce((a, b) => a + b, 0) / recentImbalances.length;
  const currentImbalance = metrics.orderBookImbalance;
  
  // Trend direction
  if (avgImbalance > 0.1 && currentImbalance > avgImbalance) {
    bullScore += 35;
    reasons.push('Uptrend strengthening');
  } else if (avgImbalance > 0.05 && currentImbalance > 0) {
    bullScore += 20;
    reasons.push('Uptrend continuing');
  } else if (avgImbalance < -0.1 && currentImbalance < avgImbalance) {
    bearScore += 35;
    reasons.push('Downtrend strengthening');
  } else if (avgImbalance < -0.05 && currentImbalance < 0) {
    bearScore += 20;
    reasons.push('Downtrend continuing');
  }
  
  // Intensity trend
  const recentIntensity = history.slice(0, 3).map(h => h.intensity);
  const avgIntensity = recentIntensity.reduce((a, b) => a + b, 0) / recentIntensity.length;
  if (metrics.tradeIntensity > avgIntensity * 1.3) {
    const bonus = 15;
    if (bullScore > bearScore) bullScore += bonus;
    else if (bearScore > bullScore) bearScore += bonus;
    reasons.push('Trend acceleration');
  }
  
  return buildSignal(symbol, 'TREND', bullScore, bearScore, reasons, metrics);
}

// Composite Strategy: Ensemble of all strategies
function calculateCompositeSignal(
  symbol: string,
  metrics: MicrostructureMetrics,
  history: SignalHistory[]
): TradingSignal {
  const momentum = calculateMomentumSignal(symbol, metrics, history);
  const meanRev = calculateMeanReversionSignal(symbol, metrics, history);
  const orderFlow = calculateOrderFlowSignal(symbol, metrics, history);
  const trend = calculateTrendSignal(symbol, metrics, history);
  
  // Weighted voting
  const weights = { MOMENTUM: 0.3, MEAN_REVERSION: 0.15, ORDER_FLOW: 0.35, TREND: 0.2 };
  
  let totalBull = 0;
  let totalBear = 0;
  const reasons: string[] = [];
  
  const signals = [
    { sig: momentum, w: weights.MOMENTUM, name: 'MOM' },
    { sig: meanRev, w: weights.MEAN_REVERSION, name: 'MR' },
    { sig: orderFlow, w: weights.ORDER_FLOW, name: 'OF' },
    { sig: trend, w: weights.TREND, name: 'TF' }
  ];
  
  signals.forEach(({ sig, w, name }) => {
    if (sig.direction === 'LONG') {
      totalBull += sig.confidence * w;
      if (sig.strength !== 'WEAK') reasons.push(`${name}: LONG (${sig.strength})`);
    } else if (sig.direction === 'SHORT') {
      totalBear += sig.confidence * w;
      if (sig.strength !== 'WEAK') reasons.push(`${name}: SHORT (${sig.strength})`);
    }
  });
  
  // Agreement bonus
  const longCount = signals.filter(s => s.sig.direction === 'LONG').length;
  const shortCount = signals.filter(s => s.sig.direction === 'SHORT').length;
  if (longCount >= 3) {
    totalBull *= 1.3;
    reasons.push('Multi-strategy bullish consensus');
  } else if (shortCount >= 3) {
    totalBear *= 1.3;
    reasons.push('Multi-strategy bearish consensus');
  }
  
  return buildSignal(symbol, 'COMPOSITE', totalBull, totalBear, reasons.slice(0, 4), metrics);
}

// Helper to build signal object
function buildSignal(
  symbol: string,
  strategy: StrategyType,
  bullScore: number,
  bearScore: number,
  reasons: string[],
  metrics: MicrostructureMetrics
): TradingSignal {
  const netScore = bullScore - bearScore;
  const confidence = Math.min(Math.abs(netScore), 100);
  
  let direction: SignalDirection = 'NEUTRAL';
  let strength: SignalStrength = 'WEAK';
  
  if (netScore > 25) {
    direction = 'LONG';
    strength = netScore > 55 ? 'STRONG' : netScore > 35 ? 'MODERATE' : 'WEAK';
  } else if (netScore < -25) {
    direction = 'SHORT';
    strength = netScore < -55 ? 'STRONG' : netScore < -35 ? 'MODERATE' : 'WEAK';
  }
  
  return {
    symbol,
    strategy,
    direction,
    strength,
    confidence,
    reasons: reasons.slice(0, 4),
    timestamp: Date.now(),
    metrics: {
      orderFlowImbalance: metrics.orderBookImbalance,
      spreadBps: metrics.spreadBps,
      tradeIntensity: metrics.tradeIntensity,
      depthRatio: metrics.depthRatio,
      netOrderFlow: metrics.netOrderFlow
    }
  };
}

// Calculate signal based on selected strategy
function calculateSignal(
  symbol: string,
  strategy: StrategyType,
  metrics: MicrostructureMetrics,
  history: SignalHistory[]
): TradingSignal {
  switch (strategy) {
    case 'MOMENTUM':
      return calculateMomentumSignal(symbol, metrics, history);
    case 'MEAN_REVERSION':
      return calculateMeanReversionSignal(symbol, metrics, history);
    case 'ORDER_FLOW':
      return calculateOrderFlowSignal(symbol, metrics, history);
    case 'TREND':
      return calculateTrendSignal(symbol, metrics, history);
    case 'COMPOSITE':
      return calculateCompositeSignal(symbol, metrics, history);
    default:
      return calculateOrderFlowSignal(symbol, metrics, history);
  }
}

// Signal card component - Clear and readable
function SignalCard({ signal }: { signal: TradingSignal }) {
  const symbol = signal.symbol.replace('USDT', '');
  const isLong = signal.direction === 'LONG';
  const isNeutral = signal.direction === 'NEUTRAL';
  
  const colorClass = isNeutral 
    ? 'border-gray-600/50 bg-gray-800/30'
    : isLong 
      ? 'border-green-500/50 bg-green-500/10' 
      : 'border-red-500/50 bg-red-500/10';
  
  return (
    <div className={`rounded-xl p-3 border ${colorClass} transition-all duration-300`}>
      {/* Header with Symbol and Direction */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isNeutral ? (
            <MinusIcon className="w-5 h-5 text-gray-400" />
          ) : isLong ? (
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-400" />
          ) : (
            <ArrowTrendingDownIcon className="w-5 h-5 text-red-400" />
          )}
          <span className="text-base font-bold text-white">{symbol}</span>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
          isNeutral ? 'bg-gray-700 text-gray-300' : isLong ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
        }`}>
          {signal.direction}
        </span>
      </div>
      
      {/* Confidence Bar with Label */}
      <div className="mb-2">
        <div className="flex justify-between text-[10px] mb-1">
          <span className="text-gray-500">Confidence</span>
          <span className={`font-mono font-bold ${isNeutral ? 'text-gray-400' : isLong ? 'text-green-400' : 'text-red-400'}`}>
            {signal.confidence.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${signal.confidence}%` }}
            transition={{ duration: 0.3 }}
            className={`h-full ${isNeutral ? 'bg-gray-600' : isLong ? 'bg-green-500' : 'bg-red-500'}`}
          />
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="flex items-center justify-between text-[10px]">
        <div>
          <span className="text-gray-500">Flow: </span>
          <span className={signal.metrics.orderFlowImbalance > 0 ? 'text-green-400' : 'text-red-400'}>
            {(signal.metrics.orderFlowImbalance * 100).toFixed(0)}%
          </span>
        </div>
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
          signal.strength === 'STRONG' ? 'bg-purple-500/30 text-purple-300' : 
          signal.strength === 'MODERATE' ? 'bg-blue-500/30 text-blue-300' : 'bg-gray-700 text-gray-400'
        }`}>
          {signal.strength}
        </span>
      </div>
    </div>
  );
}

// Market overview bar - clear and informative
function MarketOverview({ signals }: { signals: Map<string, TradingSignal> }) {
  const allSignals = Array.from(signals.values());
  const longCount = allSignals.filter(s => s.direction === 'LONG').length;
  const shortCount = allSignals.filter(s => s.direction === 'SHORT').length;
  const avgConfidence = allSignals.length > 0 
    ? allSignals.reduce((sum, s) => sum + s.confidence, 0) / allSignals.length 
    : 0;
  
  const marketBias = longCount > shortCount ? 'BULLISH' : shortCount > longCount ? 'BEARISH' : 'MIXED';
  
  return (
    <div className="grid grid-cols-4 gap-2 mb-3">
      <div className="bg-gray-800/40 rounded-lg px-3 py-2 text-center">
        <div className="text-[10px] text-gray-500 mb-0.5">Market Bias</div>
        <div className={`text-sm font-bold ${
          marketBias === 'BULLISH' ? 'text-green-400' : marketBias === 'BEARISH' ? 'text-red-400' : 'text-gray-400'
        }`}>{marketBias}</div>
      </div>
      <div className="bg-gray-800/40 rounded-lg px-3 py-2 text-center">
        <div className="text-[10px] text-gray-500 mb-0.5">Long</div>
        <div className="text-sm font-bold text-green-400">{longCount}</div>
      </div>
      <div className="bg-gray-800/40 rounded-lg px-3 py-2 text-center">
        <div className="text-[10px] text-gray-500 mb-0.5">Short</div>
        <div className="text-sm font-bold text-red-400">{shortCount}</div>
      </div>
      <div className="bg-gray-800/40 rounded-lg px-3 py-2 text-center">
        <div className="text-[10px] text-gray-500 mb-0.5">Avg Confidence</div>
        <div className="text-sm font-bold font-mono text-cyan-400">{avgConfidence.toFixed(0)}%</div>
      </div>
    </div>
  );
}

export default function TradeSignalDashboard() {
  const { t } = useTranslation();
  const [signals, setSignals] = useState<Map<string, TradingSignal>>(new Map());
  const [signalHistory, setSignalHistory] = useState<Map<string, SignalHistory[]>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('COMPOSITE');
  const lastUpdateRef = useRef<number>(0);
  const latestMetricsRef = useRef<Map<string, MicrostructureMetrics>>(new Map());
  
  // Handle strategy change - recalculate all signals
  const handleStrategyChange = (strategy: StrategyType) => {
    setSelectedStrategy(strategy);
    
    // Recalculate all signals with new strategy
    const newSignals = new Map<string, TradingSignal>();
    latestMetricsRef.current.forEach((metrics, symbol) => {
      const history = signalHistory.get(symbol) || [];
      newSignals.set(symbol, calculateSignal(symbol, strategy, metrics, history));
    });
    setSignals(newSignals);
  };
  
  useEffect(() => {
    const cleanup = startBinanceWebSocket();
    
    const unsubscribe = subscribeToMetrics(({ symbol, metrics }) => {
      setIsConnected(true);
      
      // Store latest metrics
      latestMetricsRef.current.set(symbol, metrics);
      
      // Throttle to 500ms for faster signal updates
      const now = Date.now();
      if (now - lastUpdateRef.current < 500) return;
      lastUpdateRef.current = now;
      
      // Get history for this symbol
      const history = signalHistory.get(symbol) || [];
      
      // Calculate signal with current strategy
      const newSignal = calculateSignal(symbol, selectedStrategy, metrics, history);
      
      // Update signals
      setSignals(prev => {
        const updated = new Map(prev);
        updated.set(symbol, newSignal);
        return updated;
      });
      
      // Update history (keep last 10)
      setSignalHistory(prev => {
        const updated = new Map(prev);
        const currentHistory = prev.get(symbol) || [];
        updated.set(symbol, [
          { 
            direction: newSignal.direction, 
            timestamp: now,
            imbalance: metrics.orderBookImbalance,
            intensity: metrics.tradeIntensity
          },
          ...currentHistory
        ].slice(0, 10));
        return updated;
      });
    });
    
    return () => {
      cleanup();
      unsubscribe();
    };
  }, [signalHistory, selectedStrategy]);
  
  const sortedSignals = useMemo(() => {
    return Array.from(signals.values()).sort((a, b) => b.confidence - a.confidence);
  }, [signals]);
  
  const activeStrategy = STRATEGIES.find(s => s.id === selectedStrategy)!;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-gray-900/80 to-gray-800/60 rounded-2xl p-3 sm:p-5 border border-gray-700/50 min-h-[400px] sm:min-h-[450px] lg:h-[480px] flex flex-col"
    >
      {/* Header - Responsive */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-3 gap-2 sm:gap-0">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className={`p-1.5 sm:p-2 rounded-lg ${activeStrategy.bgColor}`}>
            <activeStrategy.icon className={`w-4 h-4 sm:w-5 sm:h-5 ${activeStrategy.color}`} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-white flex items-center gap-2">
              {t("Trade Signals")}
              <span className={`text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 ${activeStrategy.bgColor} ${activeStrategy.color} rounded-full`}>
                {activeStrategy.name}
              </span>
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-500 hidden sm:block">{activeStrategy.description}</p>
          </div>
        </div>
        
        {/* Connection status */}
        <div className="flex items-center gap-1.5 px-2 py-1 bg-gray-800/50 rounded">
          <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`} />
          <span className="text-[10px] text-gray-400">
            {isConnected ? 'Live' : 'Connecting...'}
          </span>
        </div>
      </div>
      
      {/* Strategy Selector Buttons */}
      <div className="flex flex-wrap gap-2 mb-4">
        {STRATEGIES.map((strategy) => {
          const Icon = strategy.icon;
          const isActive = selectedStrategy === strategy.id;
          return (
            <motion.button
              key={strategy.id}
              onClick={() => handleStrategyChange(strategy.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className={`
                flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                transition-all duration-200 border
                ${isActive 
                  ? `${strategy.bgColor} ${strategy.color} border-current` 
                  : 'bg-gray-800/50 text-gray-400 border-gray-700/50 hover:bg-gray-700/50'
                }
              `}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{strategy.shortName}</span>
            </motion.button>
          );
        })}
      </div>
      
      {/* Loading state */}
      {!isConnected && (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-gray-400 text-sm">{t("Analyzing market microstructure...")}</p>
          </div>
        </div>
      )}
      
      {isConnected && (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Market Overview */}
          <MarketOverview signals={signals} />
          
          {/* Signal Cards Grid - Responsive columns with scroll on mobile */}
          <div className="flex-1 overflow-y-auto sm:overflow-visible">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-2.5">
              <AnimatePresence mode="wait">
                {sortedSignals.slice(0, 6).map(signal => (
                  <motion.div
                    key={`${signal.symbol}-${selectedStrategy}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                  >
                    <SignalCard signal={signal} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      )}
      
      {/* Disclaimer */}
      <div className="mt-3 pt-2 border-t border-gray-700/30 text-[9px] sm:text-[10px] text-gray-500">
        ⚠️ {t("Signals are for educational purposes only. Not financial advice.")}
      </div>
    </motion.div>
  );
}
