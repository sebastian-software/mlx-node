#!/usr/bin/env python3
"""
Numpy Expression Evaluator

Evaluates numpy expressions and returns JSON-serializable results.
Used by the test converter to pre-compute numpy values.
"""

import sys
import json
import numpy as np
import mlx.core as mx

def evaluate_expr(expr: str) -> dict:
    """Evaluate a numpy/mlx expression and return the result."""
    try:
        # Create evaluation context with numpy and mlx
        context = {
            'np': np,
            'mx': mx,
            'inf': float('inf'),
            'nan': float('nan'),
        }

        result = eval(expr, context)

        # Convert result to JSON-serializable format
        if isinstance(result, np.ndarray):
            return {
                'type': 'array',
                'value': result.tolist(),
                'dtype': str(result.dtype),
                'shape': list(result.shape)
            }
        elif isinstance(result, (np.bool_, bool)):
            return {'type': 'bool', 'value': bool(result)}
        elif isinstance(result, (np.integer, int)):
            return {'type': 'int', 'value': int(result)}
        elif isinstance(result, (np.floating, float)):
            if np.isnan(result):
                return {'type': 'nan'}
            elif np.isinf(result):
                return {'type': 'inf', 'value': float(result)}
            return {'type': 'float', 'value': float(result)}
        elif isinstance(result, (list, tuple)):
            return {'type': 'list', 'value': list(result)}
        elif result is None:
            return {'type': 'null'}
        else:
            return {'type': 'string', 'value': str(result)}

    except Exception as e:
        return {'type': 'error', 'error': str(e)}

def main():
    """Read expressions from stdin (one per line) and output JSON results."""
    results = []

    for line in sys.stdin:
        expr = line.strip()
        if expr:
            result = evaluate_expr(expr)
            result['expr'] = expr
            results.append(result)

    print(json.dumps(results))

if __name__ == '__main__':
    main()
