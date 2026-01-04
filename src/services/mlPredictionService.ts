// ============================================================================
// ML PREDICTION SERVICE - Real-Time Model Inference
// Runs ensemble predictions using TensorFlow.js with REAL trained models
// Models are loaded from GitHub Pages (trained nightly via GitHub Actions)
// ============================================================================

import { type AssetData, getAllMLAssets, hasMLData } from './mlDataLayer';
import { type FeatureVector, calculateFeatures, normalizeFeatures } from './featureEngineering';
import { 
  getTopModels, 
  getEnsembleWeights, 
  getModelWeights,
  type ModelVersion,
  type ModelMetrics,
} from './modelRegistry';

// Import TensorFlow.js model loader
import { 
  modelLoader, 
  initializeModels, 
  runPrediction as runTfjsPrediction,
  type ModelMetrics as TfjsModelMetrics 
} from './tfjsModelLoader';

// Import meta-ensemble service to connect TFJS models
import { metaEnsembleService } from './metaEnsemble';

// Flag to control whether to use real TensorFlow.js models
// Falls back to simulated models if TFJS loading fails
let useTfjsModels = false;
let tfjsInitAttempted = false;

/**
 * Initialize TensorFlow.js models (call on app startup)
 */
export async function initializeTfjsModels(): Promise<boolean> {
  if (tfjsInitAttempted) {
    return useTfjsModels;
  }
  
  tfjsInitAttempted = true;
  
  try {
    console.log('🚀 Attempting to load real TensorFlow.js models...');
    const success = await initializeModels();
    
    if (success) {
      useTfjsModels = true;
      console.log('✅ Real TensorFlow.js models loaded successfully!');
      console.log('📊 Model metrics:', modelLoader.getEnsembleMetrics());
      
      // Connect TFJS models to meta-ensemble service for multi-paradigm predictions
      metaEnsembleService.setRollingWindowPredictor(async (features: number[]) => {
        const result = await runTfjsPrediction(features);
        return result.modelPredictions.map(mp => ({
          name: mp.modelId.charAt(0).toUpperCase() + mp.modelId.slice(1),
          probability: mp.prediction,
          direction: (mp.prediction >= 0.5 ? 'LONG' : 'SHORT') as 'LONG' | 'SHORT',
          confidence: Math.abs(mp.prediction - 0.5) * 2,
          weight: mp.weight,
        }));
      });
      console.log('🔗 Connected TFJS models to Meta-Ensemble Service');
    } else {
      console.warn('⚠️ TensorFlow.js models failed to load, using simulated models');
      useTfjsModels = false;
    }
    
    return useTfjsModels;
  } catch (error) {
    console.error('❌ TensorFlow.js initialization error:', error);
    useTfjsModels = false;
    return false;
  }
}

/**
 * Check if real models are loaded
 */
export function isUsingRealModels(): boolean {
  return useTfjsModels && modelLoader.isInitialized();
}

/**
 * Get real model health status
 */
