/**
 * Test utilities for MLX Node.js tests
 *
 * Provides helper functions similar to NumPy's testing utilities.
 */

import { expect } from 'vitest';

/**
 * Python-style assertEqual for arrays.
 *
 * In Python, assertEqual on MLX arrays compares element-wise.
 * This function replicates that behavior for use in tests.
 *
 * @param mx - The MLX module
 * @param actual - The actual value
 * @param expected - The expected value
 *
 * @example
 * pyAssertEqual(mx, new mx.array([1,2,3]), new mx.array([1,2,3])) // passes
 */
export function pyAssertEqual(mx: any, actual: any, expected: any): void {
  const actualIsArray = isMLXArrayCheck(actual);
  const expectedIsArray = isMLXArrayCheck(expected);

  // Both are MLX arrays - use array_equal
  if (actualIsArray && expectedIsArray) {
    const equal = mx.array_equal(actual, expected).item();
    expect(equal).toBe(true);
    return;
  }

  // One is array, one is scalar - convert and compare
  if (actualIsArray || expectedIsArray) {
    const equal = mx.array_equal(
      actualIsArray ? actual : new mx.array(actual),
      expectedIsArray ? expected : new mx.array(expected)
    ).item();
    expect(equal).toBe(true);
    return;
  }

  // Neither is array - use regular equality
  expect(actual).toEqual(expected);
}

/**
 * Check if value is an MLX array (internal helper to avoid name collision)
 */
function isMLXArrayCheck(value: unknown): boolean {
  return value !== null &&
    typeof value === 'object' &&
    'shape' in value &&
    'dtype' in value;
}

/**
 * Python-style isnan that works on both scalars and arrays.
 *
 * For scalars: uses Number.isNaN()
 * For arrays: uses mx.isnan().item() for single element, or returns array
 *
 * @param mx - The MLX module
 * @param value - Value to check
 * @returns boolean for scalars, MLX array for arrays
 */
export function pyIsNaN(mx: any, value: unknown): boolean | any {
  if (isMLXArrayCheck(value)) {
    const result = mx.isnan(value);
    // If result is a single-element array, return the scalar
    const shape = result.shape;
    if (shape.length === 0 || (shape.length === 1 && shape[0] === 1)) {
      return result.item();
    }
    return result;
  }
  return Number.isNaN(value);
}

/**
 * Python-style isinf that works on both scalars and arrays.
 */
export function pyIsInf(mx: any, value: unknown): boolean | any {
  if (isMLXArrayCheck(value)) {
    const result = mx.isinf(value);
    const shape = result.shape;
    if (shape.length === 0 || (shape.length === 1 && shape[0] === 1)) {
      return result.item();
    }
    return result;
  }
  return !Number.isFinite(value) && !Number.isNaN(value);
}

/**
 * Python-style bool() conversion for arrays.
 *
 * In Python, bool(array) returns True if the single element is truthy.
 * Raises error for multi-element arrays.
 */
export function pyBool(mx: any, value: unknown): boolean {
  if (isMLXArrayCheck(value)) {
    const arr = value as any;
    const size = arr.shape.reduce((a: number, b: number) => a * b, 1);
    if (size !== 1) {
      throw new Error('The truth value of an array with more than one element is ambiguous');
    }
    return Boolean(arr.item());
  }
  return Boolean(value);
}

/**
 * Python-style len() for arrays.
 *
 * Returns the length of the first dimension.
 */
export function pyLen(value: unknown): number {
  if (isMLXArrayCheck(value)) {
    const arr = value as any;
    if (arr.shape.length === 0) {
      throw new Error('len() of unsized object');
    }
    return arr.shape[0];
  }
  if (Array.isArray(value) || typeof value === 'string') {
    return value.length;
  }
  throw new Error('object has no len()');
}

/**
 * Python-style iteration over arrays.
 *
 * Yields slices along the first axis.
 */
export function* pyIter(mx: any, value: unknown): Generator<any> {
  if (isMLXArrayCheck(value)) {
    const arr = value as any;
    const len = arr.shape[0] || 0;
    for (let i = 0; i < len; i++) {
      const slice = mx.take(arr, new mx.array([i], 'int32'), 0);
      yield mx.squeeze(slice, 0);
    }
  } else if (Array.isArray(value)) {
    yield* value;
  } else {
    throw new Error('object is not iterable');
  }
}

