/**
 * Weight Loading Utilities
 *
 * Handles loading weights from safetensors files.
 */

import type { MX, Weights } from '../types.js';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, basename } from 'node:path';

/**
 * Common weight prefixes for different model types
 */
export const WEIGHT_PREFIXES = {
  // Multimodal Gemma3 models use this prefix
  LANGUAGE_MODEL: 'language_model.',
  // Standard models
  MODEL: 'model.'
} as const;

/**
 * Detect the weight prefix used in the weights
 */
export function detectWeightPrefix(weights: Weights): string {
  const keys = Object.keys(weights);

  // Check for multimodal prefix
  if (keys.some(k => k.startsWith(WEIGHT_PREFIXES.LANGUAGE_MODEL))) {
    return WEIGHT_PREFIXES.LANGUAGE_MODEL;
  }

  return '';
}

/**
 * Remap weight keys by removing a prefix
 */
export function remapWeightKeys(weights: Weights, prefix: string): Weights {
  if (!prefix) return weights;

  const remapped: Weights = {};
  for (const [key, value] of Object.entries(weights)) {
    if (key.startsWith(prefix)) {
      remapped[key.slice(prefix.length)] = value;
    } else {
      remapped[key] = value;
    }
  }
  return remapped;
}

/**
 * Load weights from a single safetensors file
 */
export function loadSafetensors(
  mx: MX,
  filepath: string
): Weights {
  // mx.load_safetensors returns { arrays, metadata }
  // We just need the arrays
  const result = (mx as unknown as {
    load_safetensors: (path: string) => Weights
  }).load_safetensors(filepath);

  return result;
}

/**
 * Load weights from a directory containing safetensors files
 *
 * Handles sharded models (model-00001-of-00004.safetensors, etc.)
 */
export function loadWeightsFromDirectory(
  mx: MX,
  dirPath: string
): Weights {
  const allWeights: Weights = {};

  // Find all safetensors files
  const files = readdirSync(dirPath)
    .filter((f: string) => f.endsWith('.safetensors'))
    .sort(); // Sort to load in order

  if (files.length === 0) {
    throw new Error(`No safetensors files found in ${dirPath}`);
  }

  // Load each file and merge weights
  for (const file of files) {
    const filepath = join(dirPath, file);
    const weights = loadSafetensors(mx, filepath);

    for (const [key, value] of Object.entries(weights)) {
      if (key in allWeights) {
        console.warn(`Duplicate weight key: ${key} (from ${file})`);
      }
      allWeights[key] = value;
    }
  }

  return allWeights;
}

/**
 * Load weights from either a file or directory
 */
export function loadWeights(
  mx: MX,
  path: string
): Weights {
  // Check if path is a file or directory
  if (path.endsWith('.safetensors')) {
    return loadSafetensors(mx, path);
  }

  // Assume it's a directory
  return loadWeightsFromDirectory(mx, path);
}

/**
 * Get weight statistics for debugging
 */
export function getWeightStats(weights: Weights): {
  numTensors: number;
  totalParameters: number;
  dtypes: Set<string>;
  shapes: Map<string, number[]>;
} {
  const dtypes = new Set<string>();
  const shapes = new Map<string, number[]>();
  let totalParameters = 0;

  for (const [key, tensor] of Object.entries(weights)) {
    dtypes.add(tensor.dtype.toString());
    shapes.set(key, tensor.shape);
    totalParameters += tensor.size;
  }

  return {
    numTensors: Object.keys(weights).length,
    totalParameters,
    dtypes,
    shapes
  };
}

/**
 * Print weight info for debugging
 */
export function printWeightInfo(weights: Weights): void {
  const stats = getWeightStats(weights);

  console.log(`\nWeight Statistics:`);
  console.log(`  Tensors: ${stats.numTensors}`);
  console.log(`  Parameters: ${(stats.totalParameters / 1e9).toFixed(2)}B`);
  console.log(`  Dtypes: ${[...stats.dtypes].join(', ')}`);

  console.log(`\nWeight Keys (first 20):`);
  const keys = [...stats.shapes.keys()].slice(0, 20);
  for (const key of keys) {
    const shape = stats.shapes.get(key)!;
    console.log(`  ${key}: [${shape.join(', ')}]`);
  }

  if (stats.shapes.size > 20) {
    console.log(`  ... and ${stats.shapes.size - 20} more`);
  }
}

/**
 * Validate that all expected weights are present
 */
export function validateWeights(
  weights: Weights,
  expectedKeys: string[],
  prefix = ''
): { missing: string[]; extra: string[] } {
  const prefixDot = prefix ? `${prefix}.` : '';
  const actualKeys = new Set(Object.keys(weights));

  const missing: string[] = [];
  const extra: string[] = [];

  // Check for missing keys
  for (const key of expectedKeys) {
    const fullKey = prefixDot + key;
    if (!actualKeys.has(fullKey)) {
      missing.push(fullKey);
    }
  }

  // Check for extra keys (not in expected)
  const expectedSet = new Set(expectedKeys.map(k => prefixDot + k));
  for (const key of actualKeys) {
    if (prefix && !key.startsWith(prefixDot)) continue;
    if (!expectedSet.has(key)) {
      extra.push(key);
    }
  }

  return { missing, extra };
}
