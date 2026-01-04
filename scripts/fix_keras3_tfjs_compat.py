#!/usr/bin/env python3
"""
=============================================================================
KERAS 3 TO TENSORFLOW.JS COMPATIBILITY FIX
=============================================================================
This script fixes ALL compatibility issues between Keras 3 exported models
and TensorFlow.js browser runtime.

ISSUES FIXED:
1. InputLayer: batch_shape → batchInputShape
2. input_layers/output_layers: flat list ['name', 0, 0] → nested [['name', 0, 0]]
3. inbound_nodes: {args: [...], kwargs: {...}} → [[[layer_name, node_idx, tensor_idx, {}]]]
4. dtype: {class_name: 'DTypePolicy', config: {name: 'float32'}} → 'float32'

Author: Shadaab Ahmed
Date: 2026-01-04
=============================================================================
"""

import json
import os
from pathlib import Path
from typing import Any, Dict, List, Optional
import copy


def extract_dtype_string(dtype_value: Any) -> str:
    """
    Convert Keras 3 dtype dict format to simple string.
    
    Keras 3 format:
        {"module": "keras", "class_name": "DTypePolicy", "config": {"name": "float32"}}
    
    TensorFlow.js expected:
        "float32"
    """
    if isinstance(dtype_value, str):
        return dtype_value
    
    if isinstance(dtype_value, dict):
        # Try to get from config.name
        if 'config' in dtype_value and isinstance(dtype_value['config'], dict):
            if 'name' in dtype_value['config']:
                return dtype_value['config']['name']
        # Fallback to class_name if it looks like a dtype
        if 'class_name' in dtype_value:
            class_name = dtype_value['class_name']
            if class_name in ['float32', 'float64', 'int32', 'int64']:
                return class_name
    
    # Default fallback
    return 'float32'


def extract_layer_reference(keras3_tensor_ref: Dict) -> List:
    """
    Extract layer reference from Keras 3 __keras_tensor__ format.
    
    Keras 3 format:
        {"class_name": "__keras_tensor__", "config": {
            "shape": [null, 64], 
            "dtype": "float32", 
            "keras_history": ["hidden_0", 0, 0]
        }}
    
    Returns:
        ["hidden_0", 0, 0]
    """
    if isinstance(keras3_tensor_ref, dict):
        if keras3_tensor_ref.get('class_name') == '__keras_tensor__':
            config = keras3_tensor_ref.get('config', {})
            if 'keras_history' in config:
                return config['keras_history']
    
    # If it's already a list, return as-is
    if isinstance(keras3_tensor_ref, list):
        return keras3_tensor_ref
    
    return None


def convert_inbound_nodes(keras3_inbound_nodes: List) -> List:
    """
    Convert Keras 3 inbound_nodes format to TensorFlow.js format.
    
    Keras 3 format:
        [{"args": [{"class_name": "__keras_tensor__", "config": {"keras_history": ["layer", 0, 0]}}], "kwargs": {}}]
    
    TensorFlow.js expected:
        [[["layer", 0, 0, {}]]]
    """
    if not keras3_inbound_nodes:
        return []
    
    tfjs_inbound_nodes = []
    
    for node in keras3_inbound_nodes:
        if isinstance(node, dict) and 'args' in node:
            # Keras 3 format - convert it
            node_connections = []
            
            args = node.get('args', [])
            kwargs = node.get('kwargs', {})
            
            for arg in args:
                layer_ref = extract_layer_reference(arg)
                if layer_ref:
                    # Format: [layer_name, node_index, tensor_index, kwargs]
                    connection = layer_ref + [kwargs if kwargs else {}]
                    node_connections.append(connection)
            
            if node_connections:
                tfjs_inbound_nodes.append(node_connections)
        
        elif isinstance(node, list):
            # Already in old format or partially converted
            # Check if it's the correct nested format
            if node and isinstance(node[0], list):
                # Already correct format [[...]]
                tfjs_inbound_nodes.append(node)
            else:
                # Might be flat format, wrap it
                tfjs_inbound_nodes.append([node])
    
    return tfjs_inbound_nodes


def fix_layer_config(layer: Dict) -> Dict:
    """
    Fix a single layer's configuration for TensorFlow.js compatibility.
    """
    layer = copy.deepcopy(layer)
    config = layer.get('config', {})
    
    # Fix 1: InputLayer batch_shape → batchInputShape
    if layer.get('class_name') == 'InputLayer':
        if 'batch_shape' in config and 'batchInputShape' not in config:
            config['batchInputShape'] = config.pop('batch_shape')
        # Ensure batch_input_shape also works
        if 'batch_input_shape' in config and 'batchInputShape' not in config:
            config['batchInputShape'] = config.pop('batch_input_shape')
    
    # Fix 4: dtype dict → string (for all layers)
    if 'dtype' in config:
        config['dtype'] = extract_dtype_string(config['dtype'])
    
    # Also fix kernel_initializer, bias_initializer if they have dtype issues
    for init_key in ['kernel_initializer', 'bias_initializer', 'gamma_initializer', 
                     'beta_initializer', 'moving_mean_initializer', 'moving_variance_initializer']:
        if init_key in config and isinstance(config[init_key], dict):
            init_config = config[init_key]
            if 'config' in init_config and isinstance(init_config['config'], dict):
                if 'dtype' in init_config['config']:
                    init_config['config']['dtype'] = extract_dtype_string(init_config['config']['dtype'])
    
    layer['config'] = config
    
    # Fix 3: inbound_nodes format
    if 'inbound_nodes' in layer:
        layer['inbound_nodes'] = convert_inbound_nodes(layer['inbound_nodes'])
    
    return layer


