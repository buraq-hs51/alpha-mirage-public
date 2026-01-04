// ============================================================================
// MULTI-PARADIGM ML ENSEMBLE DASHBOARD
// 
// This dashboard uses REAL ML predictions from all three paradigms:
// 1. Rolling Window - TensorFlow.js models (LightGBM, XGBoost, CatBoost, RF)
// 2. Online Learning - Web Worker SGD/PA (real-time adaptive)
// 3. Vintage Ensemble - Historical model versions for stability
// 
// The Meta-Ensemble combines all paradigms using weighted aggregation
// ============================================================================

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  TrendingUp, 
  TrendingDown, 
  Cpu, 
  Clock, 
  Layers, 
  RefreshCw,
  Zap,
  History,
  Target,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCircle,
  Brain,
  Workflow,
  Timer,
  Gauge,
  AlertTriangle,
  Activity
} from 'lucide-react';

// Import ML services
import { getAllMLAssets, type AssetData } from '@/services/mlDataLayer';
import { calculateFeatures, normalizeFeatures } from '@/services/featureEngineering';
import { 
  metaEnsembleService, 
  type MetaEnsemblePrediction,
  type ParadigmPrediction as ServiceParadigmPrediction
} from '@/services/metaEnsemble';

// ============================================================================
// TYPES
// ============================================================================

interface ModelPrediction {
  name: string;
  probability: number;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  weight: number;
}

interface ParadigmResult {
  paradigm: string;
  models: ModelPrediction[];
  combinedProbability: number;
  combinedDirection: 'LONG' | 'SHORT';
  combinedConfidence: number;
  weight: number;
  latencyMs: number;
  description: string;
  icon: React.ReactNode;
  color: string;
}

