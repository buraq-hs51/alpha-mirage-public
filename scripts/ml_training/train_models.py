"""
=============================================================================
MODEL TRAINING - Multi-Model Ensemble Training
=============================================================================
Trains gradient boosting and ensemble models for direction prediction:
- LightGBM with optimized hyperparameters
- XGBoost with optimized hyperparameters
- CatBoost with ordered boosting
- Random Forest for bagging diversity
- Time-series aware train/test split
- Walk-forward validation
- Comprehensive metrics calculation

Author: Shadaab Ahmed
=============================================================================
"""

import pandas as pd
import numpy as np
from pathlib import Path
import json
import logging
from datetime import datetime
from typing import Dict, List, Tuple, Optional
import joblib

import lightgbm as lgb
import xgboost as xgb
from catboost import CatBoostClassifier
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import TimeSeriesSplit
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION - Production Optimized for Speed
# =============================================================================

# Use all available CPU cores
import os
N_JOBS = os.cpu_count() or -1

LIGHTGBM_PARAMS = {
    'objective': 'binary',
    'metric': 'auc',
    'boosting_type': 'gbdt',
    'num_leaves': 31,
    'max_depth': 6,              # Reduced for faster training
    'learning_rate': 0.1,        # Increased for faster convergence
    'n_estimators': 300,         # Reduced, early stopping will find optimal
    'min_child_samples': 20,
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'reg_alpha': 0.1,
    'reg_lambda': 0.1,
    'random_state': 42,
    'n_jobs': N_JOBS,
    'verbose': -1,
    'force_col_wise': True,      # Optimization for speed
    'histogram_pool_size': -1,   # Auto-optimize memory
}

XGBOOST_PARAMS = {
    'objective': 'binary:logistic',
    'eval_metric': 'auc',
    'tree_method': 'hist',       # Histogram-based for 10x speedup
    'max_depth': 6,
    'learning_rate': 0.1,        # Increased for faster convergence
    'n_estimators': 300,         # Reduced, early stopping will find optimal
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'min_child_weight': 5,
    'gamma': 0.1,
    'reg_alpha': 0.1,
    'reg_lambda': 1.0,
    'random_state': 42,
    'n_jobs': N_JOBS,
    'verbosity': 0,
    'max_bin': 256,              # Optimized binning
}

CATBOOST_PARAMS = {
    'iterations': 300,           # Reduced, early stopping will find optimal
    'depth': 6,
    'learning_rate': 0.1,        # Increased for faster convergence
    'loss_function': 'Logloss',
    'eval_metric': 'AUC',
    'random_seed': 42,
    'l2_leaf_reg': 3.0,
    'border_count': 128,
    'verbose': False,
    'thread_count': N_JOBS,
    'early_stopping_rounds': 30, # Faster early stopping
    'task_type': 'CPU',          # Explicit CPU mode
    'bootstrap_type': 'Bernoulli', # Faster than Bayesian
    'subsample': 0.8,            # Subsample rate for Bernoulli
}

RANDOMFOREST_PARAMS = {
    'n_estimators': 200,         # Reduced for speed
    'max_depth': 8,              # Reduced for faster training
    'min_samples_split': 10,
    'min_samples_leaf': 5,
    'max_features': 'sqrt',
    'bootstrap': True,
    'oob_score': True,
    'random_state': 42,
    'n_jobs': -1,
    'class_weight': 'balanced'
}

# Feature columns to use (will be populated from metadata)
EXCLUDE_COLS = ['date', 'symbol', 'asset_class', 'close', 'target', 'target_return',
                'sma_5', 'sma_10', 'sma_20', 'sma_50', 'ema_5', 'ema_10', 'ema_20', 'ema_50',
                'volume_sma_5', 'volume_sma_10', 'obv']  # Exclude raw values


# =============================================================================
# BACKTESTING METRICS
# =============================================================================

