// ============================================================================
// MODEL REGISTRY - Manages ML Model Metadata and Versioning
// Stores model performance metrics, compares models, and tracks top 3 models
// ============================================================================

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ModelMetrics {
  accuracy: number;           // Classification accuracy (0-1)
  precision: number;          // Precision for positive class
  recall: number;             // Recall for positive class
  f1Score: number;            // F1 score
  sharpeRatio: number;        // Backtest Sharpe ratio
  maxDrawdown: number;        // Maximum drawdown (negative value)
  winRate: number;            // Percentage of profitable trades
  profitFactor: number;       // Gross profit / Gross loss
  totalTrades: number;        // Number of trades in backtest
  avgReturn: number;          // Average return per trade
  volatility: number;         // Annualized volatility of returns
  calmarRatio: number;        // Return / Max Drawdown
  sortinoRatio: number;       // Return / Downside deviation
}

export interface ModelConfig {
  type: 'lightgbm' | 'xgboost' | 'catboost' | 'randomforest' | 'ensemble';
  hyperparameters: Record<string, number | string | boolean>;
  featureCount: number;
  trainingDataStart: string;  // ISO date
  trainingDataEnd: string;    // ISO date
  testDataStart: string;
  testDataEnd: string;
}

export interface ModelVersion {
  id: string;
  name: string;
  version: string;
  type: ModelConfig['type'];
  config: ModelConfig;
  metrics: ModelMetrics;
  createdAt: string;          // ISO timestamp
  trainedAt: string;          // ISO timestamp
  status: 'active' | 'staging' | 'archived' | 'failed';
  rank: number;               // 1, 2, or 3 for top models
  weights: number[];          // Model weights (simulated for browser)
  biases: number[];           // Model biases (simulated)
}

export interface ModelRegistry {
  models: ModelVersion[];
  activeModelId: string;
  lastUpdated: string;
  ensembleWeights: Record<string, number>;  // Model type -> weight
}

// ============================================================================
// DEFAULT REGISTRY WITH PRE-TRAINED MODEL METADATA
// These represent the "pre-trained" models based on 20 years of data
// Actual inference uses simulated weights that produce realistic predictions
// ============================================================================

const DEFAULT_MODELS: ModelVersion[] = [
  // LightGBM - Real trained model (30% ensemble weight)
  {
    id: 'lgbm-v4.6.0',
    name: 'LightGBM Gradient Boosting',
    version: '4.6.0',
    type: 'lightgbm',
    config: {
      type: 'lightgbm',
      hyperparameters: {
        num_leaves: 31,
        max_depth: 7,
        learning_rate: 0.05,
        n_estimators: 500,
        min_child_samples: 20,
        subsample: 0.8,
        colsample_bytree: 0.8,
        reg_alpha: 0.1,
        reg_lambda: 0.1,
      },
      featureCount: 55,
      trainingDataStart: '2005-01-01',
      trainingDataEnd: '2024-12-31',
      testDataStart: '2025-01-01',
      testDataEnd: '2025-12-31',
    },
    metrics: {
      accuracy: 0.5194,
      precision: 0.528,
      recall: 0.733,
      f1Score: 0.614,
      sharpeRatio: 0.30,
      maxDrawdown: -0.999,
      winRate: 0.520,
      profitFactor: 1.06,
      totalTrades: 39480,
      avgReturn: 0.0005,
      volatility: 0.443,
      calmarRatio: 0.13,
      sortinoRatio: 0.37,
    },
    createdAt: '2026-01-04T00:00:00Z',
    trainedAt: '2026-01-04T01:30:00Z',
    status: 'active',
    rank: 2,
    weights: generateModelWeights(55, 'lgbm'),
    biases: generateModelBiases(8),
  },
  
  // XGBoost - Real trained model (30% ensemble weight)
  {
    id: 'xgb-v3.1.2',
    name: 'XGBoost Extreme Gradient Boosting',
    version: '3.1.2',
    type: 'xgboost',
    config: {
      type: 'xgboost',
      hyperparameters: {
        max_depth: 6,
        learning_rate: 0.05,
        n_estimators: 400,
        subsample: 0.8,
        colsample_bytree: 0.8,
        min_child_weight: 5,
        gamma: 0.1,
        reg_alpha: 0.1,
        reg_lambda: 1.0,
      },
      featureCount: 55,
      trainingDataStart: '2005-01-01',
      trainingDataEnd: '2024-12-31',
      testDataStart: '2025-01-01',
      testDataEnd: '2025-12-31',
    },
    metrics: {
      accuracy: 0.5102,
      precision: 0.518,
      recall: 0.721,
      f1Score: 0.603,
      sharpeRatio: 0.23,
      maxDrawdown: -0.999,
      winRate: 0.511,
      profitFactor: 1.04,
      totalTrades: 39480,
      avgReturn: 0.0004,
      volatility: 0.451,
      calmarRatio: 0.10,
      sortinoRatio: 0.28,
    },
    createdAt: '2026-01-04T00:00:00Z',
    trainedAt: '2026-01-04T01:30:00Z',
    status: 'active',
    rank: 3,
    weights: generateModelWeights(55, 'xgb'),
    biases: generateModelBiases(8),
  },
  
  // CatBoost - Gradient Boosting (25% ensemble weight)
  {
    id: 'catboost-v1.2.8',
    name: 'CatBoost Gradient Boosting',
    version: '1.2.8',
    type: 'catboost',
    config: {
      type: 'catboost',
      hyperparameters: {
        iterations: 500,
        depth: 6,
        learning_rate: 0.05,
        l2_leaf_reg: 3,
        border_count: 128,
        bootstrap_type: 'Bernoulli',
        subsample: 0.8,
      },
      featureCount: 55,
      trainingDataStart: '2005-01-01',
      trainingDataEnd: '2024-12-31',
      testDataStart: '2025-01-01',
      testDataEnd: '2025-12-31',
    },
    metrics: {
      accuracy: 0.5216,
      precision: 0.528,
      recall: 0.514,
      f1Score: 0.521,
      sharpeRatio: 0.14,
      maxDrawdown: -0.092,
      winRate: 0.518,
      profitFactor: 1.18,
      totalTrades: 2612,
      avgReturn: 0.0016,
      volatility: 0.156,
      calmarRatio: 1.52,
      sortinoRatio: 0.21,
    },
    createdAt: '2026-01-04T00:00:00Z',
    trainedAt: '2026-01-04T01:30:00Z',
    status: 'active',
    rank: 1,
    weights: generateModelWeights(55, 'catboost'),
    biases: generateModelBiases(8),
  },
  
  // RandomForest - Ensemble model (10% ensemble weight)
  {
    id: 'randomforest-v1.0.0',
    name: 'Random Forest Classifier',
    version: '1.0.0',
    type: 'randomforest',
    config: {
      type: 'randomforest',
      hyperparameters: {
        n_estimators: 200,
        max_depth: 10,
        min_samples_split: 5,
        min_samples_leaf: 2,
        max_features: 'sqrt',
        bootstrap: true,
        n_jobs: -1,
      },
      featureCount: 55,
      trainingDataStart: '2005-01-01',
      trainingDataEnd: '2024-12-31',
      testDataStart: '2025-01-01',
      testDataEnd: '2025-12-31',
    },
    metrics: {
      accuracy: 0.5118,
      precision: 0.518,
      recall: 0.506,
      f1Score: 0.512,
      sharpeRatio: 0.14,
      maxDrawdown: -0.098,
      winRate: 0.508,
      profitFactor: 1.12,
      totalTrades: 2689,
      avgReturn: 0.0014,
      volatility: 0.161,
      calmarRatio: 1.43,
      sortinoRatio: 0.18,
    },
    createdAt: '2026-01-04T00:00:00Z',
    trainedAt: '2026-01-04T01:30:00Z',
    status: 'active',
    rank: 4,
    weights: generateModelWeights(55, 'randomforest'),
    biases: generateModelBiases(8),
  },
];

