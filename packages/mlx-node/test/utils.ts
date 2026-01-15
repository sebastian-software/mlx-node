/**
 * Test utilities for MLX Node.js tests
 *
 * Provides helper functions similar to NumPy's testing utilities.
 */

import { expect } from 'vitest';

/**
 * Check if two arrays are element-wise equal within a tolerance.
 * Similar to np.allclose()
 */
export function allClose(
  a: { tolist(): number[] | number[][] },
  b: { tolist(): number[] | number[][] },
  rtol: number = 1e-5,
  atol: number = 1e-8
): boolean {
  const aList = flatten(a.tolist());
  const bList = flatten(b.tolist());

  if (aList.length !== bList.length) return false;

  for (let i = 0; i < aList.length; i++) {
    const diff = Math.abs(aList[i] - bList[i]);
    const tolerance = atol + rtol * Math.abs(bList[i]);
    if (diff > tolerance) return false;
  }

  return true;
}

/**
 * Assert that two arrays are element-wise equal within a tolerance.
 */
export function expectAllClose(
  actual: { tolist(): number[] | number[][] },
  expected: { tolist(): number[] | number[][] },
  rtol: number = 1e-5,
  atol: number = 1e-8
): void {
  const aList = flatten(actual.tolist());
  const bList = flatten(expected.tolist());

  expect(aList.length).toBe(bList.length);

  for (let i = 0; i < aList.length; i++) {
    const tolerance = atol + rtol * Math.abs(bList[i]);
    expect(Math.abs(aList[i] - bList[i])).toBeLessThanOrEqual(tolerance);
  }
}

/**
 * Flatten a nested array
 */
function flatten(arr: number | number[] | number[][]): number[] {
  if (typeof arr === 'number') return [arr];
  return arr.flat(Infinity) as number[];
}

/**
 * Compare array shapes
 */
export function shapeEqual(
  a: { shape: number[] },
  b: { shape: number[] }
): boolean {
  if (a.shape.length !== b.shape.length) return false;
  return a.shape.every((dim, i) => dim === b.shape[i]);
}

/**
 * Parsed slice component
 */
interface SliceSpec {
  type: 'index' | 'slice' | 'ellipsis' | 'newaxis';
  start?: number | null;
  stop?: number | null;
  step?: number | null;
  index?: number;
}

/**
 * Parse a Python-style slice string into components
 * Examples: "1:3", "::2", ":", "0", "...", "None"
 */
function parseSliceComponent(s: string): SliceSpec {
  s = s.trim();

  if (s === '...') {
    return { type: 'ellipsis' };
  }

  if (s === 'None' || s === 'null') {
    return { type: 'newaxis' };
  }

  if (s.includes(':')) {
    const parts = s.split(':');
    return {
      type: 'slice',
      start: parts[0] ? parseInt(parts[0], 10) : null,
      stop: parts[1] ? parseInt(parts[1], 10) : null,
      step: parts[2] ? parseInt(parts[2], 10) : null,
    };
  }

  return { type: 'index', index: parseInt(s, 10) };
}

/**
 * Parse a full Python-style slice expression
 * Examples: "1:3, ::2", ":, 0", "..., :32"
 */
