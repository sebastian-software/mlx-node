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

/**
 * Python-style slice assignment utility.
 *
 * Updates a portion of an array using Python slice syntax.
 *
 * @param mx - The MLX module
 * @param a - The array to update
 * @param sliceExpr - Python-style slice expression (e.g., "1:3", ":, 0")
 * @param value - The value to assign (scalar or array)
 * @returns A new array with the slice updated
 *
 * @example
 * // Python: a[1:3] = 0
 * pySliceUpdate(mx, a, '1:3', 0)
 *
 * // Python: a[:, 0] = mx.array([1, 2, 3])
 * pySliceUpdate(mx, a, ':, 0', mx.array([1, 2, 3]))
 */
export function pySliceUpdate(mx: any, a: any, sliceExpr: string, value: any): any {
  const specs = parseSliceExpr(sliceExpr);
  const shape: number[] = a.shape;

  // Convert value to array if needed
  const updateValue = typeof value === 'number' || typeof value === 'boolean'
    ? mx.array(value)
    : value;

  // Handle simple 1D case: a[start:stop] = value
  if (specs.length === 1 && specs[0].type === 'slice') {
    const spec = specs[0];
    const dim = shape[0];
    let start = spec.start ?? 0;
    let stop = spec.stop ?? dim;

    // Handle negative indices
    if (start < 0) start = dim + start;
    if (stop < 0) stop = dim + stop;

    // Clamp to valid range
    start = Math.max(0, Math.min(start, dim));
    stop = Math.max(0, Math.min(stop, dim));

    const sliceSize = Math.max(0, stop - start);

    // Broadcast value to match slice size if needed
    let broadcastedUpdate: any;
    if (updateValue.shape.length === 0) {
      // Scalar - broadcast to slice shape
      broadcastedUpdate = mx.broadcast_to(updateValue, [sliceSize, ...shape.slice(1)]);
    } else if (updateValue.shape[0] !== sliceSize) {
      // Try to broadcast
      broadcastedUpdate = mx.broadcast_to(updateValue, [sliceSize, ...shape.slice(1)]);
    } else {
      broadcastedUpdate = updateValue;
    }

    // Use slice_update
    const startIndices = mx.array([start]);
    const axes = [0];
    return mx.slice_update(a, broadcastedUpdate, startIndices, axes);
  }

  // Handle single index: a[i] = value (not a slice, just indexing)
  if (specs.length === 1 && specs[0].type === 'index') {
    const idx = specs[0].index!;
    const actualIdx = idx < 0 ? shape[0] + idx : idx;

    // Expand value to match the slice we're updating
    let broadcastedUpdate = updateValue;
    if (updateValue.shape.length === 0) {
      broadcastedUpdate = mx.broadcast_to(updateValue, [1, ...shape.slice(1)]);
    } else {
      broadcastedUpdate = mx.expand_dims(updateValue, 0);
    }

    const startIndices = mx.array([actualIdx]);
    const axes = [0];
    return mx.slice_update(a, broadcastedUpdate, startIndices, axes);
  }

  // Multi-dimensional slice update
  // Build start indices and axes for slice_update
  const startIndices: number[] = [];
  const axes: number[] = [];
  const sliceSizes: number[] = [...shape];
  let axisOffset = 0;

  for (let i = 0; i < specs.length; i++) {
    const spec = specs[i];
    const axis = i + axisOffset;

    if (spec.type === 'ellipsis') {
      // Ellipsis: skip remaining dimensions
      const remainingSpecs = specs.length - i - 1;
      axisOffset = shape.length - remainingSpecs - i - 1;
      continue;
    }

    if (spec.type === 'newaxis') {
      // newaxis in slice assignment - complex case
      axisOffset++;
      continue;
    }

    if (spec.type === 'index') {
      // Single index
      const idx = spec.index!;
      const actualIdx = idx < 0 ? shape[axis] + idx : idx;
      startIndices.push(actualIdx);
      axes.push(axis);
      sliceSizes[axis] = 1;
      continue;
    }

    if (spec.type === 'slice') {
      const dim = shape[axis];
      let start = spec.start ?? 0;
      let stop = spec.stop ?? dim;

      // Handle negative indices
      if (start < 0) start = dim + start;
      if (stop < 0) stop = dim + stop;

      // Clamp
      start = Math.max(0, Math.min(start, dim));
      stop = Math.max(0, Math.min(stop, dim));

      startIndices.push(start);
      axes.push(axis);
      sliceSizes[axis] = Math.max(0, stop - start);
    }
  }

  // Broadcast update value to match target shape
  let broadcastedUpdate = updateValue;
  const targetShape = sliceSizes.filter((_, i) => {
    // Only include dimensions that aren't being fully indexed
    const specIdx = axes.indexOf(i);
    if (specIdx === -1) return true;
    return specs[specIdx]?.type === 'slice';
  });

  if (broadcastedUpdate.shape.length === 0) {
    // Scalar - broadcast to full slice shape
    const updateShape = axes.map((ax, i) => sliceSizes[ax]);
    if (updateShape.length > 0) {
      broadcastedUpdate = mx.broadcast_to(broadcastedUpdate, sliceSizes);
    }
  }

  return mx.slice_update(a, broadcastedUpdate, mx.array(startIndices), axes);
}

