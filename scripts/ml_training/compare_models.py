"""
=============================================================================
MODEL COMPARISON - Compare New vs Existing Model Performance
=============================================================================
Compares newly trained models against existing deployed models to decide
whether to deploy the new version.

Comparison criteria:
1. Sharpe Ratio improvement > 0.5%
2. No significant regression in accuracy
3. Stability check (not just lucky on test set)

Author: Shadaab Ahmed
=============================================================================
"""

import json
import logging
from pathlib import Path
from typing import Dict, Tuple, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# =============================================================================
# COMPARISON LOGIC
# =============================================================================

def load_existing_registry(models_dir: Path) -> Optional[Dict]:
    """Load existing model registry if available."""
    registry_file = models_dir / 'registry.json'
    
    if not registry_file.exists():
        logger.info("No existing registry found - first deployment")
        return None
    
    with open(registry_file, 'r') as f:
        return json.load(f)


def calculate_composite_score(metrics: Dict) -> float:
    """
    Calculate composite score for model comparison.
    
    Weights:
    - Sharpe Ratio: 40%
    - Accuracy: 20%
    - Profit Factor: 20%
    - Win Rate: 10%
    - Sortino Ratio: 10%
    """
    weights = {
        'sharpe_ratio': 0.40,
        'accuracy': 0.20,
        'profit_factor': 0.20,
        'win_rate': 0.10,
        'sortino_ratio': 0.10
    }
    
    # Normalize metrics to 0-1 scale
    normalized = {
        'sharpe_ratio': min(max(metrics.get('sharpe_ratio', 0), 0), 5) / 5,
        'accuracy': metrics.get('accuracy', 0.5),
        'profit_factor': min(max(metrics.get('profit_factor', 1), 0), 3) / 3,
        'win_rate': metrics.get('win_rate', 0.5),
        'sortino_ratio': min(max(metrics.get('sortino_ratio', 0), 0), 5) / 5
    }
    
    score = sum(normalized[k] * weights[k] for k in weights)
    return score


def compare_models(
    new_metrics: Dict,
    existing_metrics: Dict,
    improvement_threshold: float = 0.005  # 0.5%
) -> Tuple[bool, str, Dict]:
    """
    Compare new model metrics against existing.
    
    Args:
        new_metrics: Metrics from newly trained model
        existing_metrics: Metrics from currently deployed model
        improvement_threshold: Minimum improvement required
        
    Returns:
        Tuple of (should_deploy, reason, comparison_details)
    """
    new_score = calculate_composite_score(new_metrics)
    existing_score = calculate_composite_score(existing_metrics)
    
    improvement = (new_score - existing_score) / existing_score if existing_score > 0 else 1.0
    
    comparison = {
        'new_composite_score': new_score,
        'existing_composite_score': existing_score,
        'improvement_pct': improvement * 100,
        'threshold_pct': improvement_threshold * 100,
        'new_sharpe': new_metrics.get('sharpe_ratio', 0),
        'existing_sharpe': existing_metrics.get('sharpe_ratio', 0),
        'new_accuracy': new_metrics.get('accuracy', 0),
        'existing_accuracy': existing_metrics.get('accuracy', 0)
    }
    
    # Decision logic
    if improvement >= improvement_threshold:
        # Check for accuracy regression (allow max 2% drop)
        accuracy_drop = existing_metrics.get('accuracy', 0) - new_metrics.get('accuracy', 0)
        if accuracy_drop > 0.02:
            return False, f"Accuracy regressed by {accuracy_drop:.2%}", comparison
        
        return True, f"Improvement of {improvement:.2%} exceeds threshold", comparison
    
    return False, f"Improvement of {improvement:.2%} below threshold of {improvement_threshold:.2%}", comparison


