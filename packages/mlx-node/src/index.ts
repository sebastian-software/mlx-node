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

// ============================================================================
// Mathematical Constants
// ============================================================================

/** Euler's number (base of natural logarithm) */
export const e = Math.E;

/** Ratio of circle's circumference to its diameter */
export const pi = Math.PI;

/** Euler-Mascheroni constant (γ ≈ 0.5772) */
export const euler_gamma = 0.5772156649015329;

/** Positive infinity */
export const inf = Infinity;

/** Not a Number */
export const nan = NaN;

/** Used for array indexing to add a new axis (like numpy.newaxis) */
export const newaxis = null;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Broadcast shapes together.
 *
 * Returns the shape that results from broadcasting the supplied array shapes
 * against each other.
 *
 * @param shapes - The shapes to broadcast together
 * @returns The broadcasted shape
 * @throws Error if the shapes cannot be broadcast together
 *
 * @example
 * broadcast_shapes([1, 2, 3], [3]) // [1, 2, 3]
 * broadcast_shapes([4, 1, 6], [5, 6]) // [4, 5, 6]
 * broadcast_shapes([5, 1, 4], [1, 3, 4]) // [5, 3, 4]
 */
export function broadcast_shapes(...shapes: number[][]): number[] {
  if (shapes.length === 0) {
    throw new Error('[broadcast_shapes] Must provide at least one shape.');
  }

  let result = [...shapes[0]];

  for (let i = 1; i < shapes.length; i++) {
    const shape = shapes[i];
    const resultLen = result.length;
    const shapeLen = shape.length;
    const maxLen = Math.max(resultLen, shapeLen);

    const newResult: number[] = new Array(maxLen);

    for (let j = 0; j < maxLen; j++) {
      const resultIdx = resultLen - maxLen + j;
      const shapeIdx = shapeLen - maxLen + j;

      const resultDim = resultIdx >= 0 ? result[resultIdx] : 1;
      const shapeDim = shapeIdx >= 0 ? shape[shapeIdx] : 1;

      if (resultDim === shapeDim) {
        newResult[j] = resultDim;
      } else if (resultDim === 1) {
        newResult[j] = shapeDim;
      } else if (shapeDim === 1) {
        newResult[j] = resultDim;
      } else {
        throw new Error(
          `[broadcast_shapes] Shapes cannot be broadcast together: ` +
          `[${result.join(', ')}] and [${shape.join(', ')}]`
        );
      }
    }

    result = newResult;
  }

  return result;
}

// ============================================================================
// Dtype Info Functions (finfo and iinfo)
// ============================================================================

interface FloatInfo {
  dtype: string;
  min: number;
  max: number;
  eps: number;
}

interface IntInfo {
  dtype: string;
  min: number | bigint;
  max: number | bigint;
}

const floatInfoMap: Record<string, FloatInfo> = {
  float16: {
    dtype: 'float16',
    min: -65504,
    max: 65504,
    eps: 0.00097656,
  },
  float32: {
    dtype: 'float32',
    min: -3.4028235e+38,
    max: 3.4028235e+38,
    eps: 1.1920929e-7,
  },
  float64: {
    dtype: 'float64',
    min: -1.7976931348623157e+308,
    max: 1.7976931348623157e+308,
    eps: 2.220446049250313e-16,
  },
  bfloat16: {
    dtype: 'bfloat16',
    min: -3.38953e+38,
    max: 3.38953e+38,
    eps: 0.0078125,
  },
};

const intInfoMap: Record<string, IntInfo> = {
  int8: {
    dtype: 'int8',
    min: -128,
    max: 127,
  },
  int16: {
    dtype: 'int16',
    min: -32768,
    max: 32767,
  },
  int32: {
    dtype: 'int32',
    min: -2147483648,
    max: 2147483647,
  },
  int64: {
    dtype: 'int64',
    min: BigInt('-9223372036854775808'),
    max: BigInt('9223372036854775807'),
  },
  uint8: {
    dtype: 'uint8',
    min: 0,
    max: 255,
  },
  uint16: {
    dtype: 'uint16',
    min: 0,
    max: 65535,
  },
  uint32: {
    dtype: 'uint32',
    min: 0,
    max: 4294967295,
  },
  uint64: {
    dtype: 'uint64',
    min: BigInt(0),
    max: BigInt('18446744073709551615'),
  },
};

/**
 * Get machine limits for floating point types.
 *
 * @param dtype - The floating point dtype name ('float16', 'float32', 'float64', 'bfloat16')
 * @returns An object with dtype, min, max, and eps properties
 * @throws Error if dtype is not a floating point type
 *
 * @example
 * finfo('float32').eps // 1.1920929e-7
 * finfo('float16').max // 65504
 */
export function finfo(dtype: string): FloatInfo {
  const info = floatInfoMap[dtype];
  if (!info) {
    throw new Error(`[finfo] dtype '${dtype}' is not a floating point type. ` +
      `Supported types: ${Object.keys(floatInfoMap).join(', ')}`);
  }
  return info;
}