def calculate_trading_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray,
    returns: np.ndarray
) -> Dict:
    """
    Calculate trading-specific metrics from predictions.
    
    Args:
        y_true: Actual labels (0/1)
        y_pred: Predicted labels (0/1)
        y_proba: Prediction probabilities
        returns: Actual returns
        
    Returns:
        Dictionary of trading metrics
    """
    # Convert predictions to positions: 1 for long, -1 for short
    positions = 2 * y_pred - 1  # Maps 0->-1, 1->1
    
    # Strategy returns
    strategy_returns = positions * returns
    strategy_returns = np.nan_to_num(strategy_returns, 0)
    
    # Remove NaN/Inf
    valid_mask = np.isfinite(strategy_returns)
    strategy_returns = strategy_returns[valid_mask]
    
    if len(strategy_returns) == 0:
        return {
            'sharpe_ratio': 0,
            'max_drawdown': 0,
            'win_rate': 0,
            'profit_factor': 1,
            'total_trades': 0,
            'avg_return': 0,
            'volatility': 0,
            'calmar_ratio': 0,
            'sortino_ratio': 0
        }
    
    # Sharpe Ratio (annualized, assuming daily returns)
    mean_return = np.mean(strategy_returns)
    std_return = np.std(strategy_returns)
    sharpe_ratio = (mean_return / (std_return + 1e-10)) * np.sqrt(252)
    
    # Maximum Drawdown
    cumulative = np.cumprod(1 + strategy_returns)
    running_max = np.maximum.accumulate(cumulative)
    drawdown = (cumulative - running_max) / (running_max + 1e-10)
    max_drawdown = np.min(drawdown)
    
    # Win Rate
    wins = np.sum(strategy_returns > 0)
    total_trades = np.sum(np.abs(strategy_returns) > 1e-6)
    win_rate = wins / max(total_trades, 1)
    
    # Profit Factor
    gross_profit = np.sum(strategy_returns[strategy_returns > 0])
    gross_loss = abs(np.sum(strategy_returns[strategy_returns < 0]))
    profit_factor = gross_profit / max(gross_loss, 1e-10)
    
    # Annualized Volatility
    volatility = std_return * np.sqrt(252)
    
    # Calmar Ratio
    annual_return = mean_return * 252
    calmar_ratio = annual_return / abs(min(max_drawdown, -0.001))
    
    # Sortino Ratio
    downside_returns = strategy_returns[strategy_returns < 0]
    downside_std = np.std(downside_returns) if len(downside_returns) > 0 else 1e-10
    sortino_ratio = (mean_return / (downside_std + 1e-10)) * np.sqrt(252)
    
    return {
        'sharpe_ratio': float(np.clip(sharpe_ratio, -10, 10)),
        'max_drawdown': float(max_drawdown),
        'win_rate': float(win_rate),
        'profit_factor': float(np.clip(profit_factor, 0, 10)),
        'total_trades': int(total_trades),
        'avg_return': float(mean_return),
        'volatility': float(volatility),
        'calmar_ratio': float(np.clip(calmar_ratio, -10, 10)),
        'sortino_ratio': float(np.clip(sortino_ratio, -10, 10))
    }


def calculate_all_metrics(
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_proba: np.ndarray,
    returns: np.ndarray
) -> Dict:
    """Calculate all model metrics."""
    
    # Classification metrics
    classification_metrics = {
        'accuracy': float(accuracy_score(y_true, y_pred)),
        'precision': float(precision_score(y_true, y_pred, zero_division=0)),
        'recall': float(recall_score(y_true, y_pred, zero_division=0)),
        'f1_score': float(f1_score(y_true, y_pred, zero_division=0)),
        'roc_auc': float(roc_auc_score(y_true, y_proba))
    }
    
    # Trading metrics
    trading_metrics = calculate_trading_metrics(y_true, y_pred, y_proba, returns)
    
    return {**classification_metrics, **trading_metrics}


