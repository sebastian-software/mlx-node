/**
 * MLX Node.js Bindings
 *
 * This module provides Node.js bindings for Apple's MLX framework.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Native module type (all exports are dynamic)
type NativeModule = Record<string, unknown> & {
  array: unknown;
  bool: string;
  uint8: string;
  uint16: string;
  uint32: string;
  uint64: string;
  int8: string;
  int16: string;
  int32: string;
  int64: string;
  float16: string;
  float32: string;
  float64: string;
  bfloat16: string;
  complex64: string;
};

// Try to load the native module
let native: NativeModule;
try {
  // Try build directory first (development)
  native = require(join(__dirname, '..', 'build', 'Release', 'mlx_node.node'));
} catch {
  try {
    // Try project root (installed)
    native = require(join(__dirname, '..', 'mlx_node.node'));
  } catch (e) {
    console.error('Failed to load mlx-node native module.');
    console.error('Make sure MLX is installed and the module is built:');
    console.error('  npm run build');
    console.error('');
    console.error('Details:', (e as Error).message);
    throw e;
  }
}

// Re-export all native bindings
export const {
  array: MLXArray,
  bool,
  uint8,
  uint16,
  uint32,
  uint64,
  int8,
  int16,
  int32,
  int64,
  float16,
  float32,
  float64,
  bfloat16,
  complex64,
  ...rest
} = native;

// Also export the array as 'array' for Python-like API
export { native as core };
export const array = MLXArray;

// Default export with everything
export default native;
