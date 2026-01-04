// ============================================================================
// ALPHA ENGINE - Production-Grade ML Prediction System
// Real-time model inference with 1-2 minute refresh rate
// Displays multi-model ensemble predictions across asset classes
// ============================================================================

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeftIcon,
  CpuChipIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  BoltIcon,
  BeakerIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  Squares2X2Icon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { ChartLine } from '@phosphor-icons/react';
import { useTranslation } from '@/i18n';
import { ScrollToTop } from './ScrollToTop';
import { SystemHealthMonitor } from './SystemHealthMonitor';
import { TerminalEasterEgg } from './TerminalEasterEgg';
import { FeatureDiscoveryHints, ShortcutIndicator } from './FeatureDiscoveryHints';
import { ModelStatusBanner } from './ModelStatusBanner';
import MultiParadigmDashboard from './MultiParadigmDashboard';

// ML Services
import { 
  refreshMLData, 
  getAllMLAssets, 
  hasMLData, 
  getCacheAge,
  startMLDataRefresh,
  getAPIStatus,
  type AssetData,
  type APIStatus,
} from '@/services/mlDataLayer';
import { 
  runAllPredictions, 
  getAllPredictions, 
  getTopPredictions,
  getPredictionsByAssetClass,
  getAggregatedMetrics,
  hasPredictions,
  getPredictionCacheAge,
  initializeTfjsModels,
  isUsingRealModels,
  getRealModelStatus,
  type PredictionResult,
} from '@/services/mlPredictionService';
import { 
  getAllModels, 
  getTopModels, 
  getEnsembleWeights,
  getRegistryLastUpdated,
  type ModelVersion,
  type ModelMetrics,
} from '@/services/modelRegistry';

// ============================================================================
// HELPER COMPONENTS
// ============================================================================

// Signal Badge Component
function SignalBadge({ signal, size = 'md' }: { signal: PredictionResult['signal']; size?: 'sm' | 'md' | 'lg' }) {
  const colors = {
    STRONG_BUY: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
    BUY: 'bg-green-500/20 text-green-400 border-green-500/40',
    HOLD: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40',
    SELL: 'bg-orange-500/20 text-orange-400 border-orange-500/40',
    STRONG_SELL: 'bg-red-500/20 text-red-400 border-red-500/40',
  };
  
  const sizes = {
    sm: 'px-1.5 py-0.5 text-[10px]',
    md: 'px-2 py-1 text-xs',
    lg: 'px-3 py-1.5 text-sm',
  };
  
  const displayText = signal.replace('_', ' ');
  
  return (
    <span className={`inline-flex items-center font-semibold rounded border ${colors[signal]} ${sizes[size]}`}>
      {signal.includes('BUY') && <ArrowTrendingUpIcon className="w-3 h-3 mr-1" />}
      {signal.includes('SELL') && <ArrowTrendingDownIcon className="w-3 h-3 mr-1" />}
      {displayText}
    </span>
  );
}

// Confidence Meter Component
function ConfidenceMeter({ value }: { value: number }) {
  const percentage = Math.round(value * 100);
  const color = value >= 0.7 ? 'bg-emerald-500' : value >= 0.5 ? 'bg-yellow-500' : 'bg-red-500';
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.5 }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
      <span className="text-xs text-gray-400 w-10 text-right">{percentage}%</span>
    </div>
  );
}

