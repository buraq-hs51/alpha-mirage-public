"""
=============================================================================
VINTAGE ENSEMBLE - Model Version Management
=============================================================================
Manages multiple versions (vintages) of trained models:
- Saves new model versions with timestamps
- Maintains history of last N versions
- Creates vintage manifest for browser loading
- Exports vintages for ensemble predictions

Author: Shadaab Ahmed
=============================================================================
"""

import json
import shutil
import logging
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# =============================================================================
# CONFIGURATION
# =============================================================================

MAX_VINTAGES = 4  # Keep last 4 versions (7d, 14d, 21d, 28d if weekly)
VINTAGE_DIR_NAME = 'vintages'


class VintageManager:
    """Manages model vintages for ensemble predictions."""
    
    def __init__(self, models_dir: Path):
        """
        Initialize vintage manager.
        
        Args:
            models_dir: Base directory for models (e.g., public/models)
        """
        self.models_dir = models_dir
        self.vintages_dir = models_dir / VINTAGE_DIR_NAME
        self.vintages_dir.mkdir(parents=True, exist_ok=True)
        
        self.manifest_path = self.vintages_dir / 'manifest.json'
        self.vintages: List[Dict] = []
        
        # Load existing manifest
        self._load_manifest()
    
    def _load_manifest(self) -> None:
        """Load existing vintages manifest."""
        if self.manifest_path.exists():
            try:
                with open(self.manifest_path, 'r') as f:
                    data = json.load(f)
                self.vintages = data.get('vintages', [])
                logger.info(f"📦 Loaded {len(self.vintages)} existing vintages")
            except Exception as e:
                logger.warning(f"Could not load vintage manifest: {e}")
                self.vintages = []
        else:
            self.vintages = []
    
    def _save_manifest(self) -> None:
        """Save vintages manifest."""
        manifest = {
            'version': datetime.now().strftime('%Y%m%d'),
            'timestamp': datetime.now().isoformat(),
            'maxVintages': MAX_VINTAGES,
            'vintages': self.vintages,
        }
        
        with open(self.manifest_path, 'w') as f:
            json.dump(manifest, f, indent=2)
        
        logger.info(f"💾 Saved vintage manifest with {len(self.vintages)} vintages")
    
    def save_current_as_vintage(
        self,
        model_name: str,
        metrics: Dict,
        model_files: List[str],
    ) -> Optional[str]:
        """
        Save the current model as a new vintage.
        
        Args:
            model_name: Name of the model (e.g., 'lightgbm', 'xgboost')
            metrics: Model performance metrics
            model_files: List of model files to copy (relative to models_dir)
            
        Returns:
            Version string of the new vintage, or None if failed
        """
        version = datetime.now().strftime('%Y%m%d%H%M')
        vintage_path = self.vintages_dir / model_name / version
        vintage_path.mkdir(parents=True, exist_ok=True)
        
        logger.info(f"📦 Creating vintage {version} for {model_name}...")
        
        try:
            # Copy model files to vintage directory
            for file_path in model_files:
                src = self.models_dir / file_path
                if src.exists():
                    dst = vintage_path / src.name
                    shutil.copy2(src, dst)
                    logger.info(f"  Copied: {src.name}")
                else:
                    logger.warning(f"  Missing: {file_path}")
            
            # Create vintage entry
            vintage_entry = {
                'version': version,
                'trainedAt': datetime.now().isoformat(),
                'modelName': model_name,
                'path': f'{VINTAGE_DIR_NAME}/{model_name}/{version}',
                'metrics': {
                    'sharpeRatio': metrics.get('sharpe_ratio', 0),
                    'accuracy': metrics.get('accuracy', 0),
                    'winRate': metrics.get('win_rate', 0),
                    'maxDrawdown': metrics.get('max_drawdown', 0),
                },
            }
            
            # Add to vintages list (newest first)
            self.vintages.insert(0, vintage_entry)
            
            # Remove old vintages if exceeding max
            self._cleanup_old_vintages(model_name)
            
            # Save manifest
            self._save_manifest()
            
            logger.info(f"✅ Created vintage {version} for {model_name}")
            return version
            
        except Exception as e:
            logger.error(f"Failed to create vintage: {e}")
            return None
    
    def _cleanup_old_vintages(self, model_name: str) -> None:
        """Remove vintages exceeding MAX_VINTAGES per model."""
        # Get vintages for this model
        model_vintages = [v for v in self.vintages if v['modelName'] == model_name]
        
        if len(model_vintages) > MAX_VINTAGES:
            # Sort by version (newest first)
            model_vintages.sort(key=lambda x: x['version'], reverse=True)
            
            # Get vintages to remove
            to_remove = model_vintages[MAX_VINTAGES:]
            
            for vintage in to_remove:
                # Remove from list
                self.vintages = [v for v in self.vintages if v['version'] != vintage['version']]
                
                # Remove directory
                vintage_path = self.models_dir / vintage['path']
                if vintage_path.exists():
                    shutil.rmtree(vintage_path)
                    logger.info(f"🗑️ Removed old vintage: {vintage['version']}")
    
    def get_vintages_for_model(self, model_name: str) -> List[Dict]:
        """Get all vintages for a specific model."""
        return [v for v in self.vintages if v['modelName'] == model_name]
    
    def get_all_vintages(self) -> List[Dict]:
        """Get all vintages across all models."""
        return self.vintages
    
    def get_latest_vintage(self, model_name: str) -> Optional[Dict]:
        """Get the most recent vintage for a model."""
        model_vintages = self.get_vintages_for_model(model_name)
        if model_vintages:
            return max(model_vintages, key=lambda x: x['version'])
        return None


def save_model_vintages(
    models_dir: Path,
    trained_models: Dict[str, Dict],
) -> Dict[str, str]:
    """
    Save all newly trained models as vintages.
    
    Args:
        models_dir: Path to models directory
        trained_models: Dict of model_name -> {metrics, files} for each trained model
        
    Returns:
        Dict of model_name -> version for each saved vintage
    """
    manager = VintageManager(models_dir)
    versions = {}
    
    for model_name, model_info in trained_models.items():
        # Default files for TensorFlow.js models
        default_files = [
            f'{model_name}/model.json',
            f'{model_name}/model.weights.bin',
        ]
        
        files = model_info.get('files', default_files)
        metrics = model_info.get('metrics', {})
        
        version = manager.save_current_as_vintage(
            model_name=model_name,
            metrics=metrics,
            model_files=files,
        )
        
        if version:
            versions[model_name] = version
    
    return versions


def get_vintage_summary(models_dir: Path) -> Dict:
    """
    Get summary of all vintages.
    
    Args:
        models_dir: Path to models directory
        
    Returns:
        Summary dict with vintage information
    """
    manager = VintageManager(models_dir)
    
    vintages = manager.get_all_vintages()
    
    # Group by model
    by_model = {}
    for v in vintages:
        model_name = v['modelName']
        if model_name not in by_model:
            by_model[model_name] = []
        by_model[model_name].append(v)
    
    return {
        'totalVintages': len(vintages),
        'byModel': by_model,
        'maxVintages': MAX_VINTAGES,
    }


if __name__ == '__main__':
    # For standalone testing
    logging.basicConfig(level=logging.INFO)
    print("Vintage Manager - Import this module to use")
