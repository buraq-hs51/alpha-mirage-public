// ============================================================================
// ONLINE LEARNING TYPES
// Type definitions for browser-based online learning system
// ============================================================================

/**
 * Online learning model types supported in browser
 */
export type OnlineModelType = 'sgd' | 'passive-aggressive' | 'perceptron';

/**
 * Training update message sent to Web Worker
 */
export interface TrainingUpdate {
  type: 'train';
  features: number[];
  label: number;
  learningRate?: number;
}

/**
 * Prediction request message sent to Web Worker
 */
export interface PredictionRequest {
  type: 'predict';
  features: number[];
}

/**
 * Batch training message for multiple samples
 */
export interface BatchTrainingUpdate {
  type: 'batch_train';
  samples: Array<{
    features: number[];
    label: number;
  }>;
  learningRate?: number;
}

/**
 * Export weights request
 */
export interface ExportRequest {
  type: 'export';
}

/**
 * Import weights request
 */
export interface ImportRequest {
  type: 'import';
  weights: OnlineModelWeights;
}

/**
 * Reset model request
 */
export interface ResetRequest {
  type: 'reset';
}

/**
 * Get metrics request
 */
export interface MetricsRequest {
  type: 'get_metrics';
}

/**
 * Worker message types
 */
export type WorkerMessage = 
  | TrainingUpdate 
  | PredictionRequest 
  | BatchTrainingUpdate 
  | ExportRequest 
  | ImportRequest 
  | ResetRequest
  | MetricsRequest;

/**
 * Prediction response from Web Worker
 */
export interface PredictionResponse {
  type: 'prediction';
  probability: number;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  latencyMs: number;
}

/**
 * Training response from Web Worker
 */
export interface TrainingResponse {
  type: 'training_complete';
  samplesProcessed: number;
  currentLoss: number;
  latencyMs: number;
}

/**
 * Export response with model weights
 */
export interface ExportResponse {
  type: 'export';
  weights: OnlineModelWeights;
}

/**
 * Metrics response
 */
export interface MetricsResponse {
  type: 'metrics';
  metrics: OnlineModelMetrics;
}

/**
 * Error response
 */
export interface ErrorResponse {
  type: 'error';
  message: string;
}

/**
 * Worker response types
 */
export type WorkerResponse = 
  | PredictionResponse 
  | TrainingResponse 
  | ExportResponse 
  | MetricsResponse
  | ErrorResponse;

/**
 * Online model weights (serializable for IndexedDB)
 */
export interface OnlineModelWeights {
  modelType: OnlineModelType;
  weights: number[];
  bias: number;
  featureCount: number;
  samplesProcessed: number;
  lastUpdated: string;
  version: number;
}

/**
 * Online model metrics
 */
export interface OnlineModelMetrics {
  accuracy: number;
  recentAccuracy: number;  // Last 100 predictions
  samplesProcessed: number;
  correctPredictions: number;
  avgLatencyMs: number;
  lastTrainedAt: string;
  updatesPerMinute: number;
}

/**
 * Online learning configuration
 */
export interface OnlineLearningConfig {
  modelType: OnlineModelType;
  learningRate: number;
  regularization: number;
  updateFrequency: number;  // ms between updates
  batchSize: number;
  persistWeights: boolean;
  maxSamplesInMemory: number;
}

/**
 * Default configuration
 */
export const DEFAULT_ONLINE_CONFIG: OnlineLearningConfig = {
  modelType: 'sgd',
  learningRate: 0.01,
  regularization: 0.001,
  updateFrequency: 1000,  // 1 second
  batchSize: 1,
  persistWeights: true,
  maxSamplesInMemory: 1000,
};