def fix_model_json(model_data: Dict) -> Dict:
    """
    Fix all Keras 3 compatibility issues in model.json for TensorFlow.js.
    """
    model_data = copy.deepcopy(model_data)
    
    # Navigate to model_config
    if 'modelTopology' not in model_data:
        print("   ⚠️  No modelTopology found")
        return model_data
    
    topology = model_data['modelTopology']
    
    if 'model_config' not in topology:
        print("   ⚠️  No model_config found")
        return model_data
    
    model_config = topology['model_config']
    
    if 'config' not in model_config:
        print("   ⚠️  No config found in model_config")
        return model_data
    
    config = model_config['config']
    
    # Fix 2: input_layers - ensure nested list format [['name', 0, 0]]
    if 'input_layers' in config:
        input_layers = config['input_layers']
        # Check if it's flat ['name', 0, 0] vs nested [['name', 0, 0]]
        if input_layers and not isinstance(input_layers[0], list):
            # It's flat, wrap it
            config['input_layers'] = [input_layers]
            print(f"   ✅ Fixed input_layers: {input_layers} → {config['input_layers']}")
    
    # Fix 2: output_layers - ensure nested list format [['name', 0, 0]]  
    if 'output_layers' in config:
        output_layers = config['output_layers']
        # Check if it's flat ['name', 0, 0] vs nested [['name', 0, 0]]
        if output_layers and not isinstance(output_layers[0], list):
            # It's flat, wrap it
            config['output_layers'] = [output_layers]
            print(f"   ✅ Fixed output_layers: {output_layers} → {config['output_layers']}")
    
    # Fix all layers
    if 'layers' in config:
        fixed_layers = []
        for i, layer in enumerate(config['layers']):
            fixed_layer = fix_layer_config(layer)
            fixed_layers.append(fixed_layer)
            
            # Report fixes
            layer_name = layer.get('config', {}).get('name', f'layer_{i}')
            layer_class = layer.get('class_name', 'Unknown')
            
            changes = []
            
            # Check if batchInputShape was added
            if layer_class == 'InputLayer':
                orig_config = layer.get('config', {})
                if 'batch_shape' in orig_config or 'batch_input_shape' in orig_config:
                    changes.append('batch_shape→batchInputShape')
            
            # Check if dtype was fixed
            orig_dtype = layer.get('config', {}).get('dtype')
            if isinstance(orig_dtype, dict):
                changes.append('dtype dict→string')
            
            # Check if inbound_nodes was fixed
            if layer.get('inbound_nodes'):
                orig_nodes = layer['inbound_nodes']
                if orig_nodes and isinstance(orig_nodes[0], dict):
                    changes.append('inbound_nodes→TFJS format')
            
            if changes:
                print(f"   ✅ Layer {i} ({layer_class} - {layer_name}): {', '.join(changes)}")
        
        config['layers'] = fixed_layers
    
    return model_data


def process_model_file(model_path: Path) -> bool:
    """
    Process a single model.json file.
    """
    print(f"\n{'='*60}")
    print(f"Processing: {model_path}")
    print('='*60)
    
    try:
        with open(model_path, 'r') as f:
            model_data = json.load(f)
        
        # Create backup
        backup_path = model_path.with_suffix('.json.backup')
        with open(backup_path, 'w') as f:
            json.dump(model_data, f)
        print(f"   📦 Backup created: {backup_path.name}")
        
        # Fix the model
        fixed_data = fix_model_json(model_data)
        
        # Save fixed model
        with open(model_path, 'w') as f:
            json.dump(fixed_data, f, separators=(',', ':'))
        
        print(f"   ✅ Model fixed and saved!")
        return True
        
    except Exception as e:
        print(f"   ❌ Error processing {model_path}: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """
    Main function to fix all model.json files.
    """
    print("="*60)
    print("KERAS 3 → TENSORFLOW.JS COMPATIBILITY FIX")
    print("="*60)
    
    # Find models directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    models_dir = project_root / 'public' / 'models'
    
    if not models_dir.exists():
        print(f"❌ Models directory not found: {models_dir}")
        return False
    
    print(f"📁 Models directory: {models_dir}")
    
    # Find all model.json files
    model_dirs = ['lightgbm', 'xgboost', 'catboost', 'randomforest']
    success_count = 0
    
    for model_name in model_dirs:
        model_path = models_dir / model_name / 'model.json'
        if model_path.exists():
            if process_model_file(model_path):
                success_count += 1
        else:
            print(f"⚠️  Model not found: {model_path}")
    
    print("\n" + "="*60)
    print(f"SUMMARY: Fixed {success_count}/{len(model_dirs)} models")
    print("="*60)
    
    if success_count == len(model_dirs):
        print("✅ All models fixed successfully!")
        print("\nNext steps:")
        print("1. Refresh http://localhost:5173/alpha-mirage/test-model.html")
        print("2. Verify model loads without errors")
        print("3. Refresh the main dashboard")
        return True
    else:
        print("⚠️  Some models failed to fix. Check errors above.")
        return False


if __name__ == '__main__':
    success = main()
    exit(0 if success else 1)
