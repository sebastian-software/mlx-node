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

// Try to load the native module
let native;
try {
  // Try build directory first (development)
  native = require(join(__dirname, '..', 'build', 'Release', 'mlx_node.node'));
} catch (e1) {
  try {
    // Try project root (installed)
    native = require(join(__dirname, '..', 'mlx_node.node'));
  } catch (e2) {
    console.error('Failed to load mlx-node native module.');
    console.error('Make sure MLX is installed and the module is built:');
    console.error('  npm run build');
    console.error('');
    console.error('Details:', e2.message);
    throw e2;
  }
}

// Re-export all native bindings
export const {
  // Array class
  array: MLXArray,

  // Dtype constants
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

  // All other exports from native module
  ...rest
} = native;

// Also export the array as 'array' for Python-like API
export { native as core };
export const array = MLXArray;

// Default export with everything
export default native;
