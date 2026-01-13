#!/usr/bin/env python3
"""
Validate Parser Completeness

Compares the parsed bindings against the actual MLX Python module
to detect any missing bindings.

Usage:
    python scripts/validate-completeness.py [bindings.json]
"""

import json
import sys
import inspect
from pathlib import Path
from typing import Set, Dict, Any

def get_mlx_api() -> Dict[str, Set[str]]:
    """Extract all public API from the MLX Python module."""
    try:
        import mlx.core as mx
    except ImportError:
        print("ERROR: MLX not installed. Run: pip install mlx")
        sys.exit(1)

    api = {
        'functions': set(),
        'classes': set(),
        'constants': set(),
        'modules': set(),
    }

    for name in dir(mx):
        if name.startswith('_'):
            continue

        obj = getattr(mx, name)

        if inspect.isfunction(obj) or inspect.isbuiltin(obj):
            api['functions'].add(name)
        elif inspect.isclass(obj):
            api['classes'].add(name)
        elif inspect.ismodule(obj):
            api['modules'].add(name)
        else:
            # Constants, dtypes, etc.
            api['constants'].add(name)

    return api


def load_parsed_bindings(path: str) -> Dict[str, Set[str]]:
    """Load bindings from our parser's JSON output."""
    with open(path) as f:
        data = json.load(f)

    parsed = {
        'functions': set(),
        'classes': set(),
        'constants': set(),
    }

    for binding in data['bindings']:
        if binding['type'] == 'function':
            parsed['functions'].add(binding['name'])
        elif binding['type'] == 'class':
            parsed['classes'].add(binding['name'])
        elif binding['type'] == 'attribute':
            parsed['constants'].add(binding['name'])
        elif binding['type'] == 'enum':
            parsed['classes'].add(binding['name'])  # Enums appear as classes

    return parsed


def compare_apis(mlx_api: Dict[str, Set[str]], parsed: Dict[str, Set[str]]) -> Dict[str, Any]:
    """Compare MLX API with parsed bindings."""
    results = {}

    for category in ['functions', 'classes', 'constants']:
        mlx_set = mlx_api.get(category, set())
        parsed_set = parsed.get(category, set())

        missing = mlx_set - parsed_set
        extra = parsed_set - mlx_set
        found = mlx_set & parsed_set

        coverage = len(found) / len(mlx_set) * 100 if mlx_set else 100

        results[category] = {
            'mlx_count': len(mlx_set),
            'parsed_count': len(parsed_set),
            'found': len(found),
            'missing': sorted(missing),
            'extra': sorted(extra),
            'coverage': coverage,
        }

    return results


def main():
    # Find bindings.json
    bindings_path = sys.argv[1] if len(sys.argv) > 1 else 'generated/bindings.json'

    if not Path(bindings_path).exists():
        print(f"ERROR: {bindings_path} not found. Run: npm run generate")
        sys.exit(1)

    print("=" * 60)
    print("MLX Parser Completeness Validation")
    print("=" * 60)
    print()

    # Get both APIs
    print("Loading MLX Python module...")
    mlx_api = get_mlx_api()

    print("Loading parsed bindings...")
    parsed = load_parsed_bindings(bindings_path)

    print()

    # Compare
    results = compare_apis(mlx_api, parsed)

    # Output results
    all_good = True

    for category, data in results.items():
        print(f"=== {category.upper()} ===")
        print(f"  MLX has:    {data['mlx_count']}")
        print(f"  We parsed:  {data['parsed_count']}")
        print(f"  Coverage:   {data['coverage']:.1f}%")

        if data['missing']:
            all_good = False
            print(f"  MISSING ({len(data['missing'])}):")
            for name in data['missing'][:20]:  # Show first 20
                print(f"    - {name}")
            if len(data['missing']) > 20:
                print(f"    ... and {len(data['missing']) - 20} more")

        if data['extra']:
            print(f"  EXTRA ({len(data['extra'])}):")
            for name in data['extra'][:10]:
                print(f"    + {name}")

        print()

    # Summary
    print("=" * 60)
    total_mlx = sum(r['mlx_count'] for r in results.values())
    total_found = sum(r['found'] for r in results.values())
    total_coverage = total_found / total_mlx * 100 if total_mlx else 100

    print(f"TOTAL COVERAGE: {total_found}/{total_mlx} ({total_coverage:.1f}%)")

    if all_good:
        print("✓ All MLX API items are covered!")
        return 0
    else:
        print("✗ Some MLX API items are missing!")
        return 1


if __name__ == '__main__':
    sys.exit(main())