export function getRealModelStatus(): {
  isReal: boolean;
  status: 'healthy' | 'degraded' | 'error' | 'not_loaded';
  modelsLoaded: number;
  lastUpdate: string;
} {
  if (!useTfjsModels || !modelLoader.isInitialized()) {
    return {
      isReal: false,
      status: 'not_loaded',
      modelsLoaded: 0,
      lastUpdate: 'N/A'
    };
  }
  
  const health = modelLoader.getHealthStatus();
  return {
    isReal: true,
    status: health.status,
    modelsLoaded: health.modelsLoaded,
    lastUpdate: health.lastUpdate
  };
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface PredictionResult {
  symbol: string;
  assetClass: 'stock' | 'etf' | 'crypto' | 'index';
  
  // Prediction output
  prediction: number;           // Raw prediction score (0-1)
  signal: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  confidence: number;           // Confidence level (0-1)
  
  // Individual model predictions
  modelPredictions: {
    modelId: string;
    modelType: string;
    prediction: number;
    weight: number;
  }[];
  
  // Model source tracking - important for user transparency
  isRealModel: boolean;         // true = TFJS model, false = simulated fallback
  modelSource: 'tfjs' | 'simulated';
  
  // Risk metrics
  expectedReturn: number;       // Expected return (%)
  stopLoss: number;            // Suggested stop loss price
  takeProfit: number;          // Suggested take profit price
  positionSize: number;        // Suggested position size (% of portfolio)
  riskRewardRatio: number;     // Risk/Reward ratio
  
  // Current price info
  currentPrice: number;
  priceChange24h: number;
  
  // Timing
  timestamp: number;
  latencyMs: number;
  
  // Feature insights
  topFeatures: { name: string; value: number; impact: 'positive' | 'negative' }[];
}

export interface PredictionCache {
  predictions: Map<string, PredictionResult>;
  lastUpdate: number;
  isFetching: boolean;
}

// ============================================================================
// PREDICTION CACHE
// ============================================================================

const predictionCache: PredictionCache = {
  predictions: new Map(),
  lastUpdate: 0,
  isFetching: false,
};

const PREDICTION_CACHE_TTL = 60000; // 1 minute
let predictionPromise: Promise<void> | null = null;

// ============================================================================
// SIMULATED MODEL INFERENCE
// These functions simulate the inference of pre-trained models
// In production, this would call TensorFlow Serving or similar
// ============================================================================

/**
 * Simulate gradient boosting prediction (LightGBM, XGBoost, CatBoost, RandomForest)
 * Uses decision tree-like logic based on feature values
 */
function predictGradientBoosting(
  features: number[], 
  weights: number[], 
  modelType: 'lightgbm' | 'xgboost' | 'catboost' | 'randomforest'
): number {
  // Simulate gradient boosting with multiple weak learners
  const numTrees = modelType === 'lightgbm' ? 50 : modelType === 'xgboost' ? 40 : modelType === 'catboost' ? 45 : 30;
  let prediction = 0;
  
  for (let tree = 0; tree < numTrees; tree++) {
    // Each tree uses a subset of features
    const treeStart = tree * Math.floor(weights.length / numTrees);
    let treeOutput = 0;
    
    for (let i = 0; i < features.length && i < 8; i++) {
      const weightIdx = (treeStart + i) % weights.length;
      const threshold = (weights[weightIdx] + 1) / 2; // Map to [0, 1]
      
      // Decision stump: if feature > threshold, contribute positively
      if (features[i] > threshold) {
        treeOutput += weights[(weightIdx + 1) % weights.length] * 0.02;
      } else {
        treeOutput -= weights[(weightIdx + 2) % weights.length] * 0.01;
      }
    }
    
    prediction += treeOutput / numTrees;
  }
  
  // Sigmoid activation to get probability
  return 1 / (1 + Math.exp(-prediction * 5));
}

/**
 * Simulate LSTM recurrent neural network prediction
 * Uses sequential processing of features
 */
function predictLSTM(features: number[], weights: number[]): number {
  // Simulate LSTM hidden state
  let hiddenState = 0;
  let cellState = 0;
  
  // Process features sequentially
  for (let i = 0; i < features.length; i++) {
    const weightIdx = i * 4 % weights.length;
    
    // Simplified LSTM gates
    const forgetGate = sigmoid(features[i] * weights[weightIdx] + hiddenState * 0.5);
    const inputGate = sigmoid(features[i] * weights[(weightIdx + 1) % weights.length] + hiddenState * 0.3);
    const outputGate = sigmoid(features[i] * weights[(weightIdx + 2) % weights.length] + hiddenState * 0.4);
    const candidateCell = Math.tanh(features[i] * weights[(weightIdx + 3) % weights.length]);
    
    cellState = forgetGate * cellState + inputGate * candidateCell;
    hiddenState = outputGate * Math.tanh(cellState);
  }
  
  // Final output layer
  return sigmoid(hiddenState + 0.5);
}

/**
 * Simulate Transformer attention-based prediction
 * Uses self-attention mechanism on features
 */
function predictTransformer(features: number[], weights: number[]): number {
  // Create query, key, value vectors
  const d_k = 4;
  const numHeads = 2;
  let attentionOutput = 0;
  
  for (let head = 0; head < numHeads; head++) {
    const headOffset = head * features.length;
    
    // Self-attention scores
    let attentionSum = 0;
    let valueSum = 0;
    
    for (let i = 0; i < features.length; i++) {
      const queryWeight = weights[(headOffset + i) % weights.length];
      const keyWeight = weights[(headOffset + i + features.length) % weights.length];
      const valueWeight = weights[(headOffset + i + features.length * 2) % weights.length];
      
      const query = features[i] * queryWeight;
      const key = features[i] * keyWeight;
      const value = features[i] * valueWeight;
      
      const score = Math.exp(query * key / Math.sqrt(d_k));
      attentionSum += score;
      valueSum += score * value;
    }
    
    attentionOutput += valueSum / (attentionSum || 1);
  }
  
  // Average across heads and apply output projection
  return sigmoid(attentionOutput / numHeads);
}

/**
 * Sigmoid activation function
 */
function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, x))));
}

