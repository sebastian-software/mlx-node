/**
 * Tests for LLM utility functions
 *
 * These functions are designed to support LLM inference patterns
 * like GQA (Grouped Query Attention) and KV caching.
 */

import { describe, it, expect } from 'vitest';
import mx from '../dist/index.js';

describe('fast namespace', () => {
  it('fast namespace exists', () => {
    expect(mx.fast).toBeDefined();
  });

  it('fast operations are available as functions', () => {
    expect(typeof mx.fast.rmsNorm).toBe('function');
    expect(typeof mx.fast.rope).toBe('function');
    expect(typeof mx.fast.scaledDotProductAttention).toBe('function');
  });

  it('rmsNorm normalizes correctly', () => {
    const x = new mx.array([[1.0, 2.0, 3.0], [4.0, 5.0, 6.0]]);
    const result = mx.fast.rmsNorm(x, null, 1e-5) as { shape: number[] };
    expect(result.shape).toEqual([2, 3]);
  });

  it('rmsNorm with weight parameter', () => {
    const x = new mx.array([[1.0, 2.0, 3.0]]);
    const weight = new mx.array([1.0, 1.0, 1.0]);
    const result = mx.fast.rmsNorm(x, weight, 1e-5) as { shape: number[] };
    expect(result.shape).toEqual([1, 3]);
  });

  it('rope applies rotary position embedding', () => {
    // Create 3D input: (batch, seq, dims) where dims must be even
    const x = new mx.array(Array(128).fill(1.0)).reshape([1, 4, 32]) as unknown as Parameters<typeof mx.fast.rope>[0];
    const result = mx.fast.rope(x, 32, false, 10000.0, 1.0, 0) as { shape: number[] };
    expect(result.shape).toEqual([1, 4, 32]);
  });

  it('scaledDotProductAttention computes attention', () => {
    // Create 4D inputs: (batch, seq, heads, dim)
    const q = new mx.array(Array(64).fill(1.0)).reshape([1, 4, 2, 8]) as unknown as Parameters<typeof mx.fast.scaledDotProductAttention>[0];
    const k = new mx.array(Array(64).fill(1.0)).reshape([1, 4, 2, 8]) as unknown as Parameters<typeof mx.fast.scaledDotProductAttention>[1];
    const v = new mx.array(Array(64).fill(1.0)).reshape([1, 4, 2, 8]) as unknown as Parameters<typeof mx.fast.scaledDotProductAttention>[2];
    const scale = 1.0 / Math.sqrt(8);
    const result = mx.fast.scaledDotProductAttention(q, k, v, scale) as { shape: number[] };
    expect(result.shape).toEqual([1, 4, 2, 8]);
  });
});

describe('repeat_interleave', () => {
  it('repeats elements along axis 0 for 1D array', () => {
    // [1, 2, 3] with repeats=2 -> [1, 1, 2, 2, 3, 3]
    const a = new mx.array([1, 2, 3]);
    const result = mx.repeat_interleave(a, 2, 0) as { shape: number[]; tolist: () => number[] };
    expect(result.shape).toEqual([6]);
    expect(result.tolist()).toEqual([1, 1, 2, 2, 3, 3]);
  });

  it('repeats elements along axis 0 for 2D array', () => {
    // [[1, 2], [3, 4]] with repeats=2 along axis=0
    // -> [[1, 2], [1, 2], [3, 4], [3, 4]]
    const a = new mx.array([[1, 2], [3, 4]]);
    const result = mx.repeat_interleave(a, 2, 0) as { shape: number[] };
    expect(result.shape).toEqual([4, 2]);
  });

  it('repeats elements along axis 1 for 2D array', () => {
    const a = new mx.array([[1, 2], [3, 4]]);
    const result = mx.repeat_interleave(a, 3, 1) as { shape: number[] };
    expect(result.shape).toEqual([2, 6]);
  });

  it('works with negative axis', () => {
    const a = new mx.array([[1, 2], [3, 4]]);
    const result = mx.repeat_interleave(a, 3, -1) as { shape: number[] };
    expect(result.shape).toEqual([2, 6]);
  });

  it('handles 4D tensors for GQA', () => {
    // Typical GQA pattern: expand KV heads
    // (batch, seq, kv_heads, dim) -> (batch, seq, q_heads, dim)
    const kv = mx.ones([2, 8, 2, 64]); // 2 KV heads
    const result = mx.repeat_interleave(kv, 4, 2) as { shape: number[] }; // 4x repeat -> 8 heads
    expect(result.shape).toEqual([2, 8, 8, 64]);
  });

  it('throws on invalid axis', () => {
    const a = new mx.array([1, 2, 3]);
    expect(() => mx.repeat_interleave(a, 2, 5)).toThrow();
  });
});

