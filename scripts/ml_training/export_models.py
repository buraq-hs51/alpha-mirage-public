"""
=============================================================================
MODEL EXPORT - Convert sklearn models to TensorFlow.js format
=============================================================================
Exports trained models to formats usable in browser:
- LightGBM, XGBoost, CatBoost, Random Forest
1. Convert to TensorFlow Keras model (approximation via Neural Network)
2. Export to TensorFlow.js format
3. Generate model metadata JSON for browser

Author: Shadaab Ahmed
=============================================================================
"""

import numpy as np
import pandas as pd
from pathlib import Path
import json
import logging
from datetime import datetime
from typing import Dict, List, Tuple
import joblib
import shutil

import tensorflow as tf
from tensorflow import keras
from keras import layers, Model
import tensorflowjs as tfjs
import copy

logger = logging.getLogger(__name__)


# =============================================================================
# KERAS 3 TO TENSORFLOW.JS COMPATIBILITY FIX
# =============================================================================

def fix_keras3_model_json(model_dir: Path) -> None:
    """
    Fix Keras 3 exported model.json to be compatible with TensorFlow.js browser.
    
    Issues fixed:
    1. InputLayer: batch_shape → batchInputShape
    2. input_layers/output_layers: flat list → nested list
    3. inbound_nodes: {args, kwargs} → [[layer, idx, tensor, {}]]
    4. dtype: dict → string
    """
    model_file = model_dir / 'model.json'
    if not model_file.exists():
        logger.warning(f"Model file not found: {model_file}")
        return
    
    with open(model_file, 'r') as f:
        model_data = json.load(f)
    
    # Navigate to config
    topology = model_data.get('modelTopology', {})
    model_config = topology.get('model_config', {})
    config = model_config.get('config', {})
    
    if not config:
        return
    
    # Fix input_layers/output_layers - ensure nested list format
    for key in ['input_layers', 'output_layers']:
        if key in config and config[key]:
            if not isinstance(config[key][0], list):
                config[key] = [config[key]]
    
    # Fix all layers
    if 'layers' in config:
        for layer in config['layers']:
            layer_config = layer.get('config', {})
            
            # Fix InputLayer batch_shape → batchInputShape
            if layer.get('class_name') == 'InputLayer':
                for old_key in ['batch_shape', 'batch_input_shape']:
                    if old_key in layer_config and 'batchInputShape' not in layer_config:
                        layer_config['batchInputShape'] = layer_config.pop(old_key)
            
            # Fix dtype dict → string
            if 'dtype' in layer_config:
                dtype_val = layer_config['dtype']
                if isinstance(dtype_val, dict):
                    if 'config' in dtype_val and 'name' in dtype_val.get('config', {}):
                        layer_config['dtype'] = dtype_val['config']['name']
                    else:
                        layer_config['dtype'] = 'float32'
            
            # Fix initializers with dict dtype
            for init_key in ['kernel_initializer', 'bias_initializer', 'gamma_initializer',
                            'beta_initializer', 'moving_mean_initializer', 'moving_variance_initializer']:
                if init_key in layer_config and isinstance(layer_config[init_key], dict):
                    init_config = layer_config[init_key].get('config', {})
                    if 'dtype' in init_config and isinstance(init_config['dtype'], dict):
                        init_config['dtype'] = init_config['dtype'].get('config', {}).get('name', 'float32')
            
            # Fix inbound_nodes format
            if 'inbound_nodes' in layer:
                fixed_nodes = []
                for node in layer['inbound_nodes']:
                    if isinstance(node, dict) and 'args' in node:
                        # Keras 3 format - convert it
                        connections = []
                        for arg in node.get('args', []):
                            if isinstance(arg, dict) and arg.get('class_name') == '__keras_tensor__':
                                keras_history = arg.get('config', {}).get('keras_history', [])
                                if keras_history:
                                    connections.append(keras_history + [node.get('kwargs', {})])
                        if connections:
                            fixed_nodes.append(connections)
                    elif isinstance(node, list):
                        if node and isinstance(node[0], list):
                            fixed_nodes.append(node)
                        else:
                            fixed_nodes.append([node])
                layer['inbound_nodes'] = fixed_nodes
    
    # Save fixed model
    with open(model_file, 'w') as f:
        json.dump(model_data, f, separators=(',', ':'))
    
    logger.info(f"  ✓ Fixed Keras 3 compatibility for {model_dir.name}")