// ============================================================================
// ENSEMBLE PREDICTION
// ============================================================================

/**
 * Run ensemble prediction across all models
 */
function runEnsemblePrediction(
  features: number[],
  models: ModelVersion[],
  ensembleWeights: Record<string, number>
): { prediction: number; modelPredictions: PredictionResult['modelPredictions'] } {
  const modelPredictions: PredictionResult['modelPredictions'] = [];
  let weightedSum = 0;
  let totalWeight = 0;
  
  for (const model of models) {
    const modelWeights = getModelWeights(model.id);
    if (!modelWeights) continue;
    
    let prediction: number;
    
    // Run model-specific inference
    switch (model.type) {
      case 'lightgbm':
        prediction = predictGradientBoosting(features, modelWeights.weights, 'lightgbm');
        break;
      case 'xgboost':
        prediction = predictGradientBoosting(features, modelWeights.weights, 'xgboost');
        break;
      case 'catboost':
        prediction = predictGradientBoosting(features, modelWeights.weights, 'catboost');
        break;
      case 'randomforest':
        prediction = predictGradientBoosting(features, modelWeights.weights, 'randomforest');
        break;
      default:
        prediction = 0.5;
    }
    
    const weight = ensembleWeights[model.type] || 0;
    
    modelPredictions.push({
      modelId: model.id,
      modelType: model.type,
      prediction,
      weight,
    });
    
    weightedSum += prediction * weight;
    totalWeight += weight;
  }
  
  const ensemblePrediction = totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  
  return { prediction: ensemblePrediction, modelPredictions };
}

// ============================================================================
// SIGNAL GENERATION & RISK METRICS
// ============================================================================

/**
 * Generate trading signal from prediction score
 */
function generateSignal(prediction: number): PredictionResult['signal'] {
  if (prediction >= 0.70) return 'STRONG_BUY';
  if (prediction >= 0.55) return 'BUY';
  if (prediction <= 0.30) return 'STRONG_SELL';
  if (prediction <= 0.45) return 'SELL';
  return 'HOLD';
}

/**
 * Calculate confidence based on model agreement
 */
function calculateConfidence(modelPredictions: PredictionResult['modelPredictions']): number {
  if (modelPredictions.length === 0) return 0;
  
  // Calculate agreement between models
  const predictions = modelPredictions.map(m => m.prediction);
  const mean = predictions.reduce((a, b) => a + b, 0) / predictions.length;
  const variance = predictions.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / predictions.length;
  
  // Lower variance = higher confidence
  const agreement = Math.exp(-variance * 10);
  
  // Distance from 0.5 (stronger signal = higher confidence)
  const signalStrength = Math.abs(mean - 0.5) * 2;
  
  // Combine agreement and signal strength
  return Math.min(1, (agreement * 0.6 + signalStrength * 0.4));
}

/**
 * Calculate risk metrics and position sizing
 */
