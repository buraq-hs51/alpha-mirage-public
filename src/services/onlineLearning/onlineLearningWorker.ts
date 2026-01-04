// ============================================================================
// ONLINE LEARNING WEB WORKER
// Runs SGD/Passive-Aggressive training in background thread
// Non-blocking, <10ms latency, continuous weight updates
// ============================================================================

// Note: This is a Web Worker - runs in separate thread from main UI
// Communication via postMessage() - completely non-blocking

/**
 * SGD Classifier running in Web Worker
 * Implements online learning with L2 regularization
 */
class OnlineSGDClassifier {
  private weights: number[];
  private bias: number;
  private learningRate: number;
  private regularization: number;
  private samplesProcessed: number;
  private correctPredictions: number;
  private recentPredictions: boolean[];  // Last 100 for recent accuracy
  private latencies: number[];
  private lastTrainedAt: Date;
  private version: number;

  constructor(featureCount: number = 55, learningRate: number = 0.01, regularization: number = 0.001) {
    // Xavier initialization
    const scale = Math.sqrt(2.0 / featureCount);
    this.weights = Array(featureCount).fill(0).map(() => (Math.random() - 0.5) * scale);
    this.bias = 0;
    this.learningRate = learningRate;
    this.regularization = regularization;
    this.samplesProcessed = 0;
    this.correctPredictions = 0;
    this.recentPredictions = [];
    this.latencies = [];
    this.lastTrainedAt = new Date();
    this.version = 1;
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(x: number): number {
    // Clip to prevent overflow
    const clipped = Math.max(-500, Math.min(500, x));
    return 1 / (1 + Math.exp(-clipped));
  }

  /**
   * Compute linear combination
   */
  private linearCombination(features: number[]): number {
    let sum = this.bias;
    for (let i = 0; i < features.length && i < this.weights.length; i++) {
      sum += this.weights[i] * features[i];
    }
    return sum;
  }

  /**
   * Predict probability of positive class
   * Latency: <1ms for 55 features
   */
  predict(features: number[]): { probability: number; direction: 'LONG' | 'SHORT'; confidence: number } {
    const startTime = performance.now();
    
    const logit = this.linearCombination(features);
    const probability = this.sigmoid(logit);
    const direction = probability >= 0.5 ? 'LONG' : 'SHORT';
    const confidence = Math.abs(probability - 0.5) * 2;  // 0 to 1 scale
    
    const latency = performance.now() - startTime;
    this.latencies.push(latency);
    if (this.latencies.length > 100) this.latencies.shift();
    
    return { probability, direction, confidence };
  }

  /**
   * Train on a single sample (online SGD update)
   * Latency: <5ms for 55 features
   */
  train(features: number[], label: number): { loss: number } {
    const startTime = performance.now();
    
    // Forward pass
    const logit = this.linearCombination(features);
    const prediction = this.sigmoid(logit);
    
    // Binary cross-entropy loss
    const epsilon = 1e-15;
    const clippedPred = Math.max(epsilon, Math.min(1 - epsilon, prediction));
    const loss = -(label * Math.log(clippedPred) + (1 - label) * Math.log(1 - clippedPred));
    
    // Gradient: (prediction - label) for logistic regression
    const error = prediction - label;
    
    // Update weights with L2 regularization (SGD step)
    for (let i = 0; i < this.weights.length && i < features.length; i++) {
      const gradient = error * features[i] + this.regularization * this.weights[i];
      this.weights[i] -= this.learningRate * gradient;
    }
    
    // Update bias
    this.bias -= this.learningRate * error;
    
    // Track metrics
    this.samplesProcessed++;
    const predictedLabel = prediction >= 0.5 ? 1 : 0;
    const correct = predictedLabel === label;
    if (correct) this.correctPredictions++;
    
    // Track recent accuracy
    this.recentPredictions.push(correct);
    if (this.recentPredictions.length > 100) this.recentPredictions.shift();
    
    this.lastTrainedAt = new Date();
    this.version++;
    
    const latency = performance.now() - startTime;
    this.latencies.push(latency);
    if (this.latencies.length > 100) this.latencies.shift();
    
    return { loss };
  }

  /**
   * Batch training for multiple samples
   */
  trainBatch(samples: Array<{ features: number[]; label: number }>): { totalLoss: number; avgLoss: number } {
    let totalLoss = 0;
    for (const sample of samples) {
      const { loss } = this.train(sample.features, sample.label);
      totalLoss += loss;
    }
    return { 
      totalLoss, 
      avgLoss: totalLoss / samples.length 
    };
  }

  /**
   * Export weights for persistence
   */
  exportWeights(): {
    modelType: string;
    weights: number[];
    bias: number;
    featureCount: number;
    samplesProcessed: number;
    lastUpdated: string;
    version: number;
  } {
    return {
      modelType: 'sgd',
      weights: [...this.weights],
      bias: this.bias,
      featureCount: this.weights.length,
      samplesProcessed: this.samplesProcessed,
      lastUpdated: this.lastTrainedAt.toISOString(),
      version: this.version,
    };
  }

  /**
   * Import weights from persistence
   */
  importWeights(data: { weights: number[]; bias: number; samplesProcessed?: number; version?: number }): void {
    this.weights = [...data.weights];
    this.bias = data.bias;
    this.samplesProcessed = data.samplesProcessed || 0;
    this.version = data.version || 1;
  }

  /**
   * Get model metrics
   */
  getMetrics(): {
    accuracy: number;
    recentAccuracy: number;
    samplesProcessed: number;
    correctPredictions: number;
    avgLatencyMs: number;
    lastTrainedAt: string;
    updatesPerMinute: number;
  } {
    const recentCorrect = this.recentPredictions.filter(p => p).length;
    const avgLatency = this.latencies.length > 0 
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length 
      : 0;
    
    return {
      accuracy: this.samplesProcessed > 0 ? this.correctPredictions / this.samplesProcessed : 0,
      recentAccuracy: this.recentPredictions.length > 0 ? recentCorrect / this.recentPredictions.length : 0,
      samplesProcessed: this.samplesProcessed,
      correctPredictions: this.correctPredictions,
      avgLatencyMs: avgLatency,
      lastTrainedAt: this.lastTrainedAt.toISOString(),
      updatesPerMinute: this.samplesProcessed,  // Will be calculated by service
    };
  }

  /**
   * Reset model to initial state
   */
  reset(): void {
    const scale = Math.sqrt(2.0 / this.weights.length);
    this.weights = this.weights.map(() => (Math.random() - 0.5) * scale);
    this.bias = 0;
    this.samplesProcessed = 0;
    this.correctPredictions = 0;
    this.recentPredictions = [];
    this.version = 1;
  }
}

/**
 * Passive-Aggressive Classifier
 * More aggressive updates when prediction is wrong
 */
class PassiveAggressiveClassifier {
  private weights: number[];
  private bias: number;
  private C: number;  // Aggressiveness parameter
  private samplesProcessed: number;
  private correctPredictions: number;
  private recentPredictions: boolean[];
  private latencies: number[];
  private lastTrainedAt: Date;
  private version: number;

