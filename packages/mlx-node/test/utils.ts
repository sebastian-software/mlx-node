/**
 * Test utilities for MLX Node.js tests
 */

import { expect } from 'vitest';

/**
 * Check if two arrays are close (element-wise within tolerance)
 */
export function allClose(
  mx: any,
  a: any,
  b: any,
  rtol = 1e-5,
  atol = 1e-8
): boolean {
  return mx.allclose(a, b, { rtol, atol }).item();
}

/**
 * Assert two arrays are close
 */
export function expectAllClose(
  mx: any,
  actual: any,
  expected: any,
  rtol = 1e-5,
  atol = 1e-8
): void {
  expect(allClose(mx, actual, expected, rtol, atol)).toBe(true);
}

/**
 * Assert two arrays are exactly equal
 */
export function expectArrayEqual(mx: any, actual: any, expected: any): void {
  expect(mx.array_equal(actual, expected).item()).toBe(true);
}

/**
 * Check if value is an MLX array
 */
export function isMLXArray(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === 'object' &&
    'dtype' in value &&
    'shape' in value &&
    'tolist' in value
  );
}
