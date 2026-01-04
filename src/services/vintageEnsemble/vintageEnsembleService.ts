// ============================================================================
// VINTAGE ENSEMBLE SERVICE
// Manages multiple model versions (vintages) for ensemble predictions
// Loads and compares models from different training dates
// ============================================================================

import * as tf from '@tensorflow/tfjs';

/**
 * Model vintage metadata
 */
export interface ModelVintage {
  version: string;          // e.g., "20260101", "20260108"
  trainedAt: string;        // ISO timestamp
  ageInDays: number;        // Days since training
  modelName: string;        // e.g., "lightgbm", "xgboost"
  metrics: VintageMetrics;
  model: tf.LayersModel | null;
  isLoaded: boolean;
}

/**
 * Metrics for each vintage
 */
export interface VintageMetrics {
  sharpeRatio: number;
  accuracy: number;
  winRate: number;
  maxDrawdown: number;
  recentAccuracy?: number;  // Performance since deployment
}

/**
 * Prediction from a vintage model
 */
export interface VintagePrediction {
  version: string;
  ageInDays: number;
  probability: number;
  direction: 'LONG' | 'SHORT';
  confidence: number;
  weight: number;           // Weight in ensemble (based on recency + performance)
}

/**
 * Vintage ensemble prediction result
 */
export interface VintageEnsemblePrediction {
  predictions: VintagePrediction[];
  combinedProbability: number;
  combinedDirection: 'LONG' | 'SHORT';
  combinedConfidence: number;
  weightingMethod: 'recency' | 'performance' | 'equal';
}

/**
 * Vintage Ensemble Service
 * Manages loading and prediction from multiple model versions
 */
class VintageEnsembleService {
  private vintages: Map<string, ModelVintage> = new Map();
  private baseUrl: string = '';
  private isInitialized: boolean = false;
  private maxVintages: number = 4;  // Keep last 4 versions
  private scaler: { mean: number[]; std: number[] } | null = null;

  /**
   * Initialize the service with model base URL
   */
  async initialize(baseUrl: string = '/models'): Promise<boolean> {
    this.baseUrl = baseUrl;
    
    try {
      // Load vintage manifest
      const manifestResponse = await fetch(`${baseUrl}/vintages/manifest.json`);
      
      if (!manifestResponse.ok) {
        // No vintages available yet - this is OK for first run
        console.log('ℹ️ No vintages manifest found - will use current models only');
        this.isInitialized = true;
        return true;
      }

      const manifest = await manifestResponse.json();
      
      // Load available vintages
      for (const vintage of manifest.vintages.slice(0, this.maxVintages)) {
        await this.loadVintage(vintage);
      }

      // Load scaler if available
      try {
        const scalerResponse = await fetch(`${baseUrl}/scaler.json`);
        if (scalerResponse.ok) {
          this.scaler = await scalerResponse.json();
        }
      } catch (e) {
        console.warn('Could not load scaler for vintages');
      }

      this.isInitialized = true;
      console.log(`✅ Vintage Ensemble initialized with ${this.vintages.size} vintages`);
      return true;
    } catch (error) {
      console.warn('⚠️ Vintage Ensemble initialization failed:', error);
      this.isInitialized = true;  // Still mark as initialized to allow operation without vintages
      return true;
    }
  }