  constructor(featureCount: number = 55, C: number = 1.0) {
    this.weights = Array(featureCount).fill(0);
    this.bias = 0;
    this.C = C;
    this.samplesProcessed = 0;
    this.correctPredictions = 0;
    this.recentPredictions = [];
    this.latencies = [];
    this.lastTrainedAt = new Date();
    this.version = 1;
  }

  /**
   * Compute score for sample
   */
  private score(features: number[]): number {
    let sum = this.bias;
    for (let i = 0; i < features.length && i < this.weights.length; i++) {
      sum += this.weights[i] * features[i];
    }
    return sum;
  }

  /**
   * Predict class
   */
  predict(features: number[]): { probability: number; direction: 'LONG' | 'SHORT'; confidence: number } {
    const startTime = performance.now();
    
    const s = this.score(features);
    // Convert score to probability using sigmoid
    const probability = 1 / (1 + Math.exp(-s));
    const direction = s >= 0 ? 'LONG' : 'SHORT';
    const confidence = Math.min(Math.abs(s), 5) / 5;  // Normalize to 0-1
    
    const latency = performance.now() - startTime;
    this.latencies.push(latency);
    if (this.latencies.length > 100) this.latencies.shift();
    
    return { probability, direction, confidence };
  }

  /**
   * Train on single sample (PA-I update)
   */
  train(features: number[], label: number): { loss: number } {
    const startTime = performance.now();
    
    // Convert label: 0 -> -1, 1 -> 1
    const y = label === 1 ? 1 : -1;
    
    const s = this.score(features);
    
    // Hinge loss
    const loss = Math.max(0, 1 - y * s);
    
    // PA-I update rule
    if (loss > 0) {
      const normSquared = features.reduce((sum, f) => sum + f * f, 0) + 1;  // +1 for bias
      const tau = Math.min(this.C, loss / normSquared);
      
      // Update weights
      for (let i = 0; i < this.weights.length && i < features.length; i++) {
        this.weights[i] += tau * y * features[i];
      }
      this.bias += tau * y;
    }
    
    // Track metrics
    this.samplesProcessed++;
    const predictedLabel = s >= 0 ? 1 : 0;
    const correct = predictedLabel === label;
    if (correct) this.correctPredictions++;
    
    this.recentPredictions.push(correct);
    if (this.recentPredictions.length > 100) this.recentPredictions.shift();
    
    this.lastTrainedAt = new Date();
    this.version++;
    
    const latency = performance.now() - startTime;
    this.latencies.push(latency);
    if (this.latencies.length > 100) this.latencies.shift();
    
    return { loss };
  }