# =============================================================================
# NEURAL NETWORK DISTILLATION
# =============================================================================

def create_distillation_model(
    input_dim: int,
    hidden_layers: List[int] = [64, 32, 16]
) -> keras.Model:
    """
    Create a neural network that will learn to mimic the gradient boosting models.
    This is called "knowledge distillation" - training a NN to replicate tree ensemble predictions.
    
    Args:
        input_dim: Number of input features
        hidden_layers: Hidden layer sizes
        
    Returns:
        Keras model
    """
    inputs = keras.Input(shape=(input_dim,), name='features')
    
    x = inputs
    for i, units in enumerate(hidden_layers):
        x = layers.Dense(units, activation='relu', name=f'hidden_{i}')(x)
        x = layers.BatchNormalization(name=f'bn_{i}')(x)
        x = layers.Dropout(0.2, name=f'dropout_{i}')(x)
    
    # Output layer - probability of price going up
    outputs = layers.Dense(1, activation='sigmoid', name='prediction')(x)
    
    model = keras.Model(inputs=inputs, outputs=outputs, name='alpha_engine')
    
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='binary_crossentropy',
        metrics=['accuracy', keras.metrics.AUC(name='auc')]
    )
    
    return model


def distill_model(
    teacher_model,
    X_train: np.ndarray,
    X_val: np.ndarray,
    feature_names: List[str],
    model_name: str,
    output_dir: Path,
    epochs: int = 50,
    batch_size: int = 256
) -> Tuple[keras.Model, Dict]:
    """
    Distill a gradient boosting model into a neural network.
    
    The NN learns to predict the same probabilities as the tree ensemble,
    making it possible to run in browser with TensorFlow.js.
    
    Args:
        teacher_model: Trained LightGBM or XGBoost model
        X_train: Training features
        X_val: Validation features
        feature_names: List of feature names
        model_name: Name for the model
        output_dir: Output directory
        epochs: Training epochs
        batch_size: Batch size
        
    Returns:
        Tuple of (trained Keras model, metadata dict)
    """
    logger.info(f"🧠 Distilling {model_name} into neural network...")
    
    # Get teacher predictions (soft labels)
    y_train_soft = teacher_model.predict_proba(X_train)[:, 1]
    y_val_soft = teacher_model.predict_proba(X_val)[:, 1]
    
    # Create student model
    student = create_distillation_model(X_train.shape[1])
    
    # Train student to mimic teacher
    history = student.fit(
        X_train, y_train_soft,
        validation_data=(X_val, y_val_soft),
        epochs=epochs,
        batch_size=batch_size,
        callbacks=[
            keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True),
            keras.callbacks.ReduceLROnPlateau(factor=0.5, patience=5)
        ],
        verbose=0
    )
    
    # Evaluate distillation quality
    teacher_pred = teacher_model.predict_proba(X_val)[:, 1]
    student_pred = student.predict(X_val).flatten()
    
    # Correlation between teacher and student predictions
    correlation = np.corrcoef(teacher_pred, student_pred)[0, 1]
    
    # Mean absolute difference
    mae = np.mean(np.abs(teacher_pred - student_pred))
    
    logger.info(f"  ✓ Distillation complete: Correlation={correlation:.4f}, MAE={mae:.4f}")
    
    # Export to TensorFlow.js
    model_output_dir = output_dir / model_name
    if model_output_dir.exists():
        shutil.rmtree(model_output_dir)
    
    tfjs.converters.save_keras_model(student, str(model_output_dir))
    
    # Fix Keras 3 compatibility issues for TensorFlow.js browser
    fix_keras3_model_json(model_output_dir)
    
    logger.info(f"  ✓ Exported to TensorFlow.js: {model_output_dir}")
    
    metadata = {
        'model_name': model_name,
        'input_dim': X_train.shape[1],
        'feature_names': feature_names,
        'distillation_correlation': float(correlation),
        'distillation_mae': float(mae),
        'training_epochs': len(history.history['loss']),
        'final_loss': float(history.history['loss'][-1]),
        'final_val_loss': float(history.history['val_loss'][-1]),
        'architecture': {
            'hidden_layers': [64, 32, 16],
            'activation': 'relu',
            'output_activation': 'sigmoid',
            'dropout': 0.2
        },
        'exported_at': datetime.now().isoformat()
    }
    
    return student, metadata