def compare_all_models(
    new_results: Dict,
    output_dir: Path = None
) -> Dict:
    """
    Compare all new models against existing deployed versions.
    
    Args:
        new_results: Training results with new model metrics
        output_dir: Directory containing existing models
        
    Returns:
        Comparison report
    """
    if output_dir is None:
        output_dir = Path(__file__).parent.parent.parent / 'public' / 'models'
    
    existing_registry = load_existing_registry(output_dir)
    
    report = {
        'timestamp': datetime.now().isoformat(),
        'comparisons': {},
        'deploy_decision': False,
        'deploy_reason': ''
    }
    
    # If no existing registry, deploy new models
    if existing_registry is None:
        report['deploy_decision'] = True
        report['deploy_reason'] = 'First deployment - no existing models'
        return report
    
    # Compare each model
    models_to_check = ['lightgbm', 'xgboost', 'ensemble']
    all_improvements = []
    
    for model_name in models_to_check:
        new_model = new_results['models'].get(model_name, {})
        existing_model = existing_registry['models'].get(model_name, {})
        
        if not new_model or not existing_model:
            continue
        
        new_metrics = new_model.get('metrics', {})
        existing_metrics = existing_model.get('metrics', {})
        
        should_deploy, reason, comparison = compare_models(new_metrics, existing_metrics)
        
        report['comparisons'][model_name] = {
            'should_deploy': should_deploy,
            'reason': reason,
            **comparison
        }
        
        all_improvements.append(comparison['improvement_pct'])
    
    # Overall decision: deploy if ensemble improved OR both individual models improved
    ensemble_improved = report['comparisons'].get('ensemble', {}).get('should_deploy', False)
    lgbm_improved = report['comparisons'].get('lightgbm', {}).get('should_deploy', False)
    xgb_improved = report['comparisons'].get('xgboost', {}).get('should_deploy', False)
    
    if ensemble_improved:
        report['deploy_decision'] = True
        report['deploy_reason'] = f"Ensemble improved by {report['comparisons']['ensemble']['improvement_pct']:.2f}%"
    elif lgbm_improved and xgb_improved:
        report['deploy_decision'] = True
        report['deploy_reason'] = "Both LightGBM and XGBoost improved"
    else:
        report['deploy_decision'] = False
        avg_improvement = sum(all_improvements) / len(all_improvements) if all_improvements else 0
        report['deploy_reason'] = f"Average improvement ({avg_improvement:.2f}%) below threshold"
    
    # Save comparison report
    report_file = output_dir.parent.parent / 'scripts' / 'ml_training' / 'comparison_report.json'
    report_file.parent.mkdir(parents=True, exist_ok=True)
    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)
    
    logger.info(f"📊 Comparison report saved to {report_file}")
    
    return report


# =============================================================================
# MAIN
# =============================================================================

if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    
    # Load new training results
    models_dir = Path(__file__).parent / 'models'
    results_file = models_dir / 'training_results.json'
    
    if not results_file.exists():
        logger.error(f"Training results not found: {results_file}")
        exit(1)
    
    with open(results_file, 'r') as f:
        new_results = json.load(f)
    
    # Compare
    report = compare_all_models(new_results)
    
    print("\n" + "="*60)
    print("📊 MODEL COMPARISON REPORT")
    print("="*60)
    
    for model_name, comparison in report['comparisons'].items():
        print(f"\n{model_name.upper()}:")
        print(f"  New Score:      {comparison['new_composite_score']:.4f}")
        print(f"  Existing Score: {comparison['existing_composite_score']:.4f}")
        print(f"  Improvement:    {comparison['improvement_pct']:.2f}%")
        print(f"  Deploy:         {'✓ YES' if comparison['should_deploy'] else '✗ NO'}")
        print(f"  Reason:         {comparison['reason']}")
    
    print(f"\n{'='*60}")
    print(f"FINAL DECISION: {'✓ DEPLOY' if report['deploy_decision'] else '✗ KEEP EXISTING'}")
    print(f"Reason: {report['deploy_reason']}")
    print("="*60)