  trainBatch(samples: Array<{ features: number[]; label: number }>): { totalLoss: number; avgLoss: number } {
    let totalLoss = 0;
    for (const sample of samples) {
      const { loss } = this.train(sample.features, sample.label);
      totalLoss += loss;
    }
    return { totalLoss, avgLoss: totalLoss / samples.length };
  }

  exportWeights() {
    return {
      modelType: 'passive-aggressive',
      weights: [...this.weights],
      bias: this.bias,
      featureCount: this.weights.length,
      samplesProcessed: this.samplesProcessed,
      lastUpdated: this.lastTrainedAt.toISOString(),
      version: this.version,
    };
  }

  importWeights(data: { weights: number[]; bias: number; samplesProcessed?: number; version?: number }): void {
    this.weights = [...data.weights];
    this.bias = data.bias;
    this.samplesProcessed = data.samplesProcessed || 0;
    this.version = data.version || 1;
  }

  getMetrics() {
    const recentCorrect = this.recentPredictions.filter(p => p).length;
    const avgLatency = this.latencies.length > 0 
      ? this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length 
      : 0;
    
    return {
      accuracy: this.samplesProcessed > 0 ? this.correctPredictions / this.samplesProcessed : 0,
      recentAccuracy: this.recentPredictions.length > 0 ? recentCorrect / this.recentPredictions.length : 0,
      samplesProcessed: this.samplesProcessed,
      correctPredictions: this.correctPredictions,
      avgLatencyMs: avgLatency,
      lastTrainedAt: this.lastTrainedAt.toISOString(),
      updatesPerMinute: this.samplesProcessed,
    };
  }

