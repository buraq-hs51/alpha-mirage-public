"""
=============================================================================
MAIN TRAINING PIPELINE - Orchestrates Full ML Training Workflow
=============================================================================
Main entry point for the ML training pipeline. Runs the complete workflow:

1. Fetch historical data (5 years)
2. Calculate technical features
3. Train LightGBM & XGBoost models
4. Evaluate ensemble performance
5. Compare with existing models
6. Export to TensorFlow.js (if improved)
7. Generate model manifest

Usage:
    python main.py                    # Run full pipeline
    python main.py --skip-fetch       # Skip data fetching (use cached)
    python main.py --force-deploy     # Deploy even if not improved
    python main.py --assets SPY,AAPL  # Train on specific assets only

Author: Shadaab Ahmed
=============================================================================
"""

import argparse
import json
import logging
import shutil
import sys
import traceback
from datetime import datetime
from pathlib import Path
from typing import List, Optional
import pandas as pd
import numpy as np

# Setup logging first
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('training.log')
    ]
)
logger = logging.getLogger(__name__)

# Import pipeline modules
from data_fetcher import fetch_all_data, load_cached_data, ASSET_UNIVERSE, ALL_SYMBOLS
from feature_engineering import engineer_features, process_all_symbols
from train_models import train_and_evaluate, prepare_data
from export_models import export_all_models
from compare_models import compare_all_models
from train_online_models import train_online_models
from vintage_manager import VintageManager, save_model_vintages


# =============================================================================
# PIPELINE CONFIGURATION
# =============================================================================

class PipelineConfig:
    """Configuration for training pipeline."""
    
    def __init__(self, args):
        self.skip_fetch = args.skip_fetch
        self.force_deploy = args.force_deploy
        self.assets = args.assets.split(',') if args.assets else None
        
        # Directories
        self.base_dir = Path(__file__).parent
        self.cache_dir = self.base_dir / 'cache'
        self.models_dir = self.base_dir / 'models'
        self.output_dir = self.base_dir.parent.parent / 'public' / 'models'
        
        # Create directories
        self.cache_dir.mkdir(exist_ok=True)
        self.models_dir.mkdir(exist_ok=True)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Training parameters
        # Default: 20 years for initial training, CI/CD uses --years 5
        self.years = args.years
        self.test_size = 0.2
        self.validation_size = 0.1


# =============================================================================
# PIPELINE STEPS
# =============================================================================

def step_fetch_data(config: PipelineConfig) -> dict:
    """Step 1: Fetch historical data."""
    logger.info("="*60)
    logger.info("📊 STEP 1: FETCHING HISTORICAL DATA")
    logger.info("="*60)
    
    data_dir = config.cache_dir / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    
    if config.skip_fetch:
        # Try to load cached data
        cached = load_cached_data(data_dir)
        if cached is not None:
            logger.info("Using cached data...")
            return cached
    
    # Determine assets to fetch
    if config.assets:
        symbols = [s for s in ALL_SYMBOLS if s in config.assets]
    else:
        symbols = ALL_SYMBOLS
    
    # Fetch data using the actual API
    df, metadata = fetch_all_data(
        symbols=symbols,
        years=config.years,
        output_dir=data_dir
    )
    
    logger.info(f"✅ Fetched data for {metadata['symbols_fetched']} assets ({len(df):,} rows)")
    return df


def step_feature_engineering(data: pd.DataFrame, config: PipelineConfig) -> dict:
    """Step 2: Calculate technical features."""
    logger.info("="*60)
    logger.info("🔧 STEP 2: FEATURE ENGINEERING")
    logger.info("="*60)
    
    features_data = {}
    
    # Data is now a combined DataFrame with 'symbol' column
    symbols = data['symbol'].unique()
    logger.info(f"Processing {len(symbols)} symbols...")
    
    for symbol in symbols:
        try:
            df = data[data['symbol'] == symbol].copy()
            
            # Ensure we have proper OHLCV columns
            required_cols = ['open', 'high', 'low', 'close', 'volume']
            # Handle case-insensitive column names
            df.columns = [c.lower() for c in df.columns]
            
            if not all(col in df.columns for col in required_cols):
                logger.warning(f"Skipping {symbol}: missing required columns")
                continue
            
            # Calculate features using engineer_features function
            features_df = engineer_features(df)
            
            if features_df is not None and len(features_df) > 100:
                features_data[symbol] = features_df
                logger.info(f"✅ {symbol}: {len(features_df)} samples, {len(features_df.columns)} features")
            else:
                logger.warning(f"⚠️ {symbol}: insufficient data after feature calculation")
                
        except Exception as e:
            logger.error(f"❌ {symbol}: {str(e)}")
            continue
    
    logger.info(f"✅ Feature engineering complete for {len(features_data)} assets")
    return features_data