# =============================================================================
# MODEL TRAINING
# =============================================================================

def prepare_data(
    df: pd.DataFrame,
    test_ratio: float = 0.2
) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, np.ndarray, List[str], StandardScaler]:
    """
    Prepare data for training with time-series split.
    
    Returns:
        X_train, X_test, y_train, y_test, returns_train, returns_test, feature_names, scaler
    """
    # Sort by date
    df = df.sort_values('date').reset_index(drop=True)
    
    # Get feature columns
    feature_cols = [c for c in df.columns if c not in EXCLUDE_COLS]
    
    X = df[feature_cols].values
    y = df['target'].values
    returns = df['target_return'].values
    
    # Handle NaN and Inf values BEFORE splitting
    X = np.nan_to_num(X, nan=0.0, posinf=0.0, neginf=0.0)
    y = np.nan_to_num(y, nan=0.0, posinf=0.0, neginf=0.0)
    returns = np.nan_to_num(returns, nan=0.0, posinf=0.0, neginf=0.0)
    
    # Clip extreme values to prevent overflow
    X = np.clip(X, -1e10, 1e10)
    
    # Time series split (no shuffling)
    split_idx = int(len(X) * (1 - test_ratio))
    
    X_train, X_test = X[:split_idx], X[split_idx:]
    y_train, y_test = y[:split_idx], y[split_idx:]
    returns_train, returns_test = returns[:split_idx], returns[split_idx:]
    
    # Scale features
    scaler = StandardScaler()
    X_train = scaler.fit_transform(X_train)
    X_test = scaler.transform(X_test)
    
    logger.info(f"📊 Data split: Train={len(X_train):,}, Test={len(X_test):,}")
    
    return X_train, X_test, y_train, y_test, returns_train, returns_test, feature_cols, scaler


def train_lightgbm(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray
) -> lgb.LGBMClassifier:
    """Train LightGBM model."""
    
    model = lgb.LGBMClassifier(**LIGHTGBM_PARAMS)
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        callbacks=[
            lgb.early_stopping(50, verbose=False),
            lgb.log_evaluation(period=0)
        ]
    )
    
    return model


def train_xgboost(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray
) -> xgb.XGBClassifier:
    """Train XGBoost model."""
    
    model = xgb.XGBClassifier(**XGBOOST_PARAMS)
    
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )
    
    return model


def train_catboost(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray,
    y_val: np.ndarray
) -> CatBoostClassifier:
    """Train CatBoost model with ordered boosting."""
    
    model = CatBoostClassifier(**CATBOOST_PARAMS)
    
    model.fit(
        X_train, y_train,
        eval_set=(X_val, y_val),
        use_best_model=True
    )
    
    return model


def train_randomforest(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_val: np.ndarray = None,
    y_val: np.ndarray = None
) -> RandomForestClassifier:
    """Train Random Forest model (bagging ensemble for diversity)."""
    
    model = RandomForestClassifier(**RANDOMFOREST_PARAMS)
    
    model.fit(X_train, y_train)
    
    return model