// Model Performance Card
function ModelCard({ model, isActive, isSelected, onSelect }: { 
  model: ModelVersion; 
  isActive: boolean;
  isSelected?: boolean;
  onSelect?: () => void;
}) {
  const { t } = useTranslation();
  
  const typeColors: Record<string, string> = {
    lightgbm: 'from-blue-500/20 to-cyan-500/20 border-blue-500/40',
    xgboost: 'from-purple-500/20 to-pink-500/20 border-purple-500/40',
    catboost: 'from-green-500/20 to-emerald-500/20 border-green-500/40',
    randomforest: 'from-orange-500/20 to-yellow-500/20 border-orange-500/40',
    ensemble: 'from-gray-500/20 to-gray-600/20 border-gray-500/40',
  };
  
  const typeIcons: Record<string, string> = {
    lightgbm: '🌲',
    xgboost: '⚡',
    catboost: '🐱',
    randomforest: '🌳',
    ensemble: '🎯',
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onSelect}
      className={`relative p-4 rounded-xl border bg-gradient-to-br cursor-pointer transition-all ${typeColors[model.type] || typeColors.ensemble} ${isSelected ? 'ring-2 ring-cyan-500 shadow-lg shadow-cyan-500/20' : ''} ${isActive ? 'ring-2 ring-cyan-500/50' : ''}`}
    >
      {isActive && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-cyan-500 text-black text-[10px] font-bold rounded-full">
          ACTIVE
        </div>
      )}
      {isSelected && !isActive && (
        <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-emerald-500 text-black text-[10px] font-bold rounded-full">
          VIEWING
        </div>
      )}
      
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{typeIcons[model.type] || '🎯'}</span>
        <div>
          <h4 className="text-sm font-semibold text-white">{model.type.toUpperCase()}</h4>
          <p className="text-[10px] text-gray-400">v{model.version}</p>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>
          <span className="text-gray-500">{t("Accuracy")}</span>
          <p className="text-white font-mono">{(model.metrics.accuracy * 100).toFixed(1)}%</p>
        </div>
        <div>
          <span className="text-gray-500">{t("Sharpe")}</span>
          <p className="text-emerald-400 font-mono">{model.metrics.sharpeRatio.toFixed(2)}</p>
        </div>
        <div>
          <span className="text-gray-500">{t("Win Rate")}</span>
          <p className="text-white font-mono">{(model.metrics.winRate * 100).toFixed(1)}%</p>
        </div>
        <div>
          <span className="text-gray-500">{t("Max DD")}</span>
          <p className="text-red-400 font-mono">{(model.metrics.maxDrawdown * 100).toFixed(1)}%</p>
        </div>
      </div>
    </motion.div>
  );
}