/**
 * Get machine limits for integer types.
 *
 * @param dtype - The integer dtype name ('int8', 'int16', 'int32', 'int64', 'uint8', 'uint16', 'uint32', 'uint64')
 * @returns An object with dtype, min, and max properties
 * @throws Error if dtype is not an integer type
 *
 * @example
 * iinfo('int32').max // 2147483647
 * iinfo('uint8').max // 255
 */
export function iinfo(dtype: string): IntInfo {
  const info = intInfoMap[dtype];
  if (!info) {
    throw new Error(`[iinfo] dtype '${dtype}' is not an integer type. ` +
      `Supported types: ${Object.keys(intInfoMap).join(', ')}`);
  }
  return info;
}

// ============================================================================
// Array Utility Functions
// ============================================================================

/**
 * Repeat elements of an array along an axis.
 *
 * Unlike `repeat` which tiles the whole array, `repeat_interleave` repeats
 * each element individually:
 * - repeat([a,b,c], 2) → [a,b,c,a,b,c]
 * - repeat_interleave([a,b,c], 2) → [a,a,b,b,c,c]
 *
 * This is commonly used in Grouped Query Attention (GQA) to expand
 * key/value heads to match query heads.
 *
 * @param arr - Input array
 * @param repeats - Number of times to repeat each element
 * @param axis - Axis along which to repeat (default: -1)
 * @returns Array with repeated elements
 *
 * @example
 * // For GQA with 8 query heads and 2 KV heads:
 * // k shape: (batch, seq, 2, head_dim)
 * // After repeat_interleave(k, 4, axis=2):
 * // k shape: (batch, seq, 8, head_dim)
 */
export function repeat_interleave(
  arr: unknown,
  repeats: number,
  axis: number = -1
): unknown {
  const array = arr as { shape: number[] };
  const shape = array.shape;
  const ndim = shape.length;

  // Normalize negative axis
  const normalizedAxis = axis < 0 ? ndim + axis : axis;

  if (normalizedAxis < 0 || normalizedAxis >= ndim) {
    throw new Error(
      `[repeat_interleave] axis ${axis} is out of bounds for array with ${ndim} dimensions`
    );
  }

  // Strategy: expand_dims, broadcast, reshape
  // 1. Insert new dimension after the target axis
  const expanded = (native.expand_dims as (a: unknown, axis: number) => unknown)(
    arr,
    normalizedAxis + 1
  );

  // 2. Build broadcast shape: same as expanded but with 'repeats' at the new axis
  const expandedShape = (expanded as { shape: number[] }).shape;
  const broadcastShape = [...expandedShape];
  broadcastShape[normalizedAxis + 1] = repeats;

  // 3. Broadcast to repeat the elements
  const broadcasted = (native.broadcast_to as (a: unknown, shape: number[]) => unknown)(
    expanded,
    broadcastShape
  );

  // 4. Reshape to merge the repeated dimension
  const finalShape = [...shape];
  finalShape[normalizedAxis] = shape[normalizedAxis] * repeats;

  return (native.reshape as (a: unknown, shape: number[]) => unknown)(
    broadcasted,
    finalShape
  );
}

/**
 * Take the last element along an axis.
 *
 * Equivalent to arr[:, -1, :] in Python/NumPy notation when axis=1.
 * Commonly used to get the last token's logits in sequence models.
 *
 * @param arr - Input array
 * @param axis - Axis along which to take the last element
 * @param keepdims - If true, retains the reduced axis with size 1 (default: false)
 * @returns Array with the last element along the specified axis
 *
 * @example
 * // logits shape: (batch, seqLen, vocabSize)
 * // Get last position: (batch, vocabSize)
 * const lastLogits = take_last(logits, 1);
 */
export function take_last(
  arr: unknown,
  axis: number,
  keepdims: boolean = false
): unknown {
  const array = arr as { shape: number[] };
  const shape = array.shape;
  const ndim = shape.length;

  // Normalize negative axis
  const normalizedAxis = axis < 0 ? ndim + axis : axis;

  if (normalizedAxis < 0 || normalizedAxis >= ndim) {
    throw new Error(
      `[take_last] axis ${axis} is out of bounds for array with ${ndim} dimensions`
    );
  }

  // Build start and stop arrays for slice
  // start: [0, 0, ..., lastIndex, ..., 0]
  // stop: [shape[0], shape[1], ..., lastIndex+1, ..., shape[n-1]]
  const start = shape.map((_, i) => (i === normalizedAxis ? shape[i] - 1 : 0));
  const stop = shape.map((s, i) => (i === normalizedAxis ? s : s));

  // Use slice to get the last element along axis
  const sliced = (native.slice as (a: unknown, start: number[], stop: number[]) => unknown)(
    arr,
    start,
    stop
  );

  if (keepdims) {
    return sliced;
  }

  // Squeeze the axis dimension
  return (native.squeeze as (a: unknown, axis?: number) => unknown)(
    sliced,
    normalizedAxis
  );
}