function calculateRiskMetrics(
  prediction: number,
  confidence: number,
  currentPrice: number,
  features: FeatureVector
): {
  expectedReturn: number;
  stopLoss: number;
  takeProfit: number;
  positionSize: number;
  riskRewardRatio: number;
} {
  // Expected return based on prediction deviation from 0.5
  const signalStrength = (prediction - 0.5) * 2; // Range [-1, 1]
  const expectedReturn = signalStrength * 0.05 * confidence; // Max ±5% expected
  
  // ATR-based stop loss and take profit
  const atr = features.atr_10;
  const atrMultiplier = 2.0;
  
  const isLong = prediction > 0.5;
  
  let stopLoss: number;
  let takeProfit: number;
  
  if (isLong) {
    stopLoss = currentPrice - atr * atrMultiplier;
    takeProfit = currentPrice + atr * atrMultiplier * 1.5; // 1.5x risk-reward
  } else {
    stopLoss = currentPrice + atr * atrMultiplier;
    takeProfit = currentPrice - atr * atrMultiplier * 1.5;
  }
  
  // Position sizing using Kelly Criterion (simplified)
  // f* = (bp - q) / b where b = win/loss ratio, p = win prob, q = loss prob
  const winProb = prediction > 0.5 ? prediction : 1 - prediction;
  const lossProb = 1 - winProb;
  const winLossRatio = 1.5; // Assume 1.5:1 risk-reward
  
  const kellyFraction = (winLossRatio * winProb - lossProb) / winLossRatio;
  const positionSize = Math.max(0, Math.min(0.10, kellyFraction * 0.5)); // Half Kelly, max 10%
  
  // Risk-reward ratio
  const risk = Math.abs(currentPrice - stopLoss);
  const reward = Math.abs(takeProfit - currentPrice);
  const riskRewardRatio = risk > 0 ? reward / risk : 0;
  
  return {
    expectedReturn: expectedReturn * 100, // Convert to percentage
    stopLoss,
    takeProfit,
    positionSize: positionSize * 100, // Convert to percentage
    riskRewardRatio,
  };
}

/**
 * Extract top features for explainability
 */
function extractTopFeatures(features: FeatureVector): PredictionResult['topFeatures'] {
  const featureImpacts: { name: string; value: number; impact: 'positive' | 'negative' }[] = [];
  
  // RSI interpretation
  if (features.rsi_14 < 30) {
    featureImpacts.push({ name: 'RSI Oversold', value: features.rsi_14, impact: 'positive' });
  } else if (features.rsi_14 > 70) {
    featureImpacts.push({ name: 'RSI Overbought', value: features.rsi_14, impact: 'negative' });
  }
  
  // MACD interpretation
  if (features.macd_histogram > 0) {
    featureImpacts.push({ name: 'MACD Bullish', value: features.macd_histogram, impact: 'positive' });
  } else if (features.macd_histogram < 0) {
    featureImpacts.push({ name: 'MACD Bearish', value: features.macd_histogram, impact: 'negative' });
  }
  
  // Moving average crossover (use sma_5_10_cross)
  if (features.sma_5_10_cross > 1.02) {
    featureImpacts.push({ name: 'Bullish MA Crossover', value: features.sma_5_10_cross, impact: 'positive' });
  } else if (features.sma_5_10_cross < 0.98) {
    featureImpacts.push({ name: 'Bearish MA Crossover', value: features.sma_5_10_cross, impact: 'negative' });
  }
  
  // Volume spike
  if (features.volume_ratio > 1.5) {
    featureImpacts.push({ name: 'High Volume', value: features.volume_ratio, impact: features.returns_1d > 0 ? 'positive' : 'negative' });
  }
  
  // Trend strength
  if (features.trend_strength > 0.02) {
    featureImpacts.push({ 
      name: 'Strong Trend', 
      value: features.trend_strength * 100, 
      impact: features.price_to_sma5 > 1 ? 'positive' : 'negative' 
    });
  }
  
  // Bollinger position (use bb_position)
  if (features.bb_position < 0.1) {
    featureImpacts.push({ name: 'Near Lower Band', value: features.bb_position, impact: 'positive' });
  } else if (features.bb_position > 0.9) {
    featureImpacts.push({ name: 'Near Upper Band', value: features.bb_position, impact: 'negative' });
  }
  
  return featureImpacts.slice(0, 5);
}