  /**
   * Load a single vintage model
   */
  private async loadVintage(vintageInfo: {
    version: string;
    trainedAt: string;
    modelName: string;
    path: string;
    metrics: VintageMetrics;
  }): Promise<void> {
    try {
      const model = await tf.loadLayersModel(`${this.baseUrl}/${vintageInfo.path}/model.json`);
      
      const ageInDays = Math.floor(
        (Date.now() - new Date(vintageInfo.trainedAt).getTime()) / (1000 * 60 * 60 * 24)
      );

      const vintage: ModelVintage = {
        version: vintageInfo.version,
        trainedAt: vintageInfo.trainedAt,
        ageInDays,
        modelName: vintageInfo.modelName,
        metrics: vintageInfo.metrics,
        model,
        isLoaded: true,
      };

      this.vintages.set(vintageInfo.version, vintage);
      console.log(`📦 Loaded vintage: ${vintageInfo.version} (${ageInDays} days old)`);
    } catch (error) {
      console.warn(`Failed to load vintage ${vintageInfo.version}:`, error);
    }
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Get number of loaded vintages
   */
  getVintageCount(): number {
    return this.vintages.size;
  }

  /**
   * Get all loaded vintages
   */
  getVintages(): ModelVintage[] {
    return Array.from(this.vintages.values());
  }

  /**
   * Normalize features using loaded scaler
   */
  private normalizeFeatures(features: number[]): number[] {
    if (!this.scaler) return features;

    return features.map((val, i) => {
      const mean = this.scaler!.mean[i] || 0;
      const std = this.scaler!.std[i] || 1;
      return (val - mean) / (std + 1e-8);
    });
  }

  /**
   * Run prediction through a single vintage model
   */
  private async predictWithVintage(
    vintage: ModelVintage,
    features: number[]
  ): Promise<VintagePrediction | null> {
    if (!vintage.model || !vintage.isLoaded) return null;

    try {
      const normalizedFeatures = this.normalizeFeatures(features);
      const inputTensor = tf.tensor2d([normalizedFeatures], [1, normalizedFeatures.length]);
      
      const prediction = vintage.model.predict(inputTensor) as tf.Tensor;
      const probability = (await prediction.data())[0];
      
      inputTensor.dispose();
      prediction.dispose();

      const direction = probability >= 0.5 ? 'LONG' : 'SHORT';
      const confidence = Math.abs(probability - 0.5) * 2;

      // Weight based on recency (newer = higher weight) and performance
      const recencyWeight = Math.exp(-vintage.ageInDays / 14);  // Half-life of 14 days
      const performanceWeight = vintage.metrics.sharpeRatio > 0 
        ? Math.min(vintage.metrics.sharpeRatio / 2, 1) 
        : 0.1;
      const weight = recencyWeight * 0.6 + performanceWeight * 0.4;

      return {
        version: vintage.version,
        ageInDays: vintage.ageInDays,
        probability,
        direction,
        confidence,
        weight,
      };
    } catch (error) {
      console.warn(`Prediction failed for vintage ${vintage.version}:`, error);
      return null;
    }
  }

  /**
   * Get ensemble prediction from all vintages
   */
  async predict(
    features: number[],
    weightingMethod: 'recency' | 'performance' | 'equal' = 'recency'
  ): Promise<VintageEnsemblePrediction> {
    const predictions: VintagePrediction[] = [];

    // Get predictions from all vintages
    for (const vintage of this.vintages.values()) {
      const pred = await this.predictWithVintage(vintage, features);
      if (pred) {
        predictions.push(pred);
      }
    }

    // If no vintages, return neutral prediction
    if (predictions.length === 0) {
      return {
        predictions: [],
        combinedProbability: 0.5,
        combinedDirection: 'LONG',
        combinedConfidence: 0,
        weightingMethod,
      };
    }

    // Adjust weights based on method
    let totalWeight = 0;
    for (const pred of predictions) {
      if (weightingMethod === 'equal') {
        pred.weight = 1 / predictions.length;
      } else if (weightingMethod === 'performance') {
        // Weight by Sharpe ratio
        const vintage = this.vintages.get(pred.version);
        pred.weight = vintage ? Math.max(vintage.metrics.sharpeRatio, 0.1) : 0.1;
      }
      // 'recency' weight is already calculated
      totalWeight += pred.weight;
    }

    // Normalize weights
    for (const pred of predictions) {
      pred.weight /= totalWeight;
    }

    // Combine predictions
    let combinedProbability = 0;
    for (const pred of predictions) {
      combinedProbability += pred.probability * pred.weight;
    }

    const combinedDirection = combinedProbability >= 0.5 ? 'LONG' : 'SHORT';
    const combinedConfidence = Math.abs(combinedProbability - 0.5) * 2;

    return {
      predictions,
      combinedProbability,
      combinedDirection,
      combinedConfidence,
      weightingMethod,
    };
  }

  /**
   * Add a new vintage to the collection (called after training)
   */
  async addVintage(vintageInfo: {
    version: string;
    trainedAt: string;
    modelName: string;
    path: string;
    metrics: VintageMetrics;
  }): Promise<void> {
    await this.loadVintage(vintageInfo);

    // Remove oldest vintage if we exceed max
    if (this.vintages.size > this.maxVintages) {
      const vintagesList = Array.from(this.vintages.values())
        .sort((a, b) => a.ageInDays - b.ageInDays);
      
      const oldest = vintagesList[vintagesList.length - 1];
      if (oldest.model) {
        oldest.model.dispose();
      }
      this.vintages.delete(oldest.version);
      console.log(`🗑️ Removed oldest vintage: ${oldest.version}`);
    }
  }

  /**
   * Get vintage performance comparison
   */
  getPerformanceComparison(): Array<{
    version: string;
    ageInDays: number;
    sharpeRatio: number;
    accuracy: number;
    winRate: number;
  }> {
    return Array.from(this.vintages.values()).map(v => ({
      version: v.version,
      ageInDays: v.ageInDays,
      sharpeRatio: v.metrics.sharpeRatio,
      accuracy: v.metrics.accuracy,
      winRate: v.metrics.winRate,
    }));
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    for (const vintage of this.vintages.values()) {
      if (vintage.model) {
        vintage.model.dispose();
      }
    }
    this.vintages.clear();
    this.isInitialized = false;
  }
}

// Singleton instance
export const vintageEnsembleService = new VintageEnsembleService();

// Export class for custom instances
export { VintageEnsembleService };