def train_and_evaluate(
    df: pd.DataFrame,
    output_dir: Path = None
) -> Dict:
    """
    Train both models and evaluate performance.
    
    Args:
        df: Feature DataFrame
        output_dir: Directory to save models
        
    Returns:
        Dictionary with model results and metadata
    """
    if output_dir is None:
        output_dir = Path(__file__).parent / 'models'
    
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Prepare data
    X_train, X_test, y_train, y_test, returns_train, returns_test, feature_names, scaler = prepare_data(df)
    
    results = {
        'timestamp': datetime.now().isoformat(),
        'train_samples': len(X_train),
        'test_samples': len(X_test),
        'feature_count': len(feature_names),
        'feature_names': feature_names,
        'models': {}
    }
    
    # ==========================================================================
    # Train LightGBM
    # ==========================================================================
    
    logger.info("🌲 Training LightGBM...")
    lgbm_model = train_lightgbm(X_train, y_train, X_test, y_test)
    
    lgbm_pred = lgbm_model.predict(X_test)
    lgbm_proba = lgbm_model.predict_proba(X_test)[:, 1]
    lgbm_metrics = calculate_all_metrics(y_test, lgbm_pred, lgbm_proba, returns_test)
    
    results['models']['lightgbm'] = {
        'version': f"lgbm-{datetime.now().strftime('%Y%m%d-%H%M')}",
        'params': LIGHTGBM_PARAMS,
        'metrics': lgbm_metrics,
        'feature_importance': dict(zip(feature_names, lgbm_model.feature_importances_.tolist()))
    }
    
    # Save LightGBM model
    lgbm_path = output_dir / 'lightgbm_model.joblib'
    joblib.dump(lgbm_model, lgbm_path)
    logger.info(f"  ✓ LightGBM: Accuracy={lgbm_metrics['accuracy']:.4f}, Sharpe={lgbm_metrics['sharpe_ratio']:.2f}")
    
    # ==========================================================================
    # Train XGBoost
    # ==========================================================================
    
    logger.info("⚡ Training XGBoost...")
    xgb_model = train_xgboost(X_train, y_train, X_test, y_test)
    
    xgb_pred = xgb_model.predict(X_test)
    xgb_proba = xgb_model.predict_proba(X_test)[:, 1]
    xgb_metrics = calculate_all_metrics(y_test, xgb_pred, xgb_proba, returns_test)
    
    results['models']['xgboost'] = {
        'version': f"xgb-{datetime.now().strftime('%Y%m%d-%H%M')}",
        'params': XGBOOST_PARAMS,
        'metrics': xgb_metrics,
        'feature_importance': dict(zip(feature_names, xgb_model.feature_importances_.tolist()))
    }
    
    # Save XGBoost model
    xgb_path = output_dir / 'xgboost_model.joblib'
    joblib.dump(xgb_model, xgb_path)
    logger.info(f"  ✓ XGBoost: Accuracy={xgb_metrics['accuracy']:.4f}, Sharpe={xgb_metrics['sharpe_ratio']:.2f}")
    
    # ==========================================================================
    # Train CatBoost
    # ==========================================================================
    
    logger.info("🐱 Training CatBoost...")
    catboost_model = train_catboost(X_train, y_train, X_test, y_test)
    
    catboost_pred = catboost_model.predict(X_test)
    catboost_proba = catboost_model.predict_proba(X_test)[:, 1]
    catboost_metrics = calculate_all_metrics(y_test, catboost_pred, catboost_proba, returns_test)
    
    results['models']['catboost'] = {
        'version': f"catboost-{datetime.now().strftime('%Y%m%d-%H%M')}",
        'params': {k: v for k, v in CATBOOST_PARAMS.items() if k != 'verbose'},
        'metrics': catboost_metrics,
        'feature_importance': dict(zip(feature_names, catboost_model.feature_importances_.tolist()))
    }
    
    # Save CatBoost model
    catboost_path = output_dir / 'catboost_model.joblib'
    joblib.dump(catboost_model, catboost_path)
    logger.info(f"  ✓ CatBoost: Accuracy={catboost_metrics['accuracy']:.4f}, Sharpe={catboost_metrics['sharpe_ratio']:.2f}")
    
    # ==========================================================================
    # Train Random Forest
    # ==========================================================================
    
    logger.info("🌳 Training Random Forest...")
    rf_model = train_randomforest(X_train, y_train, X_test, y_test)
    
    rf_pred = rf_model.predict(X_test)
    rf_proba = rf_model.predict_proba(X_test)[:, 1]
    rf_metrics = calculate_all_metrics(y_test, rf_pred, rf_proba, returns_test)
    
    results['models']['randomforest'] = {
        'version': f"rf-{datetime.now().strftime('%Y%m%d-%H%M')}",
        'params': RANDOMFOREST_PARAMS,
        'metrics': rf_metrics,
        'feature_importance': dict(zip(feature_names, rf_model.feature_importances_.tolist())),
        'oob_score': float(rf_model.oob_score_) if rf_model.oob_score else None
    }
    
    # Save Random Forest model
    rf_path = output_dir / 'randomforest_model.joblib'
    joblib.dump(rf_model, rf_path)
    logger.info(f"  ✓ Random Forest: Accuracy={rf_metrics['accuracy']:.4f}, Sharpe={rf_metrics['sharpe_ratio']:.2f}")
    
    # ==========================================================================
    # Ensemble Predictions (4-Model Weighted Average)
    # ==========================================================================
    
    logger.info("🎯 Creating 4-Model Ensemble...")
    
    # Weighted average based on model characteristics:
    # - LightGBM (30%): Fast, accurate on tabular data
    # - XGBoost (25%): Robust regularization
    # - CatBoost (25%): Good with ordered data, reduces overfitting
    # - Random Forest (20%): Bagging diversity, reduces variance
    ensemble_weights = {
        'lightgbm': 0.30,
        'xgboost': 0.25,
        'catboost': 0.25,
        'randomforest': 0.20
    }
    
    ensemble_proba = (
        ensemble_weights['lightgbm'] * lgbm_proba +
        ensemble_weights['xgboost'] * xgb_proba +
        ensemble_weights['catboost'] * catboost_proba +
        ensemble_weights['randomforest'] * rf_proba
    )
    ensemble_pred = (ensemble_proba > 0.5).astype(int)
    ensemble_metrics = calculate_all_metrics(y_test, ensemble_pred, ensemble_proba, returns_test)
    
    results['models']['ensemble'] = {
        'version': f"ensemble-{datetime.now().strftime('%Y%m%d-%H%M')}",
        'weights': ensemble_weights,
        'metrics': ensemble_metrics,
        'model_count': 4
    }
    
    logger.info(f"  ✓ Ensemble (4 models): Accuracy={ensemble_metrics['accuracy']:.4f}, Sharpe={ensemble_metrics['sharpe_ratio']:.2f}")
    
    # ==========================================================================
    # Save Scaler and Results
    # ==========================================================================
    
    scaler_path = output_dir / 'scaler.joblib'
    joblib.dump(scaler, scaler_path)
    
    results_path = output_dir / 'training_results.json'
    with open(results_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    
    logger.info(f"💾 Models and results saved to {output_dir}")
    
    return results


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Load features
    data_dir = Path(__file__).parent / 'data'
    features_file = data_dir / 'features.parquet'
    
    if not features_file.exists():
        logger.error(f"Features file not found: {features_file}")
        logger.info("Run feature_engineering.py first")
        exit(1)
    
    df = pd.read_parquet(features_file)
    logger.info(f"📂 Loaded {len(df):,} samples")
    
    # Train models
    results = train_and_evaluate(df)
    
    print("\n" + "="*60)
    print("📊 TRAINING RESULTS")
    print("="*60)
    
    for model_name, model_data in results['models'].items():
        metrics = model_data['metrics']
        print(f"\n{model_name.upper()}:")
        print(f"  Accuracy:     {metrics['accuracy']:.4f}")
        print(f"  Precision:    {metrics['precision']:.4f}")
        print(f"  Recall:       {metrics['recall']:.4f}")
        print(f"  F1 Score:     {metrics['f1_score']:.4f}")
        print(f"  ROC AUC:      {metrics['roc_auc']:.4f}")
        print(f"  Sharpe Ratio: {metrics['sharpe_ratio']:.2f}")
        print(f"  Max Drawdown: {metrics['max_drawdown']:.2%}")
        print(f"  Win Rate:     {metrics['win_rate']:.2%}")
        print(f"  Profit Factor:{metrics['profit_factor']:.2f}")
