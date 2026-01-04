// ============================================================================
// ONLINE LEARNING SERVICE
// Manages Web Worker for non-blocking online ML training
// Provides async API for training and prediction
// ============================================================================

import type { 
  OnlineModelWeights, 
  OnlineModelMetrics, 
  OnlineLearningConfig,
  DEFAULT_ONLINE_CONFIG 
} from './types';

/**
 * Online Learning Service
 * Manages Web Worker for background training
 * Provides non-blocking API for UI
 */
class OnlineLearningService {
  private worker: Worker | null = null;
  private isReady: boolean = false;
  private pendingRequests: Map<string, { resolve: (value: any) => void; reject: (error: any) => void }> = new Map();
  private requestId: number = 0;
  private config: OnlineLearningConfig;
  private metricsHistory: Array<{ timestamp: Date; metrics: any }> = [];
  private lastPredictions: Map<string, { prediction: any; timestamp: Date }> = new Map();

  constructor(config?: Partial<OnlineLearningConfig>) {
    this.config = { 
      modelType: 'sgd',
      learningRate: 0.01,
      regularization: 0.001,
      updateFrequency: 1000,
      batchSize: 1,
      persistWeights: true,
      maxSamplesInMemory: 1000,
      ...config 
    };
  }

  /**
   * Initialize the Web Worker
   * Call this on app startup
   */
  async initialize(): Promise<boolean> {
    if (this.worker) {
      return this.isReady;
    }

    return new Promise((resolve) => {
      try {
        // Create Web Worker from the worker file
        // Using URL constructor for Vite compatibility
        this.worker = new Worker(
          new URL('./onlineLearningWorker.ts', import.meta.url),
          { type: 'module' }
        );

        this.worker.onmessage = (event) => {
          const { type, ...data } = event.data;

          if (type === 'ready') {
            this.isReady = true;
            console.log('✅ Online Learning Worker ready');
            this.loadPersistedWeights();
            resolve(true);
            return;
          }

          // Handle responses to pending requests
          if (type === 'prediction' || type === 'prediction_all') {
            const pendingKey = 'predict';
            const pending = this.pendingRequests.get(pendingKey);
            if (pending) {
              pending.resolve(data);
              this.pendingRequests.delete(pendingKey);
            }
          } else if (type === 'training_complete') {
            const pendingKey = 'train';
            const pending = this.pendingRequests.get(pendingKey);
            if (pending) {
              pending.resolve(data);
              this.pendingRequests.delete(pendingKey);
            }
          } else if (type === 'metrics') {
            const pendingKey = 'metrics';
            const pending = this.pendingRequests.get(pendingKey);
            if (pending) {
              pending.resolve(data.metrics);
              this.pendingRequests.delete(pendingKey);
            }
            // Store metrics history
            this.metricsHistory.push({
              timestamp: new Date(),
              metrics: data.metrics,
            });
            if (this.metricsHistory.length > 100) {
              this.metricsHistory.shift();
            }
          } else if (type === 'export') {
            const pendingKey = 'export';
            const pending = this.pendingRequests.get(pendingKey);
            if (pending) {
              pending.resolve(data.weights);
              this.pendingRequests.delete(pendingKey);
            }
          } else if (type === 'error') {
            console.error('Online Learning Worker Error:', data.message);
          }
        };

        this.worker.onerror = (error) => {
          console.error('Online Learning Worker Error:', error);
          this.isReady = false;
          resolve(false);
        };
      } catch (error) {
        console.error('Failed to create Online Learning Worker:', error);
        resolve(false);
      }
    });
  }

  /**
   * Check if service is ready
   */
  isInitialized(): boolean {
    return this.isReady && this.worker !== null;
  }

  /**
   * Train on a single sample (non-blocking)
   */
  async train(features: number[], label: number): Promise<{ loss: number; latencyMs: number }> {
    if (!this.isReady || !this.worker) {
      throw new Error('Online Learning Service not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set('train', { resolve, reject });
      this.worker!.postMessage({
        type: 'train',
        features,
        label,
        learningRate: this.config.learningRate,
      });
    });
  }

  /**
   * Train on batch of samples (non-blocking)
   */
  async trainBatch(samples: Array<{ features: number[]; label: number }>): Promise<{ avgLoss: number; latencyMs: number }> {
    if (!this.isReady || !this.worker) {
      throw new Error('Online Learning Service not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set('train', { resolve, reject });
      this.worker!.postMessage({
        type: 'batch_train',
        samples,
        learningRate: this.config.learningRate,
      });
    });
  }

  /**
   * Get prediction from active online model (non-blocking)
   * Latency: <10ms total (postMessage + inference + postMessage)
   */
  async predict(features: number[]): Promise<{
    probability: number;
    direction: 'LONG' | 'SHORT';
    confidence: number;
    latencyMs: number;
  }> {
    if (!this.isReady || !this.worker) {
      throw new Error('Online Learning Service not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set('predict', { resolve, reject });
      this.worker!.postMessage({
        type: 'predict',
        features,
      });
    });
  }

  /**
   * Get predictions from ALL online models (SGD + Passive-Aggressive)
   */
  async predictAll(features: number[]): Promise<{
    sgd: { probability: number; direction: 'LONG' | 'SHORT'; confidence: number };
    passiveAggressive: { probability: number; direction: 'LONG' | 'SHORT'; confidence: number };
    latencyMs: number;
  }> {
    if (!this.isReady || !this.worker) {
      throw new Error('Online Learning Service not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set('predict', { resolve, reject });
      this.worker!.postMessage({
        type: 'predict_all',
        features,
      });
    });
  }