function parseSliceExpr(expr: string): SliceSpec[] {
  // Split by comma but handle nested brackets
  const parts: string[] = [];
  let current = '';
  let depth = 0;

  for (const char of expr) {
    if (char === '[' || char === '(') {
      depth++;
      current += char;
    } else if (char === ']' || char === ')') {
      depth--;
      current += char;
    } else if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  if (current) parts.push(current);

  return parts.map(parseSliceComponent);
}

/**
 * Python-style array slicing utility.
 *
 * Converts Python slice syntax to MLX operations.
 *
 * @param mx - The MLX module
 * @param a - The array to slice
 * @param sliceExpr - Python-style slice expression (e.g., "1:3", ":, 0", "::2")
 * @returns The sliced array
 *
 * @example
 * // Python: a[1:3]
 * pySlice(mx, a, '1:3')
 *
 * // Python: a[:, 0]
 * pySlice(mx, a, ':, 0')
 *
 * // Python: a[::2]
 * pySlice(mx, a, '::2')
 */
export function pySlice(mx: any, a: any, sliceExpr: string): any {
  const specs = parseSliceExpr(sliceExpr);
  const shape: number[] = a.shape;

  // Handle simple 1D cases efficiently
  if (specs.length === 1 && specs[0].type === 'slice') {
    const spec = specs[0];
    const dim = shape[0];
    let start = spec.start ?? 0;
    let stop = spec.stop ?? dim;
    const step = spec.step ?? 1;

    // Handle negative indices
    if (start < 0) start = dim + start;
    if (stop < 0) stop = dim + stop;

    // Clamp to valid range
    start = Math.max(0, Math.min(start, dim));
    stop = Math.max(0, Math.min(stop, dim));

    if (step === 1) {
      // Use mx.slice for contiguous slicing
      const sliceSize = Math.max(0, stop - start);
      return mx.slice(a, mx.array([start]), [0], [sliceSize]);
    } else {
      // Use take with generated indices for stepped slicing
      const indices: number[] = [];
      if (step > 0) {
        for (let i = start; i < stop; i += step) {
          indices.push(i);
        }
      } else {
        // Negative step (reverse)
        const actualStart = spec.start ?? dim - 1;
        const actualStop = spec.stop ?? -1;
        for (let i = actualStart; i > actualStop; i += step) {
          if (i >= 0 && i < dim) indices.push(i);
        }
      }
      return mx.take(a, mx.array(indices), 0);
    }
  }

  // Handle single index (not slice)
  if (specs.length === 1 && specs[0].type === 'index') {
    return mx.take(a, mx.array([specs[0].index!]), 0).squeeze(0);
  }

  // For multi-dimensional slicing, we need to handle each axis
  // This is a simplified implementation that handles common cases
  let result = a;
  let axisOffset = 0;

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const axis = i + axisOffset;

    if (spec.type === 'ellipsis') {
      // Ellipsis consumes remaining dimensions
      const remainingSpecs = specs.length - i - 1;
      axisOffset = shape.length - remainingSpecs - i - 1;
      continue;
    }

    if (spec.type === 'newaxis') {
      // Add a new axis
      result = mx.expand_dims(result, axis);
      continue;
    }

    if (spec.type === 'index') {
      // Single index selection
      result = mx.take(result, mx.array([spec.index!]), axis).squeeze(axis);
      axisOffset--; // Dimension was removed
      continue;
    }

    if (spec.type === 'slice') {
      const dim = result.shape[axis];
      let start = spec.start ?? 0;
      let stop = spec.stop ?? dim;
      const step = spec.step ?? 1;

      // Handle negative indices
      if (start < 0) start = dim + start;
      if (stop < 0) stop = dim + stop;

      // Clamp
      start = Math.max(0, Math.min(start, dim));
      stop = Math.max(0, Math.min(stop, dim));

      if (step === 1 && start === 0 && stop === dim) {
        // Full slice, nothing to do
        continue;
      }

      if (step === 1) {
        // Contiguous slice - use slice operation
        const startIndices = new Array(result.shape.length).fill(0);
        startIndices[axis] = start;
        const sliceSize = [...result.shape];
        sliceSize[axis] = Math.max(0, stop - start);
        const axes = [axis];
        result = mx.slice(result, mx.array(startIndices), axes, sliceSize);
      } else {
        // Stepped slice - use take
        const indices: number[] = [];
        if (step > 0) {
          for (let j = start; j < stop; j += step) {
            indices.push(j);
          }
        } else {
          for (let j = start; j > stop; j += step) {
            if (j >= 0 && j < dim) indices.push(j);
          }
        }
        result = mx.take(result, mx.array(indices), axis);
      }
    }
  }

  return result;
}