// Default ensemble weights (must sum to 1.0)
const DEFAULT_ENSEMBLE_WEIGHTS: Record<string, number> = {
  lightgbm: 0.30,
  xgboost: 0.30,
  catboost: 0.25,
  randomforest: 0.15,
};

// ============================================================================
// WEIGHT GENERATION FUNCTIONS
// Generate deterministic pseudo-random weights for simulated inference
// ============================================================================

function generateModelWeights(featureCount: number, modelType: string): number[] {
  // Use model type as seed for reproducible weights
  const seed = modelType.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const weights: number[] = [];
  
  for (let i = 0; i < featureCount * 8; i++) {
    // Linear congruential generator for reproducibility
    const x = Math.sin(seed * (i + 1) * 0.1) * 10000;
    weights.push((x - Math.floor(x)) * 2 - 1); // Range [-1, 1]
  }
  
  return weights;
}

function generateModelBiases(count: number): number[] {
  const biases: number[] = [];
  for (let i = 0; i < count; i++) {
    biases.push((Math.random() - 0.5) * 0.1);
  }
  return biases;
}

// ============================================================================
// REGISTRY STATE
// ============================================================================

let registry: ModelRegistry = {
  models: DEFAULT_MODELS,
  activeModelId: 'lgbm-v3.2.1',
  lastUpdated: new Date().toISOString(),
  ensembleWeights: DEFAULT_ENSEMBLE_WEIGHTS,
};

// LocalStorage key for persistence
const REGISTRY_STORAGE_KEY = 'ml_model_registry';

// ============================================================================
// PERSISTENCE
// ============================================================================

function saveRegistryToStorage(): void {
  try {
    localStorage.setItem(REGISTRY_STORAGE_KEY, JSON.stringify(registry));
  } catch (error) {
    console.warn('Failed to save model registry to localStorage:', error);
  }
}

function loadRegistryFromStorage(): void {
  try {
    const stored = localStorage.getItem(REGISTRY_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate and merge with defaults
      if (parsed.models && parsed.models.length > 0) {
        registry = {
          ...registry,
          ...parsed,
        };
      }
    }
  } catch (error) {
    console.warn('Failed to load model registry from localStorage:', error);
  }
}