  /**
   * Get current metrics from online models
   */
  async getMetrics(): Promise<{
    sgd: OnlineModelMetrics;
    passiveAggressive: OnlineModelMetrics;
  }> {
    if (!this.isReady || !this.worker) {
      throw new Error('Online Learning Service not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set('metrics', { resolve, reject });
      this.worker!.postMessage({ type: 'get_metrics' });
    });
  }

  /**
   * Export model weights for persistence
   */
  async exportWeights(): Promise<{
    sgd: OnlineModelWeights;
    passiveAggressive: OnlineModelWeights;
  }> {
    if (!this.isReady || !this.worker) {
      throw new Error('Online Learning Service not initialized');
    }

    return new Promise((resolve, reject) => {
      this.pendingRequests.set('export', { resolve, reject });
      this.worker!.postMessage({ type: 'export' });
    });
  }

  /**
   * Import model weights
   */
  async importWeights(weights: { sgd?: OnlineModelWeights; passiveAggressive?: OnlineModelWeights }): Promise<void> {
    if (!this.isReady || !this.worker) {
      throw new Error('Online Learning Service not initialized');
    }

    this.worker.postMessage({ type: 'import', weights });
  }

  /**
   * Reset models to initial state
   */
  async reset(): Promise<void> {
    if (!this.isReady || !this.worker) {
      throw new Error('Online Learning Service not initialized');
    }

    this.worker.postMessage({ type: 'reset' });
    // Clear persisted weights
    if (this.config.persistWeights) {
      try {
        localStorage.removeItem('online_learning_weights');
      } catch (e) {
        console.warn('Could not clear persisted weights:', e);
      }
    }
  }

  /**
   * Save weights to localStorage (called periodically)
   */
  async persistWeights(): Promise<void> {
    if (!this.config.persistWeights) return;

    try {
      const weights = await this.exportWeights();
      localStorage.setItem('online_learning_weights', JSON.stringify(weights));
    } catch (e) {
      console.warn('Could not persist online learning weights:', e);
    }
  }

  /**
   * Load pre-trained weights from server, then fallback to localStorage
   */
  private async loadPersistedWeights(): Promise<void> {
    // First, try to load from server (pre-trained models)
    const serverLoaded = await this.loadServerWeights();
    if (serverLoaded) {
      console.log('✅ Loaded pre-trained online learning weights from server');
      return;
    }

    // Fallback to localStorage
    if (!this.config.persistWeights) return;

    try {
      const stored = localStorage.getItem('online_learning_weights');
      if (stored) {
        const weights = JSON.parse(stored);
        await this.importWeights(weights);
        console.log('✅ Loaded persisted online learning weights from localStorage');
      }
    } catch (e) {
      console.warn('Could not load persisted weights:', e);
    }
  }

  /**
   * Load weights from server (pre-trained models)
   */
  private async loadServerWeights(): Promise<boolean> {
    try {
      const baseUrl = import.meta.env.BASE_URL || '/alpha-mirage/';
      const modelsUrl = `${baseUrl}models/online`.replace('//', '/');
      
      // Load SGD weights
      let sgdWeights = null;
      try {
        const sgdResponse = await fetch(`${modelsUrl}/sgd_weights.json`);
        if (sgdResponse.ok) {
          sgdWeights = await sgdResponse.json();
        }
      } catch (e) {
        // Try alternate path
        try {
          const sgdResponse = await fetch('/models/online/sgd_weights.json');
          if (sgdResponse.ok) {
            sgdWeights = await sgdResponse.json();
          }
        } catch (e2) {
          console.warn('Could not load SGD weights from server');
        }
      }
      
      // Load PA weights
      let paWeights = null;
      try {
        const paResponse = await fetch(`${modelsUrl}/pa_weights.json`);
        if (paResponse.ok) {
          paWeights = await paResponse.json();
        }
      } catch (e) {
        // Try alternate path
        try {
          const paResponse = await fetch('/models/online/pa_weights.json');
          if (paResponse.ok) {
            paWeights = await paResponse.json();
          }
        } catch (e2) {
          console.warn('Could not load PA weights from server');
        }
      }
      
      if (sgdWeights || paWeights) {
        const weights: { sgd?: OnlineModelWeights; passiveAggressive?: OnlineModelWeights } = {};
        if (sgdWeights) {
          weights.sgd = sgdWeights as OnlineModelWeights;
          console.log(`  📊 SGD: ${(sgdWeights as any).samplesProcessed || 0} samples trained`);
        }
        if (paWeights) {
          weights.passiveAggressive = paWeights as OnlineModelWeights;
          console.log(`  📊 PA: ${(paWeights as any).samplesProcessed || 0} samples trained`);
        }
        await this.importWeights(weights);
        return true;
      }
    } catch (e) {
      console.warn('Could not load online learning weights from server:', e);
    }
    return false;
  }

  /**
   * Get metrics history for visualization
   */
  getMetricsHistory(): Array<{ timestamp: Date; metrics: any }> {
    return [...this.metricsHistory];
  }

  /**
   * Terminate the worker
   */
  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isReady = false;
    }
  }
}

// Singleton instance
export const onlineLearningService = new OnlineLearningService();

// Export class for custom instances
export { OnlineLearningService };