// ============================================================================
// MAIN PREDICTION FUNCTION
// ============================================================================

/**
 * Generate prediction for a single asset
 * Uses real TensorFlow.js models when available, falls back to simulated
 */
export async function predictAsset(asset: AssetData): Promise<PredictionResult | null> {
  const startTime = performance.now();
  
  // Calculate features
  const features = calculateFeatures(asset);
  if (!features) {
    console.warn(`Cannot calculate features for ${asset.symbol}`);
    return null;
  }
  
  // Normalize features for model input
  const normalizedFeatures = normalizeFeatures(features);
  
  let prediction: number;
  let modelPredictions: PredictionResult['modelPredictions'];
  let confidence: number;
  let isRealModel = false;
  let modelSource: 'tfjs' | 'simulated' = 'simulated';
  
  // Try to use real TensorFlow.js models first
  if (useTfjsModels && modelLoader.isInitialized()) {
    try {
      const tfjsResult = await runTfjsPrediction(normalizedFeatures);
      prediction = tfjsResult.prediction;
      confidence = tfjsResult.confidence;
      modelPredictions = tfjsResult.modelPredictions.map(mp => ({
        modelId: mp.modelId,
        modelType: mp.modelId, // e.g., 'lightgbm', 'xgboost'
        prediction: mp.prediction,
        weight: mp.weight
      }));
      isRealModel = true;
      modelSource = 'tfjs';
      
      console.log(`🤖 [REAL TFJS] ${asset.symbol}: prediction=${prediction.toFixed(4)}, confidence=${confidence.toFixed(2)}, features=${normalizedFeatures.length}`);
    } catch (error) {
      console.error(`TFJS prediction failed for ${asset.symbol}, using fallback:`, error);
      // Fall back to simulated models
      const result = runSimulatedPrediction(normalizedFeatures);
      prediction = result.prediction;
      modelPredictions = result.modelPredictions;
      confidence = calculateConfidence(modelPredictions);
      isRealModel = false;
      modelSource = 'simulated';
    }
  } else {
    // Use simulated models
    const result = runSimulatedPrediction(normalizedFeatures);
    prediction = result.prediction;
    modelPredictions = result.modelPredictions;
    confidence = calculateConfidence(modelPredictions);
    isRealModel = false;
    modelSource = 'simulated';
    console.log(`⚠️ [SIMULATED] ${asset.symbol}: TFJS not available, using fallback`);
  }
  
  // Generate signal
  const signal = generateSignal(prediction);
  
  // Calculate risk metrics
  const riskMetrics = calculateRiskMetrics(
    prediction,
    confidence,
    asset.currentPrice,
    features
  );
  
  // Extract top features for explainability
  const topFeatures = extractTopFeatures(features);
  
  const latencyMs = performance.now() - startTime;
  
  return {
    symbol: asset.symbol,
    assetClass: asset.assetClass,
    prediction,
    signal,
    confidence,
    modelPredictions,
    isRealModel,
    modelSource,
    expectedReturn: riskMetrics.expectedReturn,
    stopLoss: riskMetrics.stopLoss,
    takeProfit: riskMetrics.takeProfit,
    positionSize: riskMetrics.positionSize,
    riskRewardRatio: riskMetrics.riskRewardRatio,
    currentPrice: asset.currentPrice,
    priceChange24h: asset.priceChangePercent24h,
    timestamp: Date.now(),
    latencyMs,
    topFeatures,
  };
}

/**
 * Run prediction using simulated models (fallback)
 */