describe('take_last', () => {
  it('takes last element along axis 0', () => {
    const a = new mx.array([[1, 2], [3, 4], [5, 6]]);
    const result = mx.take_last(a, 0) as { shape: number[]; tolist: () => number[] };
    expect(result.shape).toEqual([2]);
    expect(result.tolist()).toEqual([5, 6]);
  });

  it('takes last element along axis 1', () => {
    const a = new mx.array([[1, 2, 3], [4, 5, 6]]);
    const result = mx.take_last(a, 1) as { shape: number[] };
    expect(result.shape).toEqual([2]);
    // Note: tolist() has a bug with non-contiguous arrays, verify via slice
    expect(mx.slice(result, [0], [1]).item()).toBe(3);
    expect(mx.slice(result, [1], [2]).item()).toBe(6);
  });

  it('works with negative axis', () => {
    const a = new mx.array([[1, 2, 3], [4, 5, 6]]);
    const result = mx.take_last(a, -1) as { shape: number[] }; // same as axis=1
    expect(result.shape).toEqual([2]);
    // Note: tolist() has a bug with non-contiguous arrays, verify via slice
    expect(mx.slice(result, [0], [1]).item()).toBe(3);
    expect(mx.slice(result, [1], [2]).item()).toBe(6);
  });

  it('preserves dims with keepdims=true', () => {
    const a = new mx.array([[1, 2, 3], [4, 5, 6]]);
    const result = mx.take_last(a, 1, true) as { shape: number[] };
    expect(result.shape).toEqual([2, 1]);
  });

  it('handles 3D tensors (logits pattern)', () => {
    // Typical pattern: logits (batch, seq, vocab) -> last position
    const logits = mx.ones([2, 10, 100]);
    const result = mx.take_last(logits, 1) as { shape: number[] };
    expect(result.shape).toEqual([2, 100]);
  });

  it('throws on invalid axis', () => {
    const a = new mx.array([1, 2, 3]);
    expect(() => mx.take_last(a, 5)).toThrow();
  });
});

describe('slice_axis', () => {
  it('slices from start to end', () => {
    const a = new mx.array([0, 1, 2, 3, 4, 5]);
    const result = mx.slice_axis(a, 0, 1, 4) as { shape: number[]; tolist: () => number[] };
    expect(result.shape).toEqual([3]);
    expect(result.tolist()).toEqual([1, 2, 3]);
  });

  it('slices with start=0', () => {
    const a = new mx.array([0, 1, 2, 3, 4, 5]);
    const result = mx.slice_axis(a, 0, 0, 3) as { shape: number[]; tolist: () => number[] };
    expect(result.shape).toEqual([3]);
    expect(result.tolist()).toEqual([0, 1, 2]);
  });

  it('slices to end of axis', () => {
    const a = new mx.array([0, 1, 2, 3, 4, 5]);
    const result = mx.slice_axis(a, 0, 3) as { shape: number[]; tolist: () => number[] };
    expect(result.shape).toEqual([3]);
    expect(result.tolist()).toEqual([3, 4, 5]);
  });

  it('handles negative start index', () => {
    const a = new mx.array([0, 1, 2, 3, 4, 5]);
    const result = mx.slice_axis(a, 0, -3) as { shape: number[]; tolist: () => number[] };
    expect(result.shape).toEqual([3]);
    expect(result.tolist()).toEqual([3, 4, 5]);
  });

  it('handles negative end index', () => {
    const a = new mx.array([0, 1, 2, 3, 4, 5]);
    const result = mx.slice_axis(a, 0, 0, -2) as { shape: number[]; tolist: () => number[] };
    expect(result.shape).toEqual([4]);
    expect(result.tolist()).toEqual([0, 1, 2, 3]);
  });

  it('slices 2D array along axis 0', () => {
    const a = new mx.array([[0, 1], [2, 3], [4, 5], [6, 7]]);
    const result = mx.slice_axis(a, 0, 1, 3) as { shape: number[] };
    expect(result.shape).toEqual([2, 2]);
  });

  it('slices 2D array along axis 1', () => {
    const a = new mx.array([[0, 1, 2, 3], [4, 5, 6, 7]]);
    const result = mx.slice_axis(a, 1, 1, 3) as { shape: number[] };
    expect(result.shape).toEqual([2, 2]);
  });

  it('handles 4D tensors (KV cache pattern)', () => {
    // KV cache: (batch, seq, heads, dim)
    const cache = mx.ones([2, 100, 4, 64]);
    // Get first 50 tokens
    const result = mx.slice_axis(cache, 1, 0, 50) as { shape: number[] };
    expect(result.shape).toEqual([2, 50, 4, 64]);
  });

  it('handles negative axis', () => {
    const a = new mx.array([[0, 1, 2], [3, 4, 5]]);
    const result = mx.slice_axis(a, -1, 0, 2) as { shape: number[] };
    expect(result.shape).toEqual([2, 2]);
  });

  it('throws on empty slice', () => {
    const a = new mx.array([0, 1, 2, 3, 4, 5]);
    expect(() => mx.slice_axis(a, 0, 3, 3)).toThrow();
  });

  it('throws on invalid axis', () => {
    const a = new mx.array([1, 2, 3]);
    expect(() => mx.slice_axis(a, 5, 0, 1)).toThrow();
  });
});