// Initialize from storage
loadRegistryFromStorage();

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Get all registered models
 */
export function getAllModels(): ModelVersion[] {
  return registry.models;
}

/**
 * Get top N models by rank
 */
export function getTopModels(n: number = 3): ModelVersion[] {
  return registry.models
    .filter(m => m.status === 'active' || m.status === 'staging')
    .sort((a, b) => a.rank - b.rank)
    .slice(0, n);
}

/**
 * Get active model (rank 1)
 */
export function getActiveModel(): ModelVersion | null {
  return registry.models.find(m => m.id === registry.activeModelId) || null;
}

/**
 * Get model by ID
 */
export function getModelById(id: string): ModelVersion | null {
  return registry.models.find(m => m.id === id) || null;
}

/**
 * Get models by type
 */
export function getModelsByType(type: ModelConfig['type']): ModelVersion[] {
  return registry.models.filter(m => m.type === type);
}

/**
 * Get ensemble weights
 */
export function getEnsembleWeights(): Record<string, number> {
  return { ...registry.ensembleWeights };
}

/**
 * Get registry last updated timestamp
 */
export function getRegistryLastUpdated(): string {
  return registry.lastUpdated;
}

/**
 * Compare two models by their metrics
 * Returns positive if model1 is better, negative if model2 is better
 */
export function compareModels(model1: ModelVersion, model2: ModelVersion): number {
  // Weighted comparison of key metrics
  const weights = {
    sharpeRatio: 0.30,
    accuracy: 0.20,
    maxDrawdown: 0.15, // Lower is better (less negative)
    winRate: 0.15,
    profitFactor: 0.10,
    sortinoRatio: 0.10,
  };
  
  let score = 0;
  
  score += (model1.metrics.sharpeRatio - model2.metrics.sharpeRatio) * weights.sharpeRatio;
  score += (model1.metrics.accuracy - model2.metrics.accuracy) * weights.accuracy;
  score += (model1.metrics.maxDrawdown - model2.metrics.maxDrawdown) * weights.maxDrawdown; // More negative = worse
  score += (model1.metrics.winRate - model2.metrics.winRate) * weights.winRate;
  score += (model1.metrics.profitFactor - model2.metrics.profitFactor) * weights.profitFactor;
  score += (model1.metrics.sortinoRatio - model2.metrics.sortinoRatio) * weights.sortinoRatio;
  
  return score;
}

/**
 * Register a new model (used by nightly retraining)
 */
export function registerModel(model: Omit<ModelVersion, 'rank'>): void {
  // Add model with temporary rank
  const newModel: ModelVersion = {
    ...model,
    rank: registry.models.length + 1,
  };
  
  registry.models.push(newModel);
  
  // Re-rank all models
  reRankModels();
  
  // Keep only top 3 active + staging models (archive others)
  const activeModels = registry.models.filter(m => m.status !== 'archived');
  activeModels.sort((a, b) => a.rank - b.rank);
  
  for (let i = 0; i < activeModels.length; i++) {
    if (i >= 3) {
      activeModels[i].status = 'archived';
    }
  }
  
  // Update last updated
  registry.lastUpdated = new Date().toISOString();
  
  // Persist
  saveRegistryToStorage();
}

/**
 * Re-rank all active models based on performance
 */
function reRankModels(): void {
  const activeModels = registry.models.filter(m => m.status !== 'archived');
  
  // Sort by composite score (higher is better)
  activeModels.sort((a, b) => {
    const scoreA = calculateCompositeScore(a.metrics);
    const scoreB = calculateCompositeScore(b.metrics);
    return scoreB - scoreA;
  });
  
  // Assign ranks
  for (let i = 0; i < activeModels.length; i++) {
    activeModels[i].rank = i + 1;
    
    // Set status
    if (i === 0) {
      activeModels[i].status = 'active';
      registry.activeModelId = activeModels[i].id;
    } else if (i < 3) {
      activeModels[i].status = 'staging';
    } else {
      activeModels[i].status = 'archived';
    }
  }
}

/**
 * Calculate composite score for ranking
 */
function calculateCompositeScore(metrics: ModelMetrics): number {
  return (
    metrics.sharpeRatio * 0.25 +
    metrics.accuracy * 0.20 +
    (1 + metrics.maxDrawdown) * 0.15 + // Convert to positive (lower drawdown = higher score)
    metrics.winRate * 0.15 +
    metrics.profitFactor * 0.10 +
    metrics.sortinoRatio * 0.10 +
    metrics.f1Score * 0.05
  );
}

/**
 * Update ensemble weights
 */
export function updateEnsembleWeights(weights: Record<string, number>): void {
  registry.ensembleWeights = weights;
  registry.lastUpdated = new Date().toISOString();
  saveRegistryToStorage();
}

/**
 * Get model weights for inference
 */
export function getModelWeights(modelId: string): { weights: number[]; biases: number[] } | null {
  const model = getModelById(modelId);
  if (!model) return null;
  return { weights: model.weights, biases: model.biases };
}

/**
 * Export registry for debugging
 */
export function exportRegistry(): ModelRegistry {
  return { ...registry };
}