// Prediction Row Component
function PredictionRow({ prediction, index }: { prediction: PredictionResult; index: number }) {
  const [expanded, setExpanded] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={`bg-gray-900/50 rounded-lg border overflow-hidden ${
        prediction.isRealModel 
          ? 'border-emerald-500/30' 
          : 'border-yellow-500/30'
      }`}
    >
      <div 
        className="p-3 cursor-pointer hover:bg-gray-800/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Real Model Indicator */}
            <div className="w-3" title={prediction.isRealModel ? 'Real TFJS Model' : 'Simulated Fallback'}>
              <span 
                className={`block w-2 h-2 rounded-full ${
                  prediction.isRealModel ? 'bg-emerald-500' : 'bg-yellow-500'
                }`}
              />
            </div>
            
            <div className="w-12">
              <span className="text-white font-semibold text-sm">{prediction.symbol}</span>
              <span className="block text-[10px] text-gray-500 uppercase">{prediction.assetClass}</span>
            </div>
            
            <div className="w-20">
              <span className="text-xs text-gray-400">Price</span>
              <p className="text-white font-mono text-sm">
                ${prediction.currentPrice < 1 
                  ? prediction.currentPrice.toFixed(4) 
                  : prediction.currentPrice.toFixed(2)}
              </p>
            </div>
            
            <div className="w-16">
              <span className="text-xs text-gray-400">24h</span>
              <p className={`font-mono text-sm ${prediction.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {prediction.priceChange24h >= 0 ? '+' : ''}{prediction.priceChange24h.toFixed(2)}%
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-24">
              <span className="text-xs text-gray-400">Confidence</span>
              <ConfidenceMeter value={prediction.confidence} />
            </div>
            
            <SignalBadge signal={prediction.signal} />
            
            <div className="text-gray-500">
              {expanded ? '▲' : '▼'}
            </div>
          </div>
        </div>
      </div>
      
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-800/50"
          >
            <div className="p-4 grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Model Source Indicator */}
              <div className="col-span-2 md:col-span-4 mb-2">
                <div className={`inline-flex items-center gap-2 px-2 py-1 rounded text-[10px] ${
                  prediction.isRealModel 
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${prediction.isRealModel ? 'bg-emerald-500' : 'bg-yellow-500'}`} />
                  {prediction.isRealModel ? 'Real TensorFlow.js Model Prediction' : 'Simulated Fallback Prediction'}
                </div>
              </div>
              
              {/* Model Predictions */}
              <div className="col-span-2">
                <h5 className="text-xs text-gray-400 mb-2">Model Predictions</h5>
                <div className="space-y-1">
                  {prediction.modelPredictions.map(mp => (
                    <div key={mp.modelId} className="flex items-center justify-between text-xs">
                      <span className="text-gray-300">{mp.modelType.toUpperCase()}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${mp.prediction > 0.55 ? 'bg-green-500' : mp.prediction < 0.45 ? 'bg-red-500' : 'bg-yellow-500'}`}
                            style={{ width: `${mp.prediction * 100}%` }}
                          />
                        </div>
                        <span className="text-gray-400 font-mono w-12">{(mp.prediction * 100).toFixed(1)}%</span>
                        <span className="text-gray-600 font-mono w-8">({(mp.weight * 100).toFixed(0)}%)</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Risk Metrics */}
              <div>
                <h5 className="text-xs text-gray-400 mb-2">Risk Metrics</h5>
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Expected Return</span>
                    <span className={`font-mono ${prediction.expectedReturn >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {prediction.expectedReturn >= 0 ? '+' : ''}{prediction.expectedReturn.toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Stop Loss</span>
                    <span className="text-red-400 font-mono">${prediction.stopLoss.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Take Profit</span>
                    <span className="text-green-400 font-mono">${prediction.takeProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Position Size</span>
                    <span className="text-cyan-400 font-mono">{prediction.positionSize.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Risk/Reward</span>
                    <span className="text-white font-mono">1:{prediction.riskRewardRatio.toFixed(1)}</span>
                  </div>
                </div>
              </div>
              
              {/* Top Features */}
              <div>
                <h5 className="text-xs text-gray-400 mb-2">Key Signals</h5>
                <div className="space-y-1">
                  {prediction.topFeatures.slice(0, 4).map((f, i) => (
                    <div key={i} className="flex items-center gap-1 text-xs">
                      <span className={`w-2 h-2 rounded-full ${f.impact === 'positive' ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-gray-300 truncate">{f.name}</span>
                    </div>
                  ))}
                  {prediction.topFeatures.length === 0 && (
                    <span className="text-gray-500 text-xs">No significant signals</span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="px-4 pb-3 text-[10px] text-gray-600">
              Latency: {prediction.latencyMs.toFixed(1)}ms • Updated: {new Date(prediction.timestamp).toLocaleTimeString()}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function MLQuantDashboard() {
  const { t } = useTranslation();
  
  // State
  const [isLoading, setIsLoading] = useState(true);
  const [predictions, setPredictions] = useState<PredictionResult[]>([]);
  const [models, setModels] = useState<ModelVersion[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'stocks' | 'etfs' | 'crypto'>('all');
  const [refreshCountdown, setRefreshCountdown] = useState(90);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [realModelStatus, setRealModelStatus] = useState<ReturnType<typeof getRealModelStatus> | null>(null);
  const [selectedModelId, setSelectedModelId] = useState<string>('lightgbm'); // For model selection
  const [showModelDetails, setShowModelDetails] = useState(false);
  const [viewMode, setViewMode] = useState<'standard' | 'multi-paradigm'>('multi-paradigm'); // Default to multi-paradigm view
  const [apiStatus, setApiStatus] = useState<APIStatus | null>(null);
  
  // Initialize and fetch data
  useEffect(() => {
    let cleanup: (() => void) | null = null;
    let countdownInterval: NodeJS.Timeout | null = null;
    
    async function initialize() {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('🚀 ML Dashboard: Initializing...');
        
        // Initialize TensorFlow.js models first
        console.log('🤖 Loading TensorFlow.js models...');
        const tfjsLoaded = await initializeTfjsModels();
        setRealModelStatus(getRealModelStatus());
        
        if (tfjsLoaded) {
          console.log('✅ Real TensorFlow.js models loaded!');
        } else {
          console.warn('⚠️ Using simulated models (TFJS not available)');
        }
        
        // Start ML data refresh (1.5 min interval)
        cleanup = startMLDataRefresh(90000);
        
        // Wait for data
        await refreshMLData();
        
        // Update API status
        setApiStatus(getAPIStatus());
        
        // Run predictions
        await runAllPredictions();
        
        // Load models
        setModels(getAllModels());
        setPredictions(getAllPredictions());
        setLastRefresh(new Date());
        setRefreshCountdown(90);
        
        console.log('✅ ML Dashboard: Ready');
      } catch (err) {
        console.error('ML Dashboard initialization error:', err);
        setError('Failed to initialize ML system. Please refresh.');
      } finally {
        setIsLoading(false);
      }
    }
    
    initialize();
    
    // Countdown timer
    countdownInterval = setInterval(() => {
      setRefreshCountdown(prev => {
        if (prev <= 1) {
          // Trigger refresh
          refreshMLData().then(() => runAllPredictions()).then(() => {
            setPredictions(getAllPredictions());
            setLastRefresh(new Date());
            setRealModelStatus(getRealModelStatus());
          });
          return 90;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => {
      if (cleanup) cleanup();
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, []);
  
  // Filter predictions by tab
  const filteredPredictions = useMemo(() => {
    if (activeTab === 'all') return predictions;
    const classMap = { stocks: 'stock', etfs: 'etf', crypto: 'crypto' };
    return predictions.filter(p => p.assetClass === classMap[activeTab]);
  }, [predictions, activeTab]);
  
  // Aggregated metrics
  const aggregatedMetrics = useMemo(() => getAggregatedMetrics(), [predictions]);
  
  // Top signals
  const topBuySignals = useMemo(() => 
    predictions
      .filter(p => p.signal === 'STRONG_BUY' || p.signal === 'BUY')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5),
    [predictions]
  );
  
  const topSellSignals = useMemo(() => 
    predictions
      .filter(p => p.signal === 'STRONG_SELL' || p.signal === 'SELL')
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5),
    [predictions]
  );
  
  // Manual refresh
  const handleManualRefresh = useCallback(async () => {
    setIsLoading(true);
    try {
      await refreshMLData();
      setApiStatus(getAPIStatus()); // Update API status after refresh
      await runAllPredictions();
      setPredictions(getAllPredictions());
      setLastRefresh(new Date());
      setRefreshCountdown(90);
    } catch (err) {
      console.error('Manual refresh error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Ensemble weights
  const ensembleWeights = getEnsembleWeights();
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 text-foreground">
      {/* Feature Discovery & Shortcuts */}
      <FeatureDiscoveryHints />
      <ShortcutIndicator />
      
      {/* System Health Monitor */}
      <SystemHealthMonitor />
      
      {/* Terminal Easter Egg */}
      <TerminalEasterEgg />
      
      {/* Header */}
      <header className="sticky top-0 z-50 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link 
                to="/" 
                className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
              >
                <ArrowLeftIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline text-sm">{t("Back to Portfolio")}</span>
              </Link>
              
              <div className="flex items-center gap-2">
                <div className="relative">
                  <CpuChipIcon className="w-6 h-6 sm:w-7 sm:h-7 text-cyan-400" />
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    animate={{
                      boxShadow: [
                        '0 0 10px rgba(6, 182, 212, 0)',
                        '0 0 20px rgba(6, 182, 212, 0.4)',
                        '0 0 10px rgba(6, 182, 212, 0)',
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <div>
                  <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-cyan-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                    Alpha Engine
                  </h1>
                  <p className="text-[10px] text-gray-500 hidden sm:block">
                    ML-Powered Prediction System • Real-Time Inference
                  </p>
                </div>
              </div>
            </div>
            
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
              
              {/* Refresh Status */}
              <div className="flex items-center gap-2 text-xs">
                <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`} />
                <span className="text-gray-400 hidden sm:inline">
                  {isLoading ? 'Updating...' : `Next: ${refreshCountdown}s`}
                </span>
              </div>
              
              <button
                onClick={handleManualRefresh}
                disabled={isLoading}
                className="p-2 rounded-lg bg-gray-800/50 hover:bg-gray-700/50 transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 text-gray-400 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
              
              {/* Animated button to Quant Sandbox */}
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.98 }}
              >
                <Link to="/lab">
                  <button className="relative overflow-hidden px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-gradient-to-r from-purple-600 via-pink-600 to-orange-600 text-white text-xs sm:text-sm font-medium border-0 shadow-[0_0_15px_rgba(168,85,247,0.3)] hover:shadow-[0_0_25px_rgba(168,85,247,0.5)] transition-all duration-300">
                    <motion.span
                      className="absolute inset-0 bg-gradient-to-r from-purple-400/30 via-pink-400/30 to-orange-400/30"
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
                      <ChartLine className="w-3 h-3 sm:w-4 sm:h-4" weight="bold" />
                      <span className="hidden sm:inline">Quant Sandbox</span>
                      <span className="sm:hidden">Sandbox</span>
                    </span>
                  </button>
                </Link>
              </motion.div>
            </div>
          </div>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-3">
            <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
          </div>
        )}
        
        {/* API Rate Limit / Fallback Warning */}
        {apiStatus?.usingFallback && (
          <motion.div 
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg"
          >
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-300 font-medium">API Rate Limit Reached</span>
                  <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-bold rounded-full">
                    DEMO DATA
                  </span>
                </div>
                <p className="text-sm text-amber-200/70">
                  Real-time market data APIs (Finnhub/Binance) have reached their rate limits. 
                  The system is using <strong>simulated fallback data</strong> for predictions.
                  {apiStatus.lastError && (
                    <span className="block mt-1 text-xs text-amber-400/60">
                      {apiStatus.lastError}
                    </span>
                  )}
                </p>
                <div className="mt-2 flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${apiStatus.finnhub === 'ok' ? 'bg-green-500' : apiStatus.finnhub === 'rate-limited' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span className="text-gray-400">Finnhub: {apiStatus.finnhub}</span>
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full ${apiStatus.binance === 'ok' ? 'bg-green-500' : apiStatus.binance === 'rate-limited' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <span className="text-gray-400">Binance: {apiStatus.binance}</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        {/* Loading State */}
        {isLoading && predictions.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="relative">
              <CpuChipIcon className="w-16 h-16 text-cyan-400 animate-pulse" />
              <div className="absolute inset-0 w-16 h-16 border-4 border-cyan-500/30 rounded-full animate-spin border-t-cyan-500" />
            </div>
            <p className="mt-4 text-gray-400">Initializing Alpha Engine...</p>
            <p className="text-xs text-gray-600 mt-2">Loading ML models & fetching market data</p>
          </div>
        )}
        
        {/* Main Content */}
        {predictions.length > 0 && (
          <>
            {/* Model Status Banner - Shows real model info */}
            <ModelStatusBanner />
            
            {/* View Mode Toggle */}
            <div className="mb-6 flex items-center justify-between">
              <div className="flex items-center gap-2 p-1 bg-gray-800/50 rounded-lg">
                <button
                  onClick={() => setViewMode('standard')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    viewMode === 'standard'
                      ? 'bg-cyan-500/20 text-cyan-300 shadow-lg shadow-cyan-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <ChartBarIcon className="w-4 h-4" />
                    Standard View
                  </span>
                </button>
                <button
                  onClick={() => setViewMode('multi-paradigm')}
                  className={`px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    viewMode === 'multi-paradigm'
                      ? 'bg-purple-500/20 text-purple-300 shadow-lg shadow-purple-500/20'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <SparklesIcon className="w-4 h-4" />
                    Multi-Paradigm
                  </span>
                </button>
              </div>
              
              {viewMode === 'multi-paradigm' && (
                <div className="text-xs text-purple-400 flex items-center gap-2">
                  <SparklesIcon className="w-4 h-4" />
                  Rolling Window + Online Learning + Vintage Ensemble
                </div>
              )}
            </div>
            
            {/* Conditional View Rendering */}
            {viewMode === 'multi-paradigm' ? (
              <MultiParadigmDashboard />
            ) : (
            <>
            {/* Standard View Explanation Banner */}
            <div className="mb-6 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 rounded-xl border border-cyan-500/20 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-cyan-500/20 rounded-lg">
                  <CpuChipIcon className="w-6 h-6 text-cyan-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">Standard Ensemble View</h3>
                  <p className="text-sm text-gray-400">
                    Real-time predictions from our <span className="text-cyan-400">4-model TensorFlow.js ensemble</span> running entirely in your browser.
                    Models are trained on 10+ years of historical data and retrained nightly via GitHub Actions.
                  </p>
                  <div className="flex flex-wrap gap-3 mt-2 text-xs">
                    <span className="px-2 py-1 bg-gray-800/50 rounded text-gray-300">LightGBM</span>
                    <span className="px-2 py-1 bg-gray-800/50 rounded text-gray-300">XGBoost</span>
                    <span className="px-2 py-1 bg-gray-800/50 rounded text-gray-300">CatBoost</span>
                    <span className="px-2 py-1 bg-gray-800/50 rounded text-gray-300">RandomForest</span>
                    <span className="text-gray-500">→ Weighted Ensemble</span>
                  </div>
                </div>
              </div>
            </div>

            {/* System Status Bar */}
            <div className="mb-6 grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <Squares2X2Icon className="w-4 h-4" />
                  <span>Predictions</span>
                </div>
                <p className="text-2xl font-bold text-white">{aggregatedMetrics.totalPredictions}</p>
              </div>
              
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <CheckCircleIcon className="w-4 h-4" />
                  <span>Avg Confidence</span>
                </div>
                <p className="text-2xl font-bold text-cyan-400">
                  {(aggregatedMetrics.avgConfidence * 100).toFixed(1)}%
                </p>
              </div>
              
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <BoltIcon className="w-4 h-4" />
                  <span>Avg Latency</span>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {aggregatedMetrics.avgLatencyMs.toFixed(1)}ms
                </p>
              </div>
              
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <ArrowTrendingUpIcon className="w-4 h-4 text-green-400" />
                  <span>Buy Signals</span>
                </div>
                <p className="text-2xl font-bold text-green-400">
                  {(aggregatedMetrics.signalDistribution.STRONG_BUY || 0) + (aggregatedMetrics.signalDistribution.BUY || 0)}
                </p>
              </div>
              
              <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-800/50">
                <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                  <ArrowTrendingDownIcon className="w-4 h-4 text-red-400" />
                  <span>Sell Signals</span>
                </div>
                <p className="text-2xl font-bold text-red-400">
                  {(aggregatedMetrics.signalDistribution.STRONG_SELL || 0) + (aggregatedMetrics.signalDistribution.SELL || 0)}
                </p>
              </div>
            </div>
            
            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Predictions */}
              <div className="lg:col-span-2 space-y-6">
                {/* Top Signals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Top Buy Signals */}
                  <div className="bg-gray-900/50 rounded-xl p-4 border border-green-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowTrendingUpIcon className="w-5 h-5 text-green-400" />
                      <h3 className="text-sm font-semibold text-white">{t("Top Buy Signals")}</h3>
                    </div>
                    <div className="space-y-2">
                      {topBuySignals.length === 0 ? (
                        <p className="text-gray-500 text-sm">No strong buy signals</p>
                      ) : (
                        topBuySignals.map(pred => (
                          <div key={pred.symbol} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold text-sm">{pred.symbol}</span>
                              <SignalBadge signal={pred.signal} size="sm" />
                            </div>
                            <span className="text-green-400 text-xs font-mono">
                              +{pred.expectedReturn.toFixed(2)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Top Sell Signals */}
                  <div className="bg-gray-900/50 rounded-xl p-4 border border-red-500/20">
                    <div className="flex items-center gap-2 mb-3">
                      <ArrowTrendingDownIcon className="w-5 h-5 text-red-400" />
                      <h3 className="text-sm font-semibold text-white">{t("Top Sell Signals")}</h3>
                    </div>
                    <div className="space-y-2">
                      {topSellSignals.length === 0 ? (
                        <p className="text-gray-500 text-sm">No strong sell signals</p>
                      ) : (
                        topSellSignals.map(pred => (
                          <div key={pred.symbol} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-white font-semibold text-sm">{pred.symbol}</span>
                              <SignalBadge signal={pred.signal} size="sm" />
                            </div>
                            <span className="text-red-400 text-xs font-mono">
                              {pred.expectedReturn.toFixed(2)}%
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
                
                {/* All Predictions */}
                <div className="bg-gray-900/30 rounded-xl p-4 border border-gray-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <ChartBarIcon className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-lg font-semibold text-white">{t("All Predictions")}</h3>
                    </div>
                    
                    {/* Tab Filter */}
                    <div className="flex gap-1 bg-gray-800/50 rounded-lg p-1">
                      {(['all', 'stocks', 'etfs', 'crypto'] as const).map(tab => (
                        <button
                          key={tab}
                          onClick={() => setActiveTab(tab)}
                          className={`px-3 py-1 text-xs rounded-md transition-colors ${
                            activeTab === tab
                              ? 'bg-cyan-500/20 text-cyan-300'
                              : 'text-gray-500 hover:text-gray-300'
                          }`}
                        >
                          {tab.charAt(0).toUpperCase() + tab.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                    {filteredPredictions.map((pred, i) => (
                      <PredictionRow key={pred.symbol} prediction={pred} index={i} />
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Right Column - Models & Info */}
              <div className="space-y-6">
                {/* Ensemble Weights */}
                <div className="bg-gray-900/50 rounded-xl p-4 border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-4">
                    <SparklesIcon className="w-5 h-5 text-purple-400" />
                    <h3 className="text-sm font-semibold text-white">{t("Ensemble Weights")}</h3>
                  </div>
                  
                  <div className="space-y-3">
                    {Object.entries(ensembleWeights).map(([model, weight]) => (
                      <div key={model}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">{model.toUpperCase()}</span>
                          <span className="text-white font-mono">{(weight * 100).toFixed(0)}%</span>
                        </div>
                        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${weight * 100}%` }}
                            transition={{ duration: 0.5 }}
                            className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Model Cards - Interactive Selection */}
                <div className="bg-gray-900/30 rounded-xl p-4 border border-gray-800/50">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <BeakerIcon className="w-5 h-5 text-cyan-400" />
                      <h3 className="text-sm font-semibold text-white">{t("Active Models")}</h3>
                    </div>
                    <span className="text-[10px] text-gray-500 bg-gray-800/50 px-2 py-1 rounded">
                      Click to inspect
                    </span>
                  </div>
                  
                  <div className="space-y-3">
                    {getTopModels(4).map(model => (
                      <ModelCard 
                        key={model.id} 
                        model={model} 
                        isActive={model.rank === 1}
                        isSelected={selectedModelId === model.type}
                        onSelect={() => {
                          setSelectedModelId(model.type);
                          setShowModelDetails(true);
                        }}
                      />
                    ))}
                  </div>
                  
                  {/* Model Details Popup */}
                  <AnimatePresence>
                    {showModelDetails && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="mt-4 p-3 bg-gray-800/80 rounded-lg border border-cyan-500/30"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold text-cyan-400">
                            {selectedModelId.toUpperCase()} Model Details
                          </span>
                          <button 
                            onClick={() => setShowModelDetails(false)}
                            className="text-gray-500 hover:text-white text-xs"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="text-[10px] text-gray-400 space-y-1">
                          <p>• <span className="text-white">All predictions use this model</span> in the ensemble</p>
                          <p>• <span className="text-emerald-400">Real TensorFlow.js model</span> running in your browser</p>
                          <p>• Trained on 55 technical indicators</p>
                          <p>• Contributes {
                            selectedModelId === 'lightgbm' ? '30%' :
                            selectedModelId === 'xgboost' ? '25%' :
                            selectedModelId === 'catboost' ? '25%' : '20%'
                          } to final prediction</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                
                {/* System Info */}
                <div className="bg-gray-900/50 rounded-xl p-4 border border-gray-800/50">
                  <div className="flex items-center gap-2 mb-3">
                    <InformationCircleIcon className="w-5 h-5 text-gray-400" />
                    <h3 className="text-sm font-semibold text-white">{t("System Info")}</h3>
                  </div>
                  
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Last Updated</span>
                      <span className="text-gray-300">
                        {lastRefresh ? lastRefresh.toLocaleTimeString() : 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Refresh Interval</span>
                      <span className="text-gray-300">90 seconds</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Models Loaded</span>
                      <span className="text-emerald-400">4 Real TFJS</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Features</span>
                      <span className="text-gray-300">55 indicators</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Inference</span>
                      <span className="text-emerald-400">Client-side (WebGL)</span>
                    </div>
                  </div>
                  
                  {/* Training Info - Clear distinction */}
                  <div className="mt-3 pt-3 border-t border-gray-800/50">
                    <p className="text-[10px] text-gray-500 mb-2">Training Schedule</p>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-cyan-500"></div>
                        <span className="text-[10px] text-gray-400">
                          <span className="text-white font-medium">Initial:</span> 20 years (198K samples)
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-purple-500 animate-pulse"></div>
                        <span className="text-[10px] text-gray-400">
                          <span className="text-white font-medium">Nightly:</span> 5 years (incremental)
                        </span>
                      </div>
                    </div>
                    <p className="text-[9px] text-gray-600 mt-2">
                      Models retrain automatically via GitHub Actions every night at midnight UTC
                    </p>
                  </div>
                </div>
                
                {/* Architecture Note */}
                <div className="bg-gradient-to-br from-cyan-500/10 to-purple-500/10 rounded-xl p-4 border border-cyan-500/20">
                  <h4 className="text-sm font-semibold text-white mb-2">🏗️ {t("Architecture")}</h4>
                  <ul className="text-xs text-gray-400 space-y-1">
                    <li>• <span className="text-cyan-400">Real-time data:</span> Finnhub + Binance APIs</li>
                    <li>• <span className="text-cyan-400">Features:</span> 55 technical indicators (RSI, MACD, Bollinger, etc.)</li>
                    <li>• <span className="text-cyan-400">Ensemble:</span> LightGBM, XGBoost, CatBoost, RandomForest</li>
                    <li>• <span className="text-cyan-400">Inference:</span> 100% client-side via TensorFlow.js (WebGL)</li>
                    <li>• <span className="text-cyan-400">Distillation:</span> Tree models → Neural Networks</li>
                    <li>• <span className="text-cyan-400">Refresh:</span> 90 second auto-refresh cycle</li>
                    <li>• <span className="text-cyan-400">CI/CD:</span> Nightly retraining via GitHub Actions</li>
                  </ul>
                </div>
              </div>
            </div>
            </>
            )}
          </>
        )}
      </main>
      
      {/* Footer */}
      <footer className="py-6 px-6 border-t border-gray-800 bg-gray-950/50 mt-12">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-xs text-gray-500">
            Alpha Engine • ML-Powered Predictions • Models trained on 20 years of historical data • For demonstration only
          </p>
        </div>
      </footer>
      
      <ScrollToTop />
    </div>
  );
}