def step_train_models(features_data: dict, config: PipelineConfig) -> dict:
    """Step 3: Train ML models using train_and_evaluate."""
    logger.info("="*60)
    logger.info("🤖 STEP 3: TRAINING MODELS")
    logger.info("="*60)
    
    # Combine all data for training
    all_features = []
    for symbol, df in features_data.items():
        df_copy = df.copy()
        df_copy['symbol'] = symbol
        all_features.append(df_copy)
    
    combined_df = pd.concat(all_features, ignore_index=True)
    logger.info(f"Combined dataset: {len(combined_df):,} samples, {len(combined_df.columns)} features")
    
    # Use the train_and_evaluate function which handles everything
    results = train_and_evaluate(combined_df, config.models_dir)
    
    # Log summary
    for model_name, model_info in results['models'].items():
        if 'metrics' in model_info:
            metrics = model_info['metrics']
            logger.info(f"   {model_name}: Accuracy={metrics.get('accuracy', 0):.2%}, Sharpe={metrics.get('sharpe_ratio', 0):.2f}")
    
    return results


def step_compare_and_deploy(results: dict, config: PipelineConfig) -> bool:
    """Step 4: Compare with existing models and decide on deployment."""
    logger.info("="*60)
    logger.info("📊 STEP 4: MODEL COMPARISON")
    logger.info("="*60)
    
    if config.force_deploy:
        logger.info("Force deploy flag set - skipping comparison")
        return True
    
    comparison = compare_all_models(results, config.output_dir)
    
    logger.info(f"\nDeploy Decision: {'YES' if comparison['deploy_decision'] else 'NO'}")
    logger.info(f"Reason: {comparison['deploy_reason']}")
    
    return comparison['deploy_decision']


def step_export_models(results: dict, config: PipelineConfig) -> dict:
    """Step 5: Export models to TensorFlow.js format."""
    logger.info("="*60)
    logger.info("📦 STEP 5: EXPORTING TO TENSORFLOW.JS")
    logger.info("="*60)
    
    export_results = export_all_models(config.models_dir, config.output_dir)
    
    logger.info(f"✅ Exported {len(export_results)} models to {config.output_dir}")
    
    return export_results


