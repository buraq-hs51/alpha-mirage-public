"""
=============================================================================
ONLINE LEARNING MODELS - Initial Training & Export
=============================================================================
Trains online learning models (SGD, Passive-Aggressive) and exports them 
for browser-based incremental updates.

These models will be pre-trained on historical data, then continue learning
in the browser via Web Workers.

Author: Shadaab Ahmed
=============================================================================
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json
import logging
from datetime import datetime
from typing import Dict, Tuple, Optional
import joblib

from sklearn.linear_model import SGDClassifier, PassiveAggressiveClassifier
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score
)

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

SGD_PARAMS = {
    'loss': 'log_loss',           # Logistic regression
    'penalty': 'l2',
    'alpha': 0.001,               # L2 regularization
    'learning_rate': 'optimal',
    'eta0': 0.01,
    'max_iter': 1,                # Single pass for online
    'warm_start': True,           # Enable incremental learning
    'random_state': 42,
    'n_jobs': -1,
}

PA_PARAMS = {
    'C': 1.0,                     # Aggressiveness
    'max_iter': 1,
    'warm_start': True,
    'random_state': 42,
    'n_jobs': -1,
}


class OnlineModelTrainer:
    """Trains online learning models and exports for browser use."""
    
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize models
        self.sgd_model = SGDClassifier(**SGD_PARAMS)
        self.pa_model = PassiveAggressiveClassifier(**PA_PARAMS)
        
        # Scaler (shared with other models)
        self.scaler: Optional[StandardScaler] = None
        
        # Metrics tracking
        self.metrics: Dict = {}
        
    def load_scaler(self, scaler_path: Path) -> None:
        """Load pre-trained scaler from main training pipeline."""
        if scaler_path.exists():
            with open(scaler_path, 'r') as f:
                scaler_data = json.load(f)
            self.scaler = StandardScaler()
            self.scaler.mean_ = np.array(scaler_data['mean'])
            # Handle both 'scale' and 'std' keys for compatibility
            scale_key = 'scale' if 'scale' in scaler_data else 'std'
            self.scaler.scale_ = np.array(scaler_data[scale_key])
            self.scaler.var_ = self.scaler.scale_ ** 2
            self.scaler.n_features_in_ = len(scaler_data['mean'])
            logger.info(f"✅ Loaded scaler from {scaler_path}")
        else:
            logger.warning(f"⚠️ Scaler not found at {scaler_path}")
    
    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray,
    ) -> Dict:
        """
        Train online learning models on historical data.
        
        Args:
            X_train: Training features (already scaled)
            y_train: Training labels
            X_test: Test features (already scaled)
            y_test: Test labels
            
        Returns:
            Dictionary of metrics for each model
        """
        logger.info("🎯 Training Online Learning Models...")
        
        metrics = {}
        
        # Train SGD
        logger.info("Training SGD Classifier...")
        
        # Multiple epochs for initial training
        for epoch in range(5):
            # Shuffle data each epoch
            indices = np.random.permutation(len(X_train))
            X_shuffled = X_train[indices]
            y_shuffled = y_train[indices]
            
            # Partial fit (online learning)
            self.sgd_model.partial_fit(X_shuffled, y_shuffled, classes=[0, 1])
        
        # Evaluate SGD
        sgd_pred = self.sgd_model.predict(X_test)
        sgd_proba = self.sgd_model.predict_proba(X_test)[:, 1]
        
        metrics['sgd'] = {
            'accuracy': float(accuracy_score(y_test, sgd_pred)),
            'precision': float(precision_score(y_test, sgd_pred, zero_division=0)),
            'recall': float(recall_score(y_test, sgd_pred, zero_division=0)),
            'f1_score': float(f1_score(y_test, sgd_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_test, sgd_proba)),
            'samples_trained': int(len(X_train)),
        }
        
        logger.info(f"  SGD - Accuracy: {metrics['sgd']['accuracy']:.4f}, AUC: {metrics['sgd']['roc_auc']:.4f}")
        
        # Train Passive-Aggressive
        logger.info("Training Passive-Aggressive Classifier...")
        
        for epoch in range(5):
            indices = np.random.permutation(len(X_train))
            X_shuffled = X_train[indices]
            y_shuffled = y_train[indices]
            self.pa_model.partial_fit(X_shuffled, y_shuffled, classes=[0, 1])
        
        # Evaluate PA
        pa_pred = self.pa_model.predict(X_test)
        # PA doesn't have predict_proba, use decision function
        pa_decision = self.pa_model.decision_function(X_test)
        pa_proba = 1 / (1 + np.exp(-pa_decision))  # Sigmoid
        
        metrics['passive_aggressive'] = {
            'accuracy': float(accuracy_score(y_test, pa_pred)),
            'precision': float(precision_score(y_test, pa_pred, zero_division=0)),
            'recall': float(recall_score(y_test, pa_pred, zero_division=0)),
            'f1_score': float(f1_score(y_test, pa_pred, zero_division=0)),
            'roc_auc': float(roc_auc_score(y_test, pa_proba)),
            'samples_trained': int(len(X_train)),
        }
        
        logger.info(f"  PA - Accuracy: {metrics['passive_aggressive']['accuracy']:.4f}, AUC: {metrics['passive_aggressive']['roc_auc']:.4f}")
        
        self.metrics = metrics
        return metrics
    
    def export_for_browser(self) -> Dict:
        """
        Export model weights in JSON format for browser use.
        
        Browser will use these weights to initialize Web Worker models.
        """
        logger.info("📦 Exporting Online Models for Browser...")
        
        online_dir = self.output_dir / 'online'
        online_dir.mkdir(parents=True, exist_ok=True)
        
        exports = {}
        
        # Export SGD weights
        sgd_weights = {
            'modelType': 'sgd',
            'weights': self.sgd_model.coef_[0].tolist(),
            'bias': float(self.sgd_model.intercept_[0]),
            'featureCount': int(self.sgd_model.coef_.shape[1]),
            'samplesProcessed': self.metrics.get('sgd', {}).get('samples_trained', 0),
            'lastUpdated': datetime.now().isoformat(),
            'version': 1,
            'metrics': self.metrics.get('sgd', {}),
        }
        
        sgd_path = online_dir / 'sgd_weights.json'
        with open(sgd_path, 'w') as f:
            json.dump(sgd_weights, f, indent=2)
        exports['sgd'] = str(sgd_path)
        logger.info(f"  ✅ SGD weights exported: {len(sgd_weights['weights'])} features")
        
        # Export PA weights
        pa_weights = {
            'modelType': 'passive-aggressive',
            'weights': self.pa_model.coef_[0].tolist(),
            'bias': float(self.pa_model.intercept_[0]),
            'featureCount': int(self.pa_model.coef_.shape[1]),
            'samplesProcessed': self.metrics.get('passive_aggressive', {}).get('samples_trained', 0),
            'lastUpdated': datetime.now().isoformat(),
            'version': 1,
            'metrics': self.metrics.get('passive_aggressive', {}),
        }
        
        pa_path = online_dir / 'pa_weights.json'
        with open(pa_path, 'w') as f:
            json.dump(pa_weights, f, indent=2)
        exports['passive_aggressive'] = str(pa_path)
        logger.info(f"  ✅ PA weights exported: {len(pa_weights['weights'])} features")
        
        # Combined manifest
        manifest = {
            'version': datetime.now().strftime('%Y%m%d'),
            'timestamp': datetime.now().isoformat(),
            'models': {
                'sgd': {
                    'file': 'online/sgd_weights.json',
                    'metrics': self.metrics.get('sgd', {}),
                },
                'passiveAggressive': {
                    'file': 'online/pa_weights.json',
                    'metrics': self.metrics.get('passive_aggressive', {}),
                },
            },
            'featureCount': int(self.sgd_model.coef_.shape[1]),
        }
        
        manifest_path = online_dir / 'manifest.json'
        with open(manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        exports['manifest'] = str(manifest_path)
        
        logger.info(f"✅ Online models exported to {online_dir}")
        return exports
    
    def save_sklearn_models(self) -> None:
        """Save sklearn models for potential server-side use."""
        joblib.dump(self.sgd_model, self.output_dir / 'online' / 'sgd_model.joblib')
        joblib.dump(self.pa_model, self.output_dir / 'online' / 'pa_model.joblib')
        logger.info("💾 Saved sklearn models for server-side use")


def train_online_models(
    features_df: pd.DataFrame,
    scaler_path: Path,
    output_dir: Path,
    test_ratio: float = 0.2,
) -> Dict:
    """
    Main function to train online learning models.
    
    Args:
        features_df: DataFrame with features and 'target' column
        scaler_path: Path to scaler.json from main training
        output_dir: Output directory for models
        test_ratio: Ratio of data to use for testing
        
    Returns:
        Dictionary with training results and export paths
    """
    logger.info("=" * 60)
    logger.info("ONLINE LEARNING MODELS TRAINING")
    logger.info("=" * 60)
    
    # Load feature names from scaler to ensure consistency
    with open(scaler_path, 'r') as f:
        scaler_data = json.load(f)
    
    feature_cols = scaler_data.get('feature_names')
    if not feature_cols:
        # Fallback: use all feature columns
        feature_cols = [c for c in features_df.columns if c not in ['date', 'symbol', 'asset_class', 'target', 'close']]
        logger.warning(f"No feature_names in scaler, using {len(feature_cols)} columns from data")
    else:
        # Verify all expected features exist in data
        missing = set(feature_cols) - set(features_df.columns)
        if missing:
            raise ValueError(f"Missing features in data: {missing}")
        logger.info(f"Using {len(feature_cols)} features from scaler")
    
    X = features_df[feature_cols].values
    y = features_df['target'].values
    
    # Handle NaN and Inf values before any processing (sklearn doesn't accept them)
    nan_count = np.isnan(X).sum()
    inf_count = np.isinf(X).sum()
    if nan_count > 0 or inf_count > 0:
        logger.info(f"Pre-cleaning: Filling {nan_count} NaN and {inf_count} Inf values with 0")
        X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    
    # Time-series split (no shuffle for time series)
    split_idx = int(len(X) * (1 - test_ratio))
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    
    logger.info(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    
    # Initialize trainer
    trainer = OnlineModelTrainer(output_dir)
    trainer.load_scaler(scaler_path)
    
    # Apply scaling
    if trainer.scaler:
        X_train_scaled = trainer.scaler.transform(X_train)
        X_test_scaled = trainer.scaler.transform(X_test)
    else:
        X_train_scaled = X_train
        X_test_scaled = X_test
    
    # Extra safety check after scaling (in case of extreme values)
    nan_train_count = np.isnan(X_train_scaled).sum()
    nan_test_count = np.isnan(X_test_scaled).sum()
    inf_train_count = np.isinf(X_train_scaled).sum()
    inf_test_count = np.isinf(X_test_scaled).sum()
    
    if nan_train_count > 0 or nan_test_count > 0 or inf_train_count > 0 or inf_test_count > 0:
        logger.info(f"Post-scaling: Filling {nan_train_count + inf_train_count} train and {nan_test_count + inf_test_count} test NaN/Inf with 0")
        X_train_scaled = np.nan_to_num(X_train_scaled, nan=0.0, posinf=0.0, neginf=0.0)
        X_test_scaled = np.nan_to_num(X_test_scaled, nan=0.0, posinf=0.0, neginf=0.0)
    
    # Train models
    metrics = trainer.train(X_train_scaled, y_train, X_test_scaled, y_test)
    
    # Export for browser
    exports = trainer.export_for_browser()
    
    # Save sklearn models
    trainer.save_sklearn_models()
    
    return {
        'metrics': metrics,
        'exports': exports,
        'train_samples': len(X_train),
        'test_samples': len(X_test),
    }


if __name__ == '__main__':
    # For standalone testing
    logging.basicConfig(level=logging.INFO)
    print("Online Model Trainer - Import this module to use")