function runSimulatedPrediction(normalizedFeatures: number[]): {
  prediction: number;
  modelPredictions: PredictionResult['modelPredictions'];
} {
  // Get models and weights
  const models = getTopModels(4);
  const ensembleWeights = getEnsembleWeights();
  
  // Run ensemble prediction
  return runEnsemblePrediction(normalizedFeatures, models, ensembleWeights);
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Run predictions for all assets
 */
export async function runAllPredictions(): Promise<Map<string, PredictionResult>> {
  if (predictionCache.isFetching && predictionPromise) {
    await predictionPromise;
    return predictionCache.predictions;
  }
  
  const now = Date.now();
  if (now - predictionCache.lastUpdate < PREDICTION_CACHE_TTL && predictionCache.predictions.size > 0) {
    console.log('🧠 ML: Using cached predictions');
    return predictionCache.predictions;
  }
  
  if (!hasMLData()) {
    console.warn('🧠 ML: No market data available for predictions');
    return predictionCache.predictions;
  }
  
  predictionCache.isFetching = true;
  console.log('🧠 ML: Running model inference...');
  console.log(`🤖 Using ${useTfjsModels ? 'REAL TensorFlow.js' : 'simulated'} models`);
  
  predictionPromise = (async () => {
    try {
      const assets = getAllMLAssets();
      const newPredictions = new Map<string, PredictionResult>();
      
      // Run predictions in parallel batches for better performance
      const batchSize = 5;
      for (let i = 0; i < assets.length; i += batchSize) {
        const batch = assets.slice(i, i + batchSize);
        const predictions = await Promise.all(
          batch.map(asset => predictAsset(asset))
        );
        
        predictions.forEach((prediction, idx) => {
          if (prediction) {
            newPredictions.set(batch[idx].symbol, prediction);
          }
        });
      }
      
      predictionCache.predictions = newPredictions;
      predictionCache.lastUpdate = Date.now();
      
      console.log(`✅ ML: Generated ${newPredictions.size} predictions`);
    } catch (error) {
      console.error('ML Prediction error:', error);
    } finally {
      predictionCache.isFetching = false;
      predictionPromise = null;
    }
  })();
  
  await predictionPromise;
  return predictionCache.predictions;
}

/**
 * Get cached prediction for a symbol
 */
export function getPrediction(symbol: string): PredictionResult | null {
  return predictionCache.predictions.get(symbol) || null;
}

/**
 * Get all cached predictions
 */
export function getAllPredictions(): PredictionResult[] {
  return Array.from(predictionCache.predictions.values());
}

/**
 * Get predictions by signal
 */
export function getPredictionsBySignal(signal: PredictionResult['signal']): PredictionResult[] {
  return getAllPredictions().filter(p => p.signal === signal);
}

/**
 * Get predictions by asset class
 */
export function getPredictionsByAssetClass(assetClass: PredictionResult['assetClass']): PredictionResult[] {
  return getAllPredictions().filter(p => p.assetClass === assetClass);
}

/**
 * Get top N predictions by expected return
 */
export function getTopPredictions(n: number = 5): PredictionResult[] {
  return getAllPredictions()
    .sort((a, b) => Math.abs(b.expectedReturn) - Math.abs(a.expectedReturn))
    .slice(0, n);
}

/**
 * Get prediction cache age in milliseconds
 */
export function getPredictionCacheAge(): number {
  return Date.now() - predictionCache.lastUpdate;
}

/**
 * Check if predictions are available
 */
export function hasPredictions(): boolean {
  return predictionCache.predictions.size > 0;
}

/**
 * Get aggregated metrics
 */
export function getAggregatedMetrics(): {
  totalPredictions: number;
  avgConfidence: number;
  signalDistribution: Record<string, number>;
  avgLatencyMs: number;
} {
  const predictions = getAllPredictions();
  
  if (predictions.length === 0) {
    return {
      totalPredictions: 0,
      avgConfidence: 0,
      signalDistribution: {},
      avgLatencyMs: 0,
    };
  }
  
  const signalDistribution: Record<string, number> = {
    STRONG_BUY: 0,
    BUY: 0,
    HOLD: 0,
    SELL: 0,
    STRONG_SELL: 0,
  };
  
  let totalConfidence = 0;
  let totalLatency = 0;
  
  for (const pred of predictions) {
    signalDistribution[pred.signal]++;
    totalConfidence += pred.confidence;
    totalLatency += pred.latencyMs;
  }
  
  return {
    totalPredictions: predictions.length,
    avgConfidence: totalConfidence / predictions.length,
    signalDistribution,
    avgLatencyMs: totalLatency / predictions.length,
  };
}