def step_generate_manifest(results: dict, config: PipelineConfig):
    """Step 6: Generate model manifest for frontend."""
    logger.info("="*60)
    logger.info("📋 STEP 6: GENERATING MANIFEST")
    logger.info("="*60)
    
    # Get online model info if available
    online_models = results.get('online_models', {})
    
    manifest = {
        'version': datetime.now().strftime('%Y%m%d'),
        'timestamp': datetime.now().isoformat(),
        'environment': 'production',
        'paradigms': {
            'rolling_window': True,
            'online_learning': bool(online_models),
            'vintage_ensemble': True,
        },
        'models': {
            'lightgbm': {
                'name': 'LightGBM',
                'type': 'classifier',
                'framework': 'tfjs',
                'paradigm': 'rolling_window',
                'files': {
                    'model': 'lightgbm/model.json',
                    'weights': 'lightgbm/model.weights.bin'
                },
                'metrics': results['models']['lightgbm']['metrics'],
                'inputShape': [results['feature_count']],
                'outputShape': [1],
                'featureNames': results['feature_names']
            },
            'xgboost': {
                'name': 'XGBoost',
                'type': 'classifier',
                'framework': 'tfjs',
                'paradigm': 'rolling_window',
                'files': {
                    'model': 'xgboost/model.json',
                    'weights': 'xgboost/model.weights.bin'
                },
                'metrics': results['models']['xgboost']['metrics'],
                'inputShape': [results['feature_count']],
                'outputShape': [1],
                'featureNames': results['feature_names']
            },
            'catboost': {
                'name': 'CatBoost',
                'type': 'classifier',
                'framework': 'tfjs',
                'paradigm': 'rolling_window',
                'files': {
                    'model': 'catboost/model.json',
                    'weights': 'catboost/model.weights.bin'
                },
                'metrics': results['models']['catboost']['metrics'],
                'inputShape': [results['feature_count']],
                'outputShape': [1],
                'featureNames': results['feature_names']
            },
            'randomforest': {
                'name': 'Random Forest',
                'type': 'classifier',
                'framework': 'tfjs',
                'paradigm': 'rolling_window',
                'files': {
                    'model': 'randomforest/model.json',
                    'weights': 'randomforest/model.weights.bin'
                },
                'metrics': results['models']['randomforest']['metrics'],
                'inputShape': [results['feature_count']],
                'outputShape': [1],
                'featureNames': results['feature_names']
            },
            'ensemble': {
                'name': 'Ensemble',
                'description': '4-model weighted average (LightGBM 30%, XGBoost 25%, CatBoost 25%, RandomForest 20%)',
                'metrics': results['models']['ensemble']['metrics']
            }
        },
        'onlineModels': {
            'sgd': {
                'name': 'SGD Classifier',
                'type': 'online',
                'paradigm': 'online_learning',
                'file': 'online/sgd_weights.json',
                'metrics': online_models.get('metrics', {}).get('sgd', {})
            },
            'passiveAggressive': {
                'name': 'Passive-Aggressive',
                'type': 'online',
                'paradigm': 'online_learning',
                'file': 'online/pa_weights.json',
                'metrics': online_models.get('metrics', {}).get('passive_aggressive', {})
            }
        } if online_models else {},
        'trainingInfo': {
            'samples': results.get('train_samples', results.get('training_samples', 0)),
            'features': results['feature_count'],
            'testSamples': results['test_samples'],
            'dataRange': f'{config.years} years'
        }
    }
    
    # Save manifest
    manifest_file = config.output_dir / 'manifest.json'
    with open(manifest_file, 'w') as f:
        json.dump(manifest, f, indent=2)
    
    # Also create registry for comparison
    registry = {
        'version': manifest['version'],
        'timestamp': manifest['timestamp'],
        'models': manifest['models']
    }
    
    registry_file = config.output_dir / 'registry.json'
    with open(registry_file, 'w') as f:
        json.dump(registry, f, indent=2)
    
    logger.info(f"✅ Manifest saved to {manifest_file}")


def step_cleanup(config: PipelineConfig):
    """Step 9: Cleanup temporary files."""
    logger.info("="*60)
    logger.info("🧹 STEP 9: CLEANUP")
    logger.info("="*60)
    
    # Remove old cache files (keep latest)
    # Keep the models directory for debugging
    
    logger.info("✅ Cleanup complete")


def step_train_online_models(features_data: dict, config: PipelineConfig) -> dict:
    """Step 7: Train online learning models (SGD, Passive-Aggressive)."""
    logger.info("="*60)
    logger.info("🎯 STEP 7: TRAINING ONLINE LEARNING MODELS")
    logger.info("="*60)
    
    # Combine all data
    all_features = []
    for symbol, df in features_data.items():
        df_copy = df.copy()
        df_copy['symbol'] = symbol
        all_features.append(df_copy)
    
    combined_df = pd.concat(all_features, ignore_index=True)
    
    # Train online models
    scaler_path = config.output_dir / 'scaler.json'
    
    try:
        online_results = train_online_models(
            features_df=combined_df,
            scaler_path=scaler_path,
            output_dir=config.output_dir,
            test_ratio=config.test_size,
        )
        
        logger.info(f"✅ Online models trained:")
        for model_name, model_metrics in online_results['metrics'].items():
            logger.info(f"   {model_name}: Accuracy={model_metrics.get('accuracy', 0):.2%}, AUC={model_metrics.get('roc_auc', 0):.4f}")
        
        return online_results
    except Exception as e:
        logger.warning(f"⚠️ Online model training failed: {e}")
        return {}


