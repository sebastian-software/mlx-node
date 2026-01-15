import { describe, it, expect } from 'vitest';
import mx from '../dist/index.js';

describe('Ops', () => {
  it('add arrays', () => {
    const x = new mx.array([1, 2, 3]);
    const y = new mx.array([4, 5, 6]);
    const z = mx.add(x, y);
    expect(z.tolist()).toEqual([5, 7, 9]);
  });

  it('add scalar', () => {
    const x = new mx.array([1, 2, 3]);
    const z = mx.add(x, 10);
    expect(z.tolist()).toEqual([11, 12, 13]);
  });

  it('add with dtype', () => {
    const x = new mx.array([1, 2, 3], { dtype: 'float32' });
    const y = new mx.array([0.5, 0.5, 0.5], { dtype: 'float32' });
    const z = mx.add(x, y);
    expect(z.dtype).toBe('float32');
    expect(z.tolist()).toEqual([1.5, 2.5, 3.5]);
  });
});