  reset(): void {
    this.weights = Array(this.weights.length).fill(0);
    this.bias = 0;
    this.samplesProcessed = 0;
    this.correctPredictions = 0;
    this.recentPredictions = [];
    this.version = 1;
  }
}

// ============================================================================
// WEB WORKER MESSAGE HANDLERS
// ============================================================================

let sgdModel: OnlineSGDClassifier | null = null;
let paModel: PassiveAggressiveClassifier | null = null;
let currentModelType: 'sgd' | 'passive-aggressive' = 'sgd';

/**
 * Initialize models
 */
function initModels(featureCount: number = 55) {
  sgdModel = new OnlineSGDClassifier(featureCount, 0.01, 0.001);
  paModel = new PassiveAggressiveClassifier(featureCount, 1.0);
}

// Initialize on worker start
initModels(55);

/**
 * Get active model
 */
function getActiveModel(): OnlineSGDClassifier | PassiveAggressiveClassifier {
  return currentModelType === 'sgd' ? sgdModel! : paModel!;
}

/**
 * Handle incoming messages from main thread
 */
self.onmessage = function(event: MessageEvent) {
  const { type, ...data } = event.data;
  
  try {
    switch (type) {
      case 'train': {
        const startTime = performance.now();
        const { features, label } = data;
        
        // Train both models
        const sgdResult = sgdModel!.train(features, label);
        paModel!.train(features, label);
        
        const response = {
          type: 'training_complete',
          samplesProcessed: sgdModel!.getMetrics().samplesProcessed,
          currentLoss: sgdResult.loss,
          latencyMs: performance.now() - startTime,
        };
        self.postMessage(response);
        break;
      }
      
      case 'batch_train': {
        const startTime = performance.now();
        const { samples } = data;
        
        const sgdResult = sgdModel!.trainBatch(samples);
        paModel!.trainBatch(samples);
        
        const response = {
          type: 'training_complete',
          samplesProcessed: sgdModel!.getMetrics().samplesProcessed,
          currentLoss: sgdResult.avgLoss,
          latencyMs: performance.now() - startTime,
        };
        self.postMessage(response);
        break;
      }
      
      case 'predict': {
        const startTime = performance.now();
        const { features } = data;
        
        const model = getActiveModel();
        const prediction = model.predict(features);
        
        const response = {
          type: 'prediction',
          ...prediction,
          latencyMs: performance.now() - startTime,
        };
        self.postMessage(response);
        break;
      }
      
      case 'predict_all': {
        const startTime = performance.now();
        const { features } = data;
        
        const sgdPred = sgdModel!.predict(features);
        const paPred = paModel!.predict(features);
        
        const response = {
          type: 'prediction_all',
          sgd: sgdPred,
          passiveAggressive: paPred,
          latencyMs: performance.now() - startTime,
        };
        self.postMessage(response);
        break;
      }
      
      case 'export': {
        const response = {
          type: 'export',
          weights: {
            sgd: sgdModel!.exportWeights(),
            passiveAggressive: paModel!.exportWeights(),
          },
        };
        self.postMessage(response);
        break;
      }
      
      case 'import': {
        const { weights } = data;
        if (weights.sgd) {
          sgdModel!.importWeights(weights.sgd);
        }
        if (weights.passiveAggressive) {
          paModel!.importWeights(weights.passiveAggressive);
        }
        self.postMessage({ type: 'import_complete' });
        break;
      }
      
      case 'get_metrics': {
        const response = {
          type: 'metrics',
          metrics: {
            sgd: sgdModel!.getMetrics(),
            passiveAggressive: paModel!.getMetrics(),
          },
        };
        self.postMessage(response);
        break;
      }
      
      case 'reset': {
        sgdModel!.reset();
        paModel!.reset();
        self.postMessage({ type: 'reset_complete' });
        break;
      }
      
      case 'set_model': {
        currentModelType = data.modelType;
        self.postMessage({ type: 'model_set', modelType: currentModelType });
        break;
      }
      
      default:
        self.postMessage({ type: 'error', message: `Unknown message type: ${type}` });
    }
  } catch (error) {
    self.postMessage({ 
      type: 'error', 
      message: error instanceof Error ? error.message : 'Unknown error' 
    });
  }
};

// Notify main thread that worker is ready
self.postMessage({ type: 'ready' });