/**
 * Python-style enumerate() function.
 *
 * Returns an iterator of [index, element] tuples over an iterable,
 * including MLX arrays.
 *
 * @param mx - The MLX module
 * @param value - The iterable to enumerate (array or MLX array)
 * @returns Generator yielding [index, element] pairs
 */
export function* pyEnumerate(mx: any, value: unknown): Generator<[number, any]> {
  let i = 0;
  for (const item of pyIter(mx, value)) {
    yield [i, item];
    i++;
  }
}

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
 * Python-style equality comparison.
 *
 * In Python, comparing an MLX array to a list/tuple using == returns False
 * because they are different types. This function replicates that behavior.
 *
 * Behavior:
 * - Array to Array: Returns MLX array (element-wise comparison via mx.equal)
 * - Array to scalar (number): Returns MLX array (broadcasting via mx.equal)
 * - Array to JS array/list: Returns false (type mismatch, Python semantics)
 * - Other cases: JavaScript equality
 *
 * @param mx - The MLX module
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns For array comparisons: MLX array of booleans. Otherwise: boolean.
 *
 * @example
 * pyCompare(mx, mx.array([1,2,3]), [1,2,3]) // false (different types)
 * pyCompare(mx, mx.array([1,2,3]), mx.array([1,2,3])) // MLX array [true, true, true]
 * pyCompare(mx, mx.array([1,2,3]), 1) // MLX array [true, false, false]
 */
export function pyCompare(mx: any, a: unknown, b: unknown): any {
  const aIsArray = isMLXArrayCheck(a);
  const bIsArray = isMLXArrayCheck(b);
  const aIsJSArray = Array.isArray(a);
  const bIsJSArray = Array.isArray(b);

  // If one is an MLX array and the other is a JS array, return false (type mismatch)
  if ((aIsArray && bIsJSArray) || (bIsArray && aIsJSArray)) {
    return false;
  }

  // If at least one is an MLX array (and the other is not a JS array), use mx.equal
  // This handles array-to-array and array-to-scalar (broadcasting)
  if (aIsArray || bIsArray) {
    return mx.equal(a, b);
  }

  // For JS arrays
  if (aIsJSArray && bIsJSArray) {
    if ((a as unknown[]).length !== (b as unknown[]).length) return false;
    return (a as unknown[]).every((val, i) => val === (b as unknown[])[i]);
  }

  return a === b;
}

/**
 * Python-style inequality comparison.
 *
 * In Python, comparing an MLX array to a list/tuple using != returns True
 * because they are different types. This function replicates that behavior.
 *
 * Behavior:
 * - Array to Array: Returns MLX array (element-wise comparison via mx.not_equal)
 * - Array to scalar (number): Returns MLX array (broadcasting via mx.not_equal)
 * - Array to JS array/list: Returns true (type mismatch, Python semantics)
 * - Other cases: JavaScript inequality
 *
 * @param mx - The MLX module
 * @param a - First value to compare
 * @param b - Second value to compare
 * @returns For array comparisons: MLX array of booleans. Otherwise: boolean.
 */