/**
 * Python-style .at[] indexer for functional array updates.
 *
 * Provides JAX-style functional updates: a.at[idx].add(value) returns a new
 * array with the value added at the specified index.
 *
 * @param mx - The MLX module
 * @param a - The array to update
 * @param indexExpr - Python-style index expression (e.g., "1", "0:1", ":, 0")
 * @returns An AtIndexer with add, subtract, multiply, divide, maximum, minimum methods
 *
 * @example
 * // Python: a = a.at[1].add(2)
 * a = pyAt(mx, a, '1').add(2)
 *
 * // Python: a = a.at[0:1].add(update)
 * a = pyAt(mx, a, '0:1').add(update)
 */
export function pyAt(mx: any, a: any, indexExpr: string): AtIndexer {
  return new AtIndexer(mx, a, indexExpr);
}

/**
 * Fluent interface for .at[] operations
 */
class AtIndexer {
  constructor(
    private mx: any,
    private a: any,
    private indexExpr: string
  ) {}

  /**
   * Add value at the specified index
   */
  add(value: any): any {
    return this.applyOp(value, (current, val) => this.mx.add(current, val));
  }

  /**
   * Subtract value at the specified index
   */
  subtract(value: any): any {
    return this.applyOp(value, (current, val) => this.mx.subtract(current, val));
  }

  /**
   * Multiply value at the specified index
   */
  multiply(value: any): any {
    return this.applyOp(value, (current, val) => this.mx.multiply(current, val));
  }

  /**
   * Divide value at the specified index
   */
  divide(value: any): any {
    return this.applyOp(value, (current, val) => this.mx.divide(current, val));
  }

  /**
   * Take element-wise maximum at the specified index
   */
  maximum(value: any): any {
    return this.applyOp(value, (current, val) => this.mx.maximum(current, val));
  }

  /**
   * Take element-wise minimum at the specified index
   */
  minimum(value: any): any {
    return this.applyOp(value, (current, val) => this.mx.minimum(current, val));
  }

  /**
   * Apply an operation at the index
   */
  private applyOp(value: any, op: (current: any, value: any) => any): any {
    const indexExpr = this.indexExpr.trim();

    // Handle None/null (newaxis) - just apply op to entire array
    if (indexExpr === 'None' || indexExpr === 'null') {
      return op(this.a, value);
    }

    // Check if this is a simple integer index
    if (/^-?\d+$/.test(indexExpr)) {
      return this.applyAtIndex(parseInt(indexExpr, 10), value, op);
    }

    // Check if this contains a slice (colon)
    if (indexExpr.includes(':')) {
      return this.applyAtSlice(indexExpr, value, op);
    }

    // For array indices or complex expressions, try to handle common cases
    // This is a simplified implementation - complex cases may not work
    return this.applyAtExpression(indexExpr, value, op);
  }

  /**
   * Apply operation at a single integer index
   */
  private applyAtIndex(idx: number, value: any, op: (current: any, value: any) => any): any {
    const shape = this.a.shape;
    const dim = shape[0];
    const actualIdx = idx < 0 ? dim + idx : idx;

    // Get current value at index
    const current = this.mx.take(this.a, this.mx.array([actualIdx]), 0);

    // Apply operation
    const updated = op(current, value);

    // Put back using slice_update
    const startIndices = this.mx.array([actualIdx]);
    const axes = [0];

    // Ensure updated has correct shape for slice_update
    let updateShaped = updated;
    if (updated.shape.length === shape.length - 1) {
      updateShaped = this.mx.expand_dims(updated, 0);
    }

    return this.mx.slice_update(this.a, updateShaped, startIndices, axes);
  }

  /**
   * Apply operation at a slice
   */
  private applyAtSlice(sliceExpr: string, value: any, op: (current: any, value: any) => any): any {
    // Get current values at slice
    const current = pySlice(this.mx, this.a, sliceExpr);

    // Apply operation
    const updated = op(current, value);

    // Put back using pySliceUpdate
    return pySliceUpdate(this.mx, this.a, sliceExpr, updated);
  }

  /**
   * Apply operation at a complex expression (array indices, multi-dimensional)
   * This is a best-effort implementation for common patterns
   */
  private applyAtExpression(expr: string, value: any, op: (current: any, value: any) => any): any {
    // For expressions like "idx_x, :, 0" - mixed array and slice indexing
    // This requires scatter operations which aren't available
    // Fall back to a loop-based approach for simple array indices

    // Try to detect if this is a simple variable name (array index)
    if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(expr)) {
      // Single array variable as index - would need scatter
      // For now, throw an informative error
      throw new Error(`Array indexing in .at[] requires scatter operations: ${expr}`);
    }

    // For comma-separated expressions, try slice-based approach
    // This won't work correctly for all cases but handles some
    const current = pySlice(this.mx, this.a, expr);
    const updated = op(current, value);
    return pySliceUpdate(this.mx, this.a, expr, updated);
  }
}