# =============================================================================
# EXPORT PIPELINE
# =============================================================================

def export_all_models(
    models_dir: Path = None,
    output_dir: Path = None
) -> Dict:
    """
    Export all trained models to TensorFlow.js format.
    
    Args:
        models_dir: Directory containing trained models
        output_dir: Directory for TensorFlow.js exports
        
    Returns:
        Export metadata
    """
    if models_dir is None:
        models_dir = Path(__file__).parent / 'models'
    
    if output_dir is None:
        output_dir = Path(__file__).parent.parent.parent / 'public' / 'models'
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Load training results
    results_file = models_dir / 'training_results.json'
    with open(results_file, 'r') as f:
        training_results = json.load(f)
    
    feature_names = training_results['feature_names']
    
    # Load data for distillation - use cache/data/raw_ohlcv.parquet
    data_dir = Path(__file__).parent / 'cache' / 'data'
    df = pd.read_parquet(data_dir / 'raw_ohlcv.parquet')
    
    # Apply feature engineering to get proper feature columns
    from feature_engineering import engineer_features
    
    # Process each symbol and combine
    all_features = []
    for symbol in df['symbol'].unique():
        symbol_df = df[df['symbol'] == symbol].copy()
        features_df = engineer_features(symbol_df)
        if features_df is not None and len(features_df) > 0:
            features_df['symbol'] = symbol
            all_features.append(features_df)
    
    df = pd.concat(all_features, ignore_index=True)
    
    # Prepare data (same split as training)
    exclude_cols = ['date', 'symbol', 'asset_class', 'close', 'target', 'target_return',
                    'sma_5', 'sma_10', 'sma_20', 'sma_50', 'ema_5', 'ema_10', 'ema_20', 'ema_50',
                    'volume_sma_5', 'volume_sma_10', 'obv']
    feature_cols = [c for c in df.columns if c not in exclude_cols]
    
    df = df.sort_values('date').reset_index(drop=True)
    X = df[feature_cols].values
    
    # Handle NaN and Inf
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    X = np.clip(X, -1e10, 1e10)
    
    # Load scaler and transform
    scaler = joblib.load(models_dir / 'scaler.joblib')
    X_scaled = scaler.transform(X)
    
    # Split
    split_idx = int(len(X_scaled) * 0.8)
    X_train, X_val = X_scaled[:split_idx], X_scaled[split_idx:]
    
    export_results = {
        'timestamp': datetime.now().isoformat(),
        'feature_count': len(feature_names),
        'feature_names': feature_names,
        'models': {}
    }
    
    # ==========================================================================
    # Export LightGBM
    # ==========================================================================
    
    lgbm_model = joblib.load(models_dir / 'lightgbm_model.joblib')
    lgbm_student, lgbm_meta = distill_model(
        lgbm_model, X_train, X_val, feature_names,
        'lightgbm', output_dir
    )
    
    export_results['models']['lightgbm'] = {
        **lgbm_meta,
        'original_metrics': training_results['models']['lightgbm']['metrics']
    }
    
    # ==========================================================================
    # Export XGBoost
    # ==========================================================================
    
    xgb_model = joblib.load(models_dir / 'xgboost_model.joblib')
    xgb_student, xgb_meta = distill_model(
        xgb_model, X_train, X_val, feature_names,
        'xgboost', output_dir
    )
    
    export_results['models']['xgboost'] = {
        **xgb_meta,
        'original_metrics': training_results['models']['xgboost']['metrics']
    }
    
    # ==========================================================================
    # Export CatBoost
    # ==========================================================================
    
    catboost_model = joblib.load(models_dir / 'catboost_model.joblib')
    catboost_student, catboost_meta = distill_model(
        catboost_model, X_train, X_val, feature_names,
        'catboost', output_dir
    )
    
    export_results['models']['catboost'] = {
        **catboost_meta,
        'original_metrics': training_results['models']['catboost']['metrics']
    }
    
    # ==========================================================================
    # Export Random Forest
    # ==========================================================================
    
    rf_model = joblib.load(models_dir / 'randomforest_model.joblib')
    rf_student, rf_meta = distill_model(
        rf_model, X_train, X_val, feature_names,
        'randomforest', output_dir
    )
    
    export_results['models']['randomforest'] = {
        **rf_meta,
        'original_metrics': training_results['models']['randomforest']['metrics']
    }
    
    # ==========================================================================
    # Export Scaler Parameters (for browser-side normalization)
    # ==========================================================================
    
    scaler_params = {
        'mean': scaler.mean_.tolist(),
        'scale': scaler.scale_.tolist(),
        'feature_names': feature_names
    }
    
    scaler_file = output_dir / 'scaler.json'
    with open(scaler_file, 'w') as f:
        json.dump(scaler_params, f)
    
    logger.info(f"✓ Exported scaler parameters to {scaler_file}")
    
    # ==========================================================================
    # Create Model Registry JSON (for browser)
    # ==========================================================================
    
    registry = {
        'version': datetime.now().strftime('%Y%m%d-%H%M'),
        'last_updated': datetime.now().isoformat(),
        'models': {
            'lightgbm': {
                'path': '/models/lightgbm/model.json',
                'type': 'lightgbm_distilled',
                'version': export_results['models']['lightgbm']['model_name'],
                'metrics': training_results['models']['lightgbm']['metrics'],
                'distillation': {
                    'correlation': lgbm_meta['distillation_correlation'],
                    'mae': lgbm_meta['distillation_mae']
                }
            },
            'xgboost': {
                'path': '/models/xgboost/model.json',
                'type': 'xgboost_distilled',
                'version': export_results['models']['xgboost']['model_name'],
                'metrics': training_results['models']['xgboost']['metrics'],
                'distillation': {
                    'correlation': xgb_meta['distillation_correlation'],
                    'mae': xgb_meta['distillation_mae']
                }
            },
            'catboost': {
                'path': '/models/catboost/model.json',
                'type': 'catboost_distilled',
                'version': export_results['models']['catboost']['model_name'],
                'metrics': training_results['models']['catboost']['metrics'],
                'distillation': {
                    'correlation': catboost_meta['distillation_correlation'],
                    'mae': catboost_meta['distillation_mae']
                }
            },
            'randomforest': {
                'path': '/models/randomforest/model.json',
                'type': 'randomforest_distilled',
                'version': export_results['models']['randomforest']['model_name'],
                'metrics': training_results['models']['randomforest']['metrics'],
                'distillation': {
                    'correlation': rf_meta['distillation_correlation'],
                    'mae': rf_meta['distillation_mae']
                }
            },
            'ensemble': {
                'type': 'weighted_average',
                'weights': training_results['models']['ensemble']['weights'],
                'metrics': training_results['models']['ensemble']['metrics'],
                'model_count': 4
            }
        },
        'scaler': {
            'path': '/models/scaler.json'
        },
        'feature_names': feature_names,
        'feature_count': len(feature_names)
    }
    
    registry_file = output_dir / 'registry.json'
    with open(registry_file, 'w') as f:
        json.dump(registry, f, indent=2)
    
    logger.info(f"✓ Created model registry at {registry_file}")
    
    # Save export results
    export_file = output_dir / 'export_metadata.json'
    with open(export_file, 'w') as f:
        json.dump(export_results, f, indent=2, default=str)
    
    logger.info(f"\n✅ All models exported to {output_dir}")
    
    return export_results


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    results = export_all_models()
    
    print("\n" + "="*60)
    print("📦 EXPORT COMPLETE")
    print("="*60)
    
    for model_name, model_data in results['models'].items():
        print(f"\n{model_name.upper()}:")
        print(f"  Distillation Correlation: {model_data['distillation_correlation']:.4f}")
        print(f"  Distillation MAE: {model_data['distillation_mae']:.4f}")
        print(f"  Original Accuracy: {model_data['original_metrics']['accuracy']:.4f}")
        print(f"  Original Sharpe: {model_data['original_metrics']['sharpe_ratio']:.2f}")