export function pyNotEqual(mx: any, a: unknown, b: unknown): any {
  const aIsArray = isMLXArrayCheck(a);
  const bIsArray = isMLXArrayCheck(b);
  const aIsJSArray = Array.isArray(a);
  const bIsJSArray = Array.isArray(b);

  // If one is an MLX array and the other is a JS array, return true (type mismatch)
  if ((aIsArray && bIsJSArray) || (bIsArray && aIsJSArray)) {
    return true;
  }

  // If at least one is an MLX array (and the other is not a JS array), use mx.not_equal
  // This handles array-to-array and array-to-scalar (broadcasting)
  if (aIsArray || bIsArray) {
    return mx.not_equal(a, b);
  }

  // For JS arrays
  if (aIsJSArray && bIsJSArray) {
    if ((a as unknown[]).length !== (b as unknown[]).length) return true;
    return !(a as unknown[]).every((val, i) => val === (b as unknown[])[i]);
  }

  return a !== b;
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

  if (s === 'None' || s === 'null' || s === 'mx.newaxis') {
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
  // Handle plain JavaScript arrays/strings by using native slice
  if (Array.isArray(a) || typeof a === 'string') {
    const specs = parseSliceExpr(sliceExpr);
    if (specs.length === 1 && specs[0].type === 'slice') {
      const spec = specs[0];
      const len = a.length;
      let start = spec.start ?? 0;
      let stop = spec.stop ?? len;
      const step = spec.step ?? 1;

      // Handle negative indices
      if (start < 0) start = len + start;
      if (stop < 0) stop = len + stop;

      if (step === 1) {
        return typeof a === 'string' ? a.slice(start, stop) : a.slice(start, stop);
      } else {
        const result: any[] = [];
        if (step > 0) {
          for (let i = start; i < stop; i += step) {
            result.push(a[i]);
          }
        } else {
          const actualStart = spec.start ?? len - 1;
          const actualStop = spec.stop ?? -1;
          for (let i = actualStart; i > actualStop; i += step) {
            if (i >= 0 && i < len) result.push(a[i]);
          }
        }
        return typeof a === 'string' ? result.join('') : result;
      }
    }
    throw new Error(`pySlice: Unsupported slice expression for JS array/string: ${sliceExpr}`);
  }

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
      return mx.slice(a, new mx.array([start], 'int32'), [0], [sliceSize]);
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
      return mx.take(a, new mx.array(indices, 'int32'), 0);
    }
  }

  // Handle single index (not slice)
  if (specs.length === 1 && specs[0].type === 'index') {
    const taken = mx.take(a, new mx.array([specs[0].index!], 'int32'), 0);
    return mx.squeeze(taken, 0);
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
      const taken = mx.take(result, new mx.array([spec.index!], 'int32'), axis);
      result = mx.squeeze(taken, axis);
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
        result = mx.slice(result, new mx.array(startIndices), axes, sliceSize);
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
        result = mx.take(result, new mx.array(indices, 'int32'), axis);
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
 * // Python: a[:, 0] = new mx.array([1, 2, 3])
 * pySliceUpdate(mx, a, ':, 0', new mx.array([1, 2, 3]))
 */
export function pySliceUpdate(mx: any, a: any, sliceExpr: string, value: any): any {
  const specs = parseSliceExpr(sliceExpr);
  const shape: number[] = a.shape;

  // Convert value to array if needed
  const updateValue = typeof value === 'number' || typeof value === 'boolean'
    ? new mx.array(value)
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
    const startIndices = new mx.array([start], 'int32');
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

    const startIndices = new mx.array([actualIdx], 'int32');
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

  return mx.slice_update(a, broadcastedUpdate, new mx.array(startIndices), axes);
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
/**
 * Create a complex array from real and imaginary components.
 *
 * JavaScript doesn't have native complex numbers, so this utility creates
 * MLX complex64 arrays by interleaving float32 values and using view().
 *
 * @param mx - The MLX module
 * @param real - Real component (scalar or array)
 * @param imag - Imaginary component (scalar or array)
 * @returns A complex64 array
 *
 * @example
 * // Create 1+2j
 * makeComplex(mx, 1, 2)
 *
 * // Create [1+2j, 3+4j]
 * makeComplex(mx, [1, 3], [2, 4])
 *
 * // Create complex from r + 1j*i
 * makeComplex(mx, r, i)
 */
export function makeComplex(mx: any, real: any, imag: any): any {
  // Convert to float32 arrays
  const r = ensureFloat32(mx, real);
  const i = ensureFloat32(mx, imag);

  // Get the shape
  const shape: number[] = r.shape;

  // Handle scalar case
  if (shape.length === 0 || (shape.length === 1 && shape[0] === 1)) {
    // For scalars, create [real, imag] and view as complex
    const pair = mx.stack([r, i], { axis: 0 });
    return mx.view(pair, 'complex64');
  }

  // Flatten both arrays
  const rFlat = mx.flatten(r);
  const iFlat = mx.flatten(i);

  // Stack to create [..., 2] shape then flatten to interleave
  // [r0, r1, ...] + [i0, i1, ...] -> [[r0, i0], [r1, i1], ...] -> [r0, i0, r1, i1, ...]
  const stacked = mx.stack([rFlat, iFlat], { axis: 1 });
  const interleaved = mx.flatten(stacked);

  // View as complex64
  const complexFlat = mx.view(interleaved, 'complex64');

  // Reshape back to original shape
  return mx.reshape(complexFlat, shape);
}

/**
 * Helper to ensure value is a float32 array
 */
function ensureFloat32(mx: any, value: any): any {
  if (typeof value === 'number') {
    return new mx.array(value, 'float32');
  }
  if (Array.isArray(value)) {
    return new mx.array(value, 'float32');
  }
  // Assume it's already an array, cast to float32
  return value.astype('float32');
}

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
    const current = this.mx.take(this.a, new this.mx.array([actualIdx], 'int32'), 0);

    // Apply operation
    const updated = op(current, value);

    // Put back using slice_update
    const startIndices = new this.mx.array([actualIdx], 'int32');
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

/**
 * Python-style zip function.
 *
 * Takes multiple iterables and returns an iterator of tuples,
 * where the i-th tuple contains the i-th element from each input.
 *
 * @param arrays - Arrays to zip together
 * @returns Array of tuples (represented as arrays)
 *
 * @example
 * pyZip([1, 2, 3], ['a', 'b', 'c']) // [[1, 'a'], [2, 'b'], [3, 'c']]
 */
export function pyZip(...arrays: any[][]): any[][] {
  if (arrays.length === 0) return [];
  const minLen = Math.min(...arrays.map(a => a.length));
  const result: any[][] = [];
  for (let i = 0; i < minLen; i++) {
    result.push(arrays.map(a => a[i]));
  }
  return result;
}

/**
 * Python-style itertools.product function.
 *
 * Generates Cartesian product of input iterables.
 *
 * @param arrays - Arrays to compute product of
 * @returns Array of tuples (represented as arrays)
 *
 * @example
 * pyProduct([1, 2], ['a', 'b']) // [[1, 'a'], [1, 'b'], [2, 'a'], [2, 'b']]
 */
export function pyProduct(...arrays: any[][]): any[][] {
  if (arrays.length === 0) return [[]];
  const result: any[][] = [];

  function helper(index: number, current: any[]) {
    if (index === arrays.length) {
      result.push([...current]);
      return;
    }
    for (const item of arrays[index]) {
      current.push(item);
      helper(index + 1, current);
      current.pop();
    }
  }

  helper(0, []);
  return result;
}

/**
 * Python-style itertools.permutations function.
 *
 * Generates all permutations of an iterable.
 *
 * @param arr - Array to permute
 * @param r - Length of permutations (default: arr.length)
 * @returns Array of permutation tuples
 *
 * @example
 * pyPermutations([1, 2, 3]) // [[1,2,3], [1,3,2], [2,1,3], [2,3,1], [3,1,2], [3,2,1]]
 * pyPermutations([1, 2, 3], 2) // [[1,2], [1,3], [2,1], [2,3], [3,1], [3,2]]
 */
export function pyPermutations(arr: any[], r?: number): any[][] {
  const n = arr.length;
  r = r ?? n;

  if (r > n) return [];
  if (r === 0) return [[]];

  const result: any[][] = [];

  function helper(current: any[], remaining: any[]) {
    if (current.length === r) {
      result.push([...current]);
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      current.push(remaining[i]);
      helper(current, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
      current.pop();
    }
  }

  helper([], arr);
  return result;
}

/**
 * Python-style itertools.combinations function.
 *
 * Generates all combinations of an iterable.
 *
 * @param arr - Array to generate combinations from
 * @param r - Length of combinations
 * @returns Array of combination tuples
 *
 * @example
 * pyCombinations([1, 2, 3], 2) // [[1, 2], [1, 3], [2, 3]]
 */
export function pyCombinations(arr: any[], r: number): any[][] {
  const n = arr.length;
  if (r > n) return [];
  if (r === 0) return [[]];

  const result: any[][] = [];

  function helper(start: number, current: any[]) {
    if (current.length === r) {
      result.push([...current]);
      return;
    }
    for (let i = start; i < n; i++) {
      current.push(arr[i]);
      helper(i + 1, current);
      current.pop();
    }
  }

  helper(0, []);
  return result;
}