/**
 * Slice an array along a single axis.
 *
 * Equivalent to arr[:, start:end, :] in Python/NumPy notation when axis=1.
 * Supports negative indices for start and end.
 *
 * @param arr - Input array
 * @param axis - Axis along which to slice
 * @param start - Start index (default: 0, supports negative)
 * @param end - End index (default: axis size, supports negative)
 * @returns Sliced array
 *
 * @example
 * // Get first n tokens from KV cache
 * // keys shape: (batch, seqLen, heads, dim)
 * const firstN = slice_axis(keys, 1, 0, n);
 *
 * // Get last n tokens
 * const lastN = slice_axis(keys, 1, -n);
 */
export function slice_axis(
  arr: unknown,
  axis: number,
  start: number = 0,
  end?: number
): unknown {
  const array = arr as { shape: number[] };
  const shape = array.shape;
  const ndim = shape.length;

  // Normalize negative axis
  const normalizedAxis = axis < 0 ? ndim + axis : axis;

  if (normalizedAxis < 0 || normalizedAxis >= ndim) {
    throw new Error(
      `[slice_axis] axis ${axis} is out of bounds for array with ${ndim} dimensions`
    );
  }

  const axisSize = shape[normalizedAxis];

  // Normalize start and end indices
  let normalizedStart = start < 0 ? axisSize + start : start;
  let normalizedEnd = end === undefined ? axisSize : (end < 0 ? axisSize + end : end);

  // Clamp to valid range
  normalizedStart = Math.max(0, Math.min(normalizedStart, axisSize));
  normalizedEnd = Math.max(normalizedStart, Math.min(normalizedEnd, axisSize));

  const sliceSize = normalizedEnd - normalizedStart;

  if (sliceSize === 0) {
    throw new Error(
      `[slice_axis] Empty slice: start=${start}, end=${end} on axis with size ${axisSize}`
    );
  }

  // Build start array: [0, 0, ..., normalizedStart, ..., 0]
  const startArr = shape.map((_, i) => (i === normalizedAxis ? normalizedStart : 0));

  // Build stop array: [shape[0], shape[1], ..., normalizedEnd, ..., shape[n-1]]
  const stopArr = shape.map((s, i) => (i === normalizedAxis ? normalizedEnd : s));

  return (native.slice as (a: unknown, start: number[], stop: number[]) => unknown)(
    arr,
    startArr,
    stopArr
  );
}

// ============================================================================
// Fast Namespace (for Python-compatible mx.fast.* API)
// ============================================================================

/**
 * Fast, fused operations optimized for performance.
 * These mirror Python's mx.fast.* namespace.
 *
 * NOTE: These functions require the corresponding MLX fast operations to be
 * exposed in the native bindings. If they are undefined, the native bindings
 * need to be regenerated with fast operation support.
 */
export const fast = {
  /**
   * Root Mean Square Layer Normalization.
   * Returns undefined if not available in native bindings.
   */
  rmsNorm: native.rms_norm as ((
    x: unknown,
    weight: unknown | undefined,
    eps: number,
    stream?: unknown
  ) => unknown) | undefined,

  /**
   * Rotary Position Embedding.
   * Returns undefined if not available in native bindings.
   */
  rope: native.rope as ((
    a: unknown,
    dims: number,
    traditional: boolean,
    base?: number,
    scale?: number,
    offset?: number | unknown,
    freqs?: unknown,
    stream?: unknown
  ) => unknown) | undefined,

  /**
   * Scaled Dot-Product Attention.
   * Returns undefined if not available in native bindings.
   */
  scaledDotProductAttention: native.scaled_dot_product_attention as ((
    q: unknown,
    k: unknown,
    v: unknown,
    scale: number,
    mask?: unknown,
    stream?: unknown
  ) => unknown) | undefined,
};

// ============================================================================
// Random Namespace (for Python-compatible mx.random.* API)
// ============================================================================

/**
 * Random number generation functions.
 * These mirror Python's mx.random.* namespace.
 */
export const random = {
  seed: native.seed as (seed: number) => void,
  key: native.key as (seed: number) => unknown,
  uniform: native.uniform as (...args: unknown[]) => unknown,
  normal: native.normal as (...args: unknown[]) => unknown,
  multivariate_normal: native.multivariate_normal as (...args: unknown[]) => unknown,
  randint: native.randint as (...args: unknown[]) => unknown,
  bernoulli: native.bernoulli as (...args: unknown[]) => unknown,
  truncated_normal: native.truncated_normal as (...args: unknown[]) => unknown,
  gumbel: native.gumbel as (...args: unknown[]) => unknown,
  categorical: native.categorical as (...args: unknown[]) => unknown,
  laplace: native.laplace as (...args: unknown[]) => unknown,
  permutation: native.permutation as (...args: unknown[]) => unknown,
};

// Add constants and utilities to the native module object for mx.e, mx.pi, etc.
Object.assign(native, {
  e,
  pi,
  euler_gamma,
  inf,
  nan,
  newaxis,
  broadcast_shapes,
  finfo,
  iinfo,
  repeat_interleave,
  take_last,
  slice_axis,
  fast,
  random,
});

// Default export with everything
export default native;