interface MultiParadigmDashboardProps {
  onPredictionUpdate?: (prediction: unknown) => void;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateDemoPredictions = (symbol: string, price: number, change: number): ParadigmResult[] => {
  // Seed random based on symbol for consistency
  const seed = symbol.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
  const random = (offset: number) => {
    const x = Math.sin(seed + offset) * 10000;
    return x - Math.floor(x);
  };

  // Base probability influenced by actual price change
  const baseBias = change > 0 ? 0.05 : change < 0 ? -0.05 : 0;

  // Rolling Window Models (4 tree-based models)
  const rollingWindowModels: ModelPrediction[] = [
    {
      name: 'LightGBM',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias + (random(1) - 0.5) * 0.15)),
      direction: 'LONG',
      confidence: 0.6 + random(2) * 0.3,
      weight: 0.30,
    },
    {
      name: 'XGBoost',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias + (random(3) - 0.5) * 0.15)),
      direction: 'LONG',
      confidence: 0.55 + random(4) * 0.3,
      weight: 0.25,
    },
    {
      name: 'CatBoost',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias + (random(5) - 0.5) * 0.15)),
      direction: 'LONG',
      confidence: 0.58 + random(6) * 0.3,
      weight: 0.25,
    },
    {
      name: 'RandomForest',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias + (random(7) - 0.5) * 0.15)),
      direction: 'LONG',
      confidence: 0.52 + random(8) * 0.3,
      weight: 0.20,
    },
  ];

  // Update directions based on probability
  rollingWindowModels.forEach(m => {
    m.direction = m.probability >= 0.5 ? 'LONG' : 'SHORT';
  });

  // Online Learning Models (2 adaptive models)
  const onlineLearningModels: ModelPrediction[] = [
    {
      name: 'SGD Classifier',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias * 1.2 + (random(9) - 0.5) * 0.18)),
      direction: 'LONG',
      confidence: 0.50 + random(10) * 0.35,
      weight: 0.55,
    },
    {
      name: 'Passive-Aggressive',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias * 1.1 + (random(11) - 0.5) * 0.18)),
      direction: 'LONG',
      confidence: 0.48 + random(12) * 0.35,
      weight: 0.45,
    },
  ];

  onlineLearningModels.forEach(m => {
    m.direction = m.probability >= 0.5 ? 'LONG' : 'SHORT';
  });

  // Vintage Ensemble (4 historical versions)
  const vintageModels: ModelPrediction[] = [
    {
      name: 'v2026-01-04 (Latest)',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias * 0.9 + (random(13) - 0.5) * 0.12)),
      direction: 'LONG',
      confidence: 0.62 + random(14) * 0.25,
      weight: 0.40,
    },
    {
      name: 'v2026-01-03',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias * 0.8 + (random(15) - 0.5) * 0.12)),
      direction: 'LONG',
      confidence: 0.58 + random(16) * 0.25,
      weight: 0.30,
    },
    {
      name: 'v2026-01-02',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias * 0.7 + (random(17) - 0.5) * 0.12)),
      direction: 'LONG',
      confidence: 0.55 + random(18) * 0.25,
      weight: 0.20,
    },
    {
      name: 'v2026-01-01',
      probability: Math.max(0.35, Math.min(0.65, 0.5 + baseBias * 0.6 + (random(19) - 0.5) * 0.12)),
      direction: 'LONG',
      confidence: 0.52 + random(20) * 0.25,
      weight: 0.10,
    },
  ];

  vintageModels.forEach(m => {
    m.direction = m.probability >= 0.5 ? 'LONG' : 'SHORT';
  });

  // Helper to combine models
  const combineModels = (models: ModelPrediction[]) => {
    let totalWeight = 0;
    let weightedProb = 0;
    let weightedConf = 0;
    
    for (const m of models) {
      weightedProb += m.probability * m.weight;
      weightedConf += m.confidence * m.weight;
      totalWeight += m.weight;
    }
    
    const prob = weightedProb / totalWeight;
    return {
      probability: prob,
      direction: (prob >= 0.5 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
      confidence: weightedConf / totalWeight,
    };
  };

  const rwCombined = combineModels(rollingWindowModels);
  const olCombined = combineModels(onlineLearningModels);
  const veCombined = combineModels(vintageModels);

  return [
    {
      paradigm: 'Rolling Window',
      models: rollingWindowModels,
      combinedProbability: rwCombined.probability,
      combinedDirection: rwCombined.direction,
      combinedConfidence: rwCombined.confidence,
      weight: 0.50,
      latencyMs: 12 + random(21) * 8,
      description: 'Traditional ML models retrained nightly on rolling 5-year windows',
      icon: <Cpu className="w-5 h-5" />,
      color: 'cyan',
    },
    {
      paradigm: 'Online Learning',
      models: onlineLearningModels,
      combinedProbability: olCombined.probability,
      combinedDirection: olCombined.direction,
      combinedConfidence: olCombined.confidence,
      weight: 0.25,
      latencyMs: 2 + random(22) * 3,
      description: 'Adaptive models that update in real-time with each new data point',
      icon: <Zap className="w-5 h-5" />,
      color: 'yellow',
    },
    {
      paradigm: 'Vintage Ensemble',
      models: vintageModels,
      combinedProbability: veCombined.probability,
      combinedDirection: veCombined.direction,
      combinedConfidence: veCombined.confidence,
      weight: 0.25,
      latencyMs: 18 + random(23) * 10,
      description: 'Ensemble of last 4 model versions with recency-weighted averaging',
      icon: <History className="w-5 h-5" />,
      color: 'purple',
    },
  ];
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const DirectionBadge: React.FC<{ 
  direction: 'LONG' | 'SHORT'; 
  confidence: number;
  size?: 'sm' | 'md' | 'lg';
}> = ({ direction, confidence, size = 'md' }) => {
  const isLong = direction === 'LONG';
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-2 text-base font-semibold',
  };
  
  return (
    <div className={`
      inline-flex items-center gap-1.5 rounded-full font-medium
      ${sizeClasses[size]}
      ${isLong 
        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
        : 'bg-red-500/20 text-red-400 border border-red-500/30'}
    `}>
      {isLong ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
      <span>{direction}</span>
      <span className="opacity-70">({(confidence * 100).toFixed(0)}%)</span>
    </div>
  );
};

const ProbabilityBar: React.FC<{ probability: number; height?: string }> = ({ probability, height = 'h-2' }) => {
  const percentage = probability * 100;
  const isLong = probability >= 0.5;
  
  return (
    <div className={`relative ${height} bg-gray-800 rounded-full overflow-hidden`}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-gray-600 z-10" />
      <motion.div 
        className={`absolute inset-y-0 ${isLong ? 'bg-emerald-500' : 'bg-red-500'}`}
        initial={{ width: 0 }}
        animate={{
          left: isLong ? '50%' : `${percentage}%`,
          right: isLong ? `${100 - percentage}%` : '50%',
        }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  );
};

const ParadigmCard: React.FC<{ 
  paradigm: ParadigmResult; 
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ paradigm, isExpanded, onToggle }) => {
  const colorClasses: Record<string, string> = {
    cyan: 'border-cyan-500/30 bg-cyan-900/10',
    yellow: 'border-yellow-500/30 bg-yellow-900/10',
    purple: 'border-purple-500/30 bg-purple-900/10',
  };

  const iconColorClasses: Record<string, string> = {
    cyan: 'text-cyan-400 bg-cyan-500/20',
    yellow: 'text-yellow-400 bg-yellow-500/20',
    purple: 'text-purple-400 bg-purple-500/20',
  };

  return (
    <motion.div 
      className={`rounded-xl border ${colorClasses[paradigm.color]} overflow-hidden`}
      layout
    >
      {/* Header */}
      <div 
        className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${iconColorClasses[paradigm.color]}`}>
              {paradigm.icon}
            </div>
            <div>
              <h3 className="font-semibold text-white">{paradigm.paradigm}</h3>
              <p className="text-xs text-gray-500">{paradigm.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DirectionBadge 
              direction={paradigm.combinedDirection} 
              confidence={paradigm.combinedConfidence}
              size="sm"
            />
            <div className="text-right">
              <div className="text-xs text-gray-500">Weight</div>
              <div className="font-mono text-sm text-white">{(paradigm.weight * 100).toFixed(0)}%</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500">Latency</div>
              <div className="font-mono text-sm text-gray-400">{paradigm.latencyMs.toFixed(1)}ms</div>
            </div>
            {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
          </div>
        </div>
        
        {/* Probability bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>SHORT</span>
            <span className="font-mono">{(paradigm.combinedProbability * 100).toFixed(1)}%</span>
            <span>LONG</span>
          </div>
          <ProbabilityBar probability={paradigm.combinedProbability} />
        </div>
      </div>

      {/* Expanded Model Details */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-gray-800/50"
          >
            <div className="p-4 space-y-2">
              <h4 className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Individual Models ({paradigm.models.length})
              </h4>
              {paradigm.models.map((model, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 px-3 bg-gray-900/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${model.direction === 'LONG' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                    <span className="text-sm text-white">{model.name}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className={`text-sm font-mono ${model.direction === 'LONG' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {(model.probability * 100).toFixed(1)}%
                    </span>
                    <span className="text-xs text-gray-500">
                      conf: {(model.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="text-xs text-gray-600">
                      wt: {(model.weight * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const MultiParadigmDashboard: React.FC<MultiParadigmDashboardProps> = () => {
  // State
  const [assets, setAssets] = useState<AssetData[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('AAPL');
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [expandedParadigm, setExpandedParadigm] = useState<string | null>('Rolling Window');
  
  // User-controlled paradigm weights
  const [userWeights, setUserWeights] = useState({
    'rolling-window': 0.40,
    'online-learning': 0.20,
    'vintage-ensemble': 0.40,
  });
  const [useCustomWeights, setUseCustomWeights] = useState(false);
  const [showWeightControls, setShowWeightControls] = useState(false);
  
  // Real prediction state
  const [realPrediction, setRealPrediction] = useState<MetaEnsemblePrediction | null>(null);
  const [paradigmStatus, setParadigmStatus] = useState<{
    rollingWindow: boolean;
    onlineLearning: boolean;
    vintageEnsemble: boolean;
    vintageCount: number;
  } | null>(null);
  const [usingRealModels, setUsingRealModels] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);
  
  const initRef = useRef(false);

  // Initialize meta-ensemble service
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    
    const initService = async () => {
      setIsInitializing(true);
      try {
        const ready = await metaEnsembleService.initialize();
        if (ready) {
          const status = metaEnsembleService.getParadigmStatus();
          setParadigmStatus(status);
          setUsingRealModels(status.onlineLearning || status.vintageEnsemble);
          console.log('✅ Multi-Paradigm Service initialized:', status);
        }
      } catch (err) {
        console.warn('⚠️ Multi-Paradigm Service init failed:', err);
      } finally {
        setIsInitializing(false);
      }
    };
    
    initService();
  }, []);

  // Load assets
  useEffect(() => {
    const loadAssets = async () => {
      setIsLoading(true);
      try {
        const allAssets = getAllMLAssets();
        if (allAssets.length > 0) {
          setAssets(allAssets);
        } else {
          // Default demo assets
          setAssets([
            { symbol: 'AAPL', currentPrice: 185.50, priceChangePercent24h: 1.2 } as AssetData,
            { symbol: 'MSFT', currentPrice: 378.20, priceChangePercent24h: 0.8 } as AssetData,
            { symbol: 'GOOGL', currentPrice: 142.80, priceChangePercent24h: -0.5 } as AssetData,
            { symbol: 'NVDA', currentPrice: 495.60, priceChangePercent24h: 2.1 } as AssetData,
            { symbol: 'TSLA', currentPrice: 248.30, priceChangePercent24h: -1.8 } as AssetData,
            { symbol: 'SPY', currentPrice: 475.80, priceChangePercent24h: 0.3 } as AssetData,
            { symbol: 'BTC-USD', currentPrice: 45200, priceChangePercent24h: 1.5 } as AssetData,
          ]);
        }
        setLastUpdate(new Date());
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAssets();
  }, []);

  // Get selected asset data
  const selectedAsset = useMemo(() => {
    return assets.find(a => a.symbol === selectedSymbol) || {
      symbol: selectedSymbol,
      currentPrice: 100,
      priceChangePercent24h: 0,
    } as AssetData;
  }, [assets, selectedSymbol]);

  // Run real prediction when asset changes
  useEffect(() => {
    const runPrediction = async () => {
      if (!selectedAsset || isInitializing) return;
      
      setPredictionError(null);
      
      try {
        // Calculate features from asset data
        const features = calculateFeatures(selectedAsset);
        if (!features) {
          setPredictionError('Unable to calculate features for this asset');
          return;
        }
        
        // Normalize features
        const normalizedFeatures = normalizeFeatures(features);
        
        // Run meta-ensemble prediction
        if (metaEnsembleService.isReady()) {
          const prediction = await metaEnsembleService.predict(normalizedFeatures);
          setRealPrediction(prediction);
          setUsingRealModels(true);
          console.log(`✅ Real prediction for ${selectedSymbol}:`, prediction);
        } else {
          setUsingRealModels(false);
        }
      } catch (err) {
        console.error('Prediction error:', err);
        setPredictionError(err instanceof Error ? err.message : 'Prediction failed');
        setUsingRealModels(false);
      }
      
      setLastUpdate(new Date());
    };
    
    runPrediction();
  }, [selectedAsset, selectedSymbol, isInitializing, userWeights, useCustomWeights]);

  // Update metaEnsembleService when user changes weights
  useEffect(() => {
    if (useCustomWeights) {
      metaEnsembleService.setRegimeSwitching(false);
      metaEnsembleService.setParadigmWeights(userWeights);
    } else {
      metaEnsembleService.setRegimeSwitching(true);
    }
  }, [userWeights, useCustomWeights]);

  // Get current effective weights for display
  const effectiveWeights = useMemo(() => {
    if (realPrediction && realPrediction.paradigms.length > 0) {
      // Use actual weights from the prediction
      const weights: Record<string, number> = {};
      for (const p of realPrediction.paradigms) {
        weights[p.paradigm] = p.weight;
      }
      return weights;
    }
    return userWeights;
  }, [realPrediction, userWeights]);

  // Transform real prediction to display format, or use demo
  const paradigmResults = useMemo((): ParadigmResult[] => {
    // If we have real predictions, transform them
    if (realPrediction && realPrediction.paradigms.length > 0) {
      return realPrediction.paradigms.map((p: ServiceParadigmPrediction) => {
        const iconMap: Record<string, React.ReactNode> = {
          'rolling-window': <Cpu className="w-5 h-5" />,
          'online-learning': <Zap className="w-5 h-5" />,
          'vintage-ensemble': <History className="w-5 h-5" />,
        };
        const colorMap: Record<string, string> = {
          'rolling-window': 'cyan',
          'online-learning': 'yellow',
          'vintage-ensemble': 'purple',
        };
        const nameMap: Record<string, string> = {
          'rolling-window': 'Rolling Window',
          'online-learning': 'Online Learning',
          'vintage-ensemble': 'Vintage Ensemble',
        };
        const descMap: Record<string, string> = {
          'rolling-window': 'TensorFlow.js models trained on rolling 5-year windows (REAL)',
          'online-learning': 'SGD/PA classifiers with real-time adaptation (REAL)',
          'vintage-ensemble': 'Ensemble of historical model versions (REAL)',
        };
        
        return {
          paradigm: nameMap[p.paradigm] || p.paradigm,
          models: p.models.map(m => ({
            name: m.name,
            probability: m.probability,
            direction: m.direction,
            confidence: m.confidence,
            weight: m.weight,
          })),
          combinedProbability: p.combinedProbability,
          combinedDirection: p.combinedDirection,
          combinedConfidence: p.combinedConfidence,
          weight: p.weight,
          latencyMs: p.latencyMs,
          description: descMap[p.paradigm] || '',
          icon: iconMap[p.paradigm] || <Cpu className="w-5 h-5" />,
          color: colorMap[p.paradigm] || 'cyan',
        };
      });
    }
    
    // Fall back to demo predictions
    return generateDemoPredictions(
      selectedSymbol,
      selectedAsset.currentPrice,
      selectedAsset.priceChangePercent24h
    );
  }, [realPrediction, selectedSymbol, selectedAsset]);

  // Calculate meta-ensemble from paradigm results
  const metaEnsemble = useMemo(() => {
    // If we have real prediction, use it directly
    if (realPrediction) {
      return {
        finalProbability: realPrediction.finalProbability,
        finalDirection: realPrediction.finalDirection,
        finalConfidence: realPrediction.finalConfidence,
        paradigmAgreement: realPrediction.paradigmAgreement,
        totalLatency: realPrediction.totalLatencyMs,
      };
    }
    
    // Otherwise calculate from demo paradigms
    let totalWeight = 0;
    let weightedProb = 0;
    let weightedConf = 0;
    let totalLatency = 0;

    for (const p of paradigmResults) {
      weightedProb += p.combinedProbability * p.weight;
      weightedConf += p.combinedConfidence * p.weight;
      totalWeight += p.weight;
      totalLatency += p.latencyMs;
    }

    const finalProb = weightedProb / totalWeight;
    const finalConf = weightedConf / totalWeight;
    const finalDir = finalProb >= 0.5 ? 'LONG' : 'SHORT';

    // Calculate paradigm agreement
    const directions = paradigmResults.map(p => p.combinedDirection);
    const agreement = directions.filter(d => d === finalDir).length / directions.length;

    return {
      finalProbability: finalProb,
      finalDirection: finalDir as 'LONG' | 'SHORT',
      finalConfidence: finalConf,
      paradigmAgreement: agreement,
      totalLatency,
    };
  }, [paradigmResults, realPrediction]);

  // Refresh predictions
  const handleRefresh = useCallback(async () => {
    if (!selectedAsset || isInitializing) return;
    
    setIsLoading(true);
    setPredictionError(null);
    
    try {
      const features = calculateFeatures(selectedAsset);
      if (features && metaEnsembleService.isReady()) {
        const normalizedFeatures = normalizeFeatures(features);
        const prediction = await metaEnsembleService.predict(normalizedFeatures);
        setRealPrediction(prediction);
        setUsingRealModels(true);
      }
    } catch (err) {
      console.error('Refresh error:', err);
      setPredictionError(err instanceof Error ? err.message : 'Refresh failed');
    } finally {
      setIsLoading(false);
      setLastUpdate(new Date());
    }
  }, [selectedAsset, isInitializing]);

  return (
    <div className="space-y-6">
      {/* Model Status Banner */}
      <div className={`rounded-xl border p-4 flex items-center justify-between ${
        usingRealModels 
          ? 'bg-emerald-900/20 border-emerald-500/30' 
          : 'bg-amber-900/20 border-amber-500/30'
      }`}>
        <div className="flex items-center gap-3">
          {usingRealModels ? (
            <>
              <CheckCircle className="w-5 h-5 text-emerald-400" />
              <div>
                <span className="text-emerald-400 font-semibold">REAL ML MODELS ACTIVE</span>
                <span className="text-gray-400 text-sm ml-2">
                  Using trained models from {paradigmStatus?.onlineLearning ? 'Online Learning' : ''} 
                  {paradigmStatus?.onlineLearning && paradigmStatus?.vintageEnsemble ? ' + ' : ''}
                  {paradigmStatus?.vintageEnsemble ? `Vintage Ensemble (${paradigmStatus.vintageCount} versions)` : ''}
                </span>
              </div>
            </>
          ) : (
            <>
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <div>
                <span className="text-amber-400 font-semibold">DEMO MODE</span>
                <span className="text-gray-400 text-sm ml-2">
                  {isInitializing ? 'Initializing models...' : 'ML models not loaded - showing simulated predictions'}
                </span>
              </div>
            </>
          )}
        </div>
        {paradigmStatus && (
          <div className="flex items-center gap-4 text-xs">
            <div className={`flex items-center gap-1 ${paradigmStatus.rollingWindow ? 'text-cyan-400' : 'text-gray-500'}`}>
              <Cpu className="w-3 h-3" />
              <span>Rolling</span>
              {paradigmStatus.rollingWindow ? <CheckCircle className="w-3 h-3" /> : null}
            </div>
            <div className={`flex items-center gap-1 ${paradigmStatus.onlineLearning ? 'text-yellow-400' : 'text-gray-500'}`}>
              <Zap className="w-3 h-3" />
              <span>Online</span>
              {paradigmStatus.onlineLearning ? <CheckCircle className="w-3 h-3" /> : null}
            </div>
            <div className={`flex items-center gap-1 ${paradigmStatus.vintageEnsemble ? 'text-purple-400' : 'text-gray-500'}`}>
              <History className="w-3 h-3" />
              <span>Vintage ({paradigmStatus.vintageCount})</span>
              {paradigmStatus.vintageEnsemble ? <CheckCircle className="w-3 h-3" /> : null}
            </div>
          </div>
        )}
      </div>

      {/* Error Display */}
      {predictionError && (
        <div className="bg-red-900/20 border border-red-500/30 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{predictionError}</span>
        </div>
      )}

      {/* Explanation Banner */}
      <div className="bg-gradient-to-r from-purple-900/30 via-blue-900/30 to-cyan-900/30 rounded-2xl border border-purple-500/20 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <Layers className="w-8 h-8 text-purple-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-2">Multi-Paradigm ML Ensemble</h2>
            <p className="text-gray-400 mb-4">
              This advanced approach combines <span className="text-cyan-400">three distinct ML paradigms</span> to create more robust predictions. 
              Each paradigm has different strengths that complement each other across varying market conditions.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div className="flex items-start gap-3 p-3 bg-cyan-900/20 rounded-lg border border-cyan-500/20">
                <Cpu className="w-5 h-5 text-cyan-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-cyan-300 text-sm">Rolling Window</h4>
                  <p className="text-xs text-gray-400">4 tree-based models retrained nightly on 5-year rolling data</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-yellow-900/20 rounded-lg border border-yellow-500/20">
                <Zap className="w-5 h-5 text-yellow-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-300 text-sm">Online Learning</h4>
                  <p className="text-xs text-gray-400">2 adaptive models that update in real-time with new data</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 bg-purple-900/20 rounded-lg border border-purple-500/20">
                <History className="w-5 h-5 text-purple-400 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-purple-300 text-sm">Vintage Ensemble</h4>
                  <p className="text-xs text-gray-400">4 historical model versions with recency-weighted voting</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Asset Selector & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-900/50 rounded-xl border border-gray-800/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-400">Asset:</span>
            <select
              value={selectedSymbol}
              onChange={(e) => setSelectedSymbol(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              {assets.length > 0 ? (
                assets.map(asset => (
                  <option key={asset.symbol} value={asset.symbol}>
                    {asset.symbol} (${asset.currentPrice?.toFixed(2) || '0.00'})
                  </option>
                ))
              ) : (
                <option value="AAPL">AAPL</option>
              )}
            </select>
          </div>
          
          <div className="flex items-center gap-2 text-sm">
            <span className={`font-semibold ${selectedAsset.priceChangePercent24h >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {selectedAsset.priceChangePercent24h >= 0 ? '+' : ''}{selectedAsset.priceChangePercent24h?.toFixed(2) || '0.00'}%
            </span>
            <span className="text-gray-500">24h</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {lastUpdate && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Clock className="w-4 h-4" />
              Last updated: {lastUpdate.toLocaleTimeString()}
            </div>
          )}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 rounded-lg text-sm font-medium text-white transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Meta-Ensemble Final Signal */}
      <motion.div 
        className="bg-gradient-to-r from-cyan-900/40 to-purple-900/40 rounded-2xl border-2 border-cyan-500/40 p-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-cyan-500/30 to-purple-500/30 rounded-xl">
              <Target className="w-8 h-8 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">META-ENSEMBLE SIGNAL</h3>
              <p className="text-sm text-gray-400">
                Combined prediction from all {paradigmResults.length} paradigms ({paradigmResults.reduce((acc, p) => acc + p.models.length, 0)} models)
              </p>
            </div>
          </div>
          
          <DirectionBadge 
            direction={metaEnsemble.finalDirection} 
            confidence={metaEnsemble.finalConfidence}
            size="lg"
          />
        </div>

        {/* Meta stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Probability</div>
            <div className="text-xl font-bold font-mono text-white">
              {(metaEnsemble.finalProbability * 100).toFixed(1)}%
            </div>
          </div>
          
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Confidence</div>
            <div className="text-xl font-bold font-mono text-white">
              {(metaEnsemble.finalConfidence * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Paradigm Agreement</div>
            <div className={`text-xl font-bold font-mono ${metaEnsemble.paradigmAgreement >= 0.66 ? 'text-emerald-400' : metaEnsemble.paradigmAgreement >= 0.5 ? 'text-yellow-400' : 'text-red-400'}`}>
              {(metaEnsemble.paradigmAgreement * 100).toFixed(0)}%
            </div>
          </div>
          
          <div className="bg-gray-900/50 rounded-lg p-3">
            <div className="text-xs text-gray-500 mb-1">Total Latency</div>
            <div className="text-xl font-bold font-mono text-gray-300">
              {metaEnsemble.totalLatency.toFixed(1)}ms
            </div>
          </div>
        </div>

        {/* Probability bar */}
        <div className="mt-4">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span className="flex items-center gap-1">
              <TrendingDown className="w-4 h-4 text-red-400" /> SHORT
            </span>
            <span className="font-mono font-bold text-white">
              {metaEnsemble.finalDirection} @ {(metaEnsemble.finalProbability * 100).toFixed(1)}%
            </span>
            <span className="flex items-center gap-1">
              LONG <TrendingUp className="w-4 h-4 text-emerald-400" />
            </span>
          </div>
          <ProbabilityBar probability={metaEnsemble.finalProbability} height="h-4" />
        </div>
      </motion.div>

      {/* Paradigm Cards */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Workflow className="w-5 h-5 text-purple-400" />
          Paradigm Breakdown
        </h3>
        
        {paradigmResults.map((paradigm) => (
          <ParadigmCard
            key={paradigm.paradigm}
            paradigm={paradigm}
            isExpanded={expandedParadigm === paradigm.paradigm}
            onToggle={() => setExpandedParadigm(
              expandedParadigm === paradigm.paradigm ? null : paradigm.paradigm
            )}
          />
        ))}
      </div>

      {/* Weight Controls & Architecture Info */}
      <div className="bg-gray-900/30 rounded-xl border border-gray-800/50 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <Info className="w-5 h-5 text-gray-400" />
            How Multi-Paradigm Works
          </h3>
          <button
            onClick={() => setShowWeightControls(!showWeightControls)}
            className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium transition-colors"
          >
            <Gauge className="w-4 h-4" />
            {showWeightControls ? 'Hide' : 'Adjust'} Weights
            {showWeightControls ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
        
        {/* Weight Control Panel */}
        <AnimatePresence>
          {showWeightControls && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-gray-800/50 rounded-xl p-4 border border-purple-500/30">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-semibold text-purple-300">Custom Weight Configuration</h4>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useCustomWeights}
                      onChange={(e) => setUseCustomWeights(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500"
                    />
                    <span className="text-sm text-gray-300">
                      {useCustomWeights ? 'Custom weights enabled' : 'Using regime-based weights'}
                    </span>
                  </label>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4">
                  {/* Rolling Window Weight */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-cyan-400 font-medium flex items-center gap-2">
                        <Cpu className="w-4 h-4" />
                        Rolling Window
                      </label>
                      <span className="text-sm font-mono text-white">
                        {Math.round((effectiveWeights['rolling-window'] || userWeights['rolling-window']) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={userWeights['rolling-window'] * 100}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) / 100;
                        setUserWeights(prev => ({ ...prev, 'rolling-window': newValue }));
                      }}
                      disabled={!useCustomWeights}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                        useCustomWeights ? 'bg-cyan-900' : 'bg-gray-700 opacity-50'
                      }`}
                      style={{
                        background: useCustomWeights 
                          ? `linear-gradient(to right, #06b6d4 0%, #06b6d4 ${userWeights['rolling-window'] * 100}%, #1f2937 ${userWeights['rolling-window'] * 100}%, #1f2937 100%)`
                          : undefined
                      }}
                    />
                  </div>
                  
                  {/* Online Learning Weight */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-yellow-400 font-medium flex items-center gap-2">
                        <Zap className="w-4 h-4" />
                        Online Learning
                      </label>
                      <span className="text-sm font-mono text-white">
                        {Math.round((effectiveWeights['online-learning'] || userWeights['online-learning']) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={userWeights['online-learning'] * 100}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) / 100;
                        setUserWeights(prev => ({ ...prev, 'online-learning': newValue }));
                      }}
                      disabled={!useCustomWeights}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                        useCustomWeights ? 'bg-yellow-900' : 'bg-gray-700 opacity-50'
                      }`}
                      style={{
                        background: useCustomWeights 
                          ? `linear-gradient(to right, #eab308 0%, #eab308 ${userWeights['online-learning'] * 100}%, #1f2937 ${userWeights['online-learning'] * 100}%, #1f2937 100%)`
                          : undefined
                      }}
                    />
                  </div>
                  
                  {/* Vintage Ensemble Weight */}
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-sm text-purple-400 font-medium flex items-center gap-2">
                        <History className="w-4 h-4" />
                        Vintage Ensemble
                      </label>
                      <span className="text-sm font-mono text-white">
                        {Math.round((effectiveWeights['vintage-ensemble'] || userWeights['vintage-ensemble']) * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={userWeights['vintage-ensemble'] * 100}
                      onChange={(e) => {
                        const newValue = parseInt(e.target.value) / 100;
                        setUserWeights(prev => ({ ...prev, 'vintage-ensemble': newValue }));
                      }}
                      disabled={!useCustomWeights}
                      className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${
                        useCustomWeights ? 'bg-purple-900' : 'bg-gray-700 opacity-50'
                      }`}
                      style={{
                        background: useCustomWeights 
                          ? `linear-gradient(to right, #a855f7 0%, #a855f7 ${userWeights['vintage-ensemble'] * 100}%, #1f2937 ${userWeights['vintage-ensemble'] * 100}%, #1f2937 100%)`
                          : undefined
                      }}
                    />
                  </div>
                </div>
                
                <div className="mt-4 pt-4 border-t border-gray-700/50 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Total: {Math.round((userWeights['rolling-window'] + userWeights['online-learning'] + userWeights['vintage-ensemble']) * 100)}%
                    {' '}(weights are auto-normalized to 100%)
                  </span>
                  <span className={useCustomWeights ? 'text-purple-400' : 'text-gray-500'}>
                    {useCustomWeights ? '⚡ Custom mode - predictions update in real-time' : '🔄 Regime-switching mode active'}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h4 className="text-sm font-semibold text-cyan-400 mb-2">Why Multiple Paradigms?</h4>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Rolling Window</strong> captures stable patterns from historical data</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Online Learning</strong> adapts quickly to regime changes</span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                <span><strong className="text-white">Vintage Ensemble</strong> provides stability through model averaging</span>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-purple-400 mb-2">Current Weights</h4>
            <ul className="text-sm text-gray-400 space-y-2">
              <li className="flex items-start gap-2">
                <Gauge className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <span>{useCustomWeights ? 'Custom weights (user-defined)' : 'Regime-adaptive weighting'}</span>
              </li>
              <li className="flex items-start gap-2">
                <Timer className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <span>
                  Rolling: <span className="text-cyan-400 font-mono">{Math.round((effectiveWeights['rolling-window'] || 0) * 100)}%</span>,{' '}
                  Online: <span className="text-yellow-400 font-mono">{Math.round((effectiveWeights['online-learning'] || 0) * 100)}%</span>,{' '}
                  Vintage: <span className="text-purple-400 font-mono">{Math.round((effectiveWeights['vintage-ensemble'] || 0) * 100)}%</span>
                </span>
              </li>
              <li className="flex items-start gap-2">
                <Brain className="w-4 h-4 text-purple-400 mt-0.5 flex-shrink-0" />
                <span>Agreement indicator shows paradigm consensus</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MultiParadigmDashboard;