def step_save_vintages(results: dict, config: PipelineConfig) -> dict:
    """Step 8: Save current models as vintages for ensemble."""
    logger.info("="*60)
    logger.info("📦 STEP 8: SAVING MODEL VINTAGES")
    logger.info("="*60)
    
    # Prepare models info for vintage saving
    trained_models = {}
    
    for model_name in ['lightgbm', 'xgboost', 'catboost', 'randomforest']:
        if model_name in results.get('models', {}):
            trained_models[model_name] = {
                'metrics': results['models'][model_name].get('metrics', {}),
                'files': [
                    f'{model_name}/model.json',
                    f'{model_name}/model.weights.bin',
                ],
            }
    
    # Save vintages
    try:
        versions = save_model_vintages(config.output_dir, trained_models)
        logger.info(f"✅ Saved {len(versions)} model vintages")
        for model_name, version in versions.items():
            logger.info(f"   {model_name}: v{version}")
        return {'versions': versions}
    except Exception as e:
        logger.warning(f"⚠️ Vintage saving failed: {e}")
        return {}


# =============================================================================
# MAIN PIPELINE
# =============================================================================

def run_pipeline(config: PipelineConfig) -> bool:
    """Run the complete training pipeline."""
    start_time = datetime.now()
    
    print("\n" + "="*70)
    print("🚀 ALPHA ENGINE ML TRAINING PIPELINE")
    print("    Multi-Paradigm: Rolling Window + Online Learning + Vintages")
    print("="*70)
    print(f"Started at: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Assets: {config.assets if config.assets else 'ALL'}")
    print(f"Skip fetch: {config.skip_fetch}")
    print(f"Force deploy: {config.force_deploy}")
    print("="*70 + "\n")
    
    try:
        # Step 1: Fetch data
        data = step_fetch_data(config)
        
        # Step 2: Feature engineering
        features_data = step_feature_engineering(data, config)
        
        if not features_data:
            logger.error("No valid data after feature engineering!")
            return False
        
        # Step 3: Train main models (Rolling Window paradigm)
        results = step_train_models(features_data, config)
        
        # Step 4: Compare and decide
        should_deploy = step_compare_and_deploy(results, config)
        
        if should_deploy:
            # Step 5: Export models
            step_export_models(results, config)
            
            # Step 6: Generate manifest
            step_generate_manifest(results, config)
            
            # Step 7: Train online learning models
            online_results = step_train_online_models(features_data, config)
            results['online_models'] = online_results
            
            # Step 8: Save model vintages
            vintage_results = step_save_vintages(results, config)
            results['vintages'] = vintage_results
            
            # Re-generate manifest with online model info
            step_generate_manifest(results, config)
        else:
            logger.info("⚠️ New models not deployed - existing models retained")
        
        # Step 9: Cleanup
        step_cleanup(config)
        
        # Summary
        end_time = datetime.now()
        duration = (end_time - start_time).total_seconds()
        
        print("\n" + "="*70)
        print("✅ PIPELINE COMPLETE")
        print("="*70)
        print(f"Duration: {duration:.1f} seconds")
        print(f"Deployed: {'YES' if should_deploy else 'NO'}")
        print(f"Paradigms: Rolling Window ✅ | Online Learning {'✅' if results.get('online_models') else '❌'} | Vintages {'✅' if results.get('vintages') else '❌'}")
        print(f"Output: {config.output_dir}")
        print("="*70 + "\n")
        
        return True
        
    except Exception as e:
        logger.error(f"Pipeline failed: {str(e)}")
        logger.error(traceback.format_exc())
        return False


# =============================================================================
# ENTRY POINT
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description='Alpha Engine ML Training Pipeline')
    
    parser.add_argument(
        '--skip-fetch', 
        action='store_true',
        help='Skip data fetching (use cached data)'
    )
    parser.add_argument(
        '--force-deploy',
        action='store_true',
        help='Deploy models even if not improved'
    )
    parser.add_argument(
        '--assets',
        type=str,
        default=None,
        help='Comma-separated list of assets to train on (e.g., SPY,AAPL,BTC-USD)'
    )
    parser.add_argument(
        '--years',
        type=int,
        default=20,
        help='Number of years of historical data to train on (default: 20 for initial, CI/CD uses 5)'
    )
    
    args = parser.parse_args()
    config = PipelineConfig(args)
    
    success = run_pipeline(config)
    
    sys.exit(0 if success else 1)


if __name__ == '__main__':
    main()
