import { describe, it, expect } from 'vitest';
import mx from '../dist/index.js';

describe('Ops', () => {
  it('add', () => {
    let x = new mx.array(1);
    let y = new mx.array(1);
    let z = mx.add(x, y);
    expect(z.item()).toBe(2);
  
    x = new mx.array(false, 'bool');
    z = mx.add(x, 1);
    expect(z.dtype).toBe('int32');
    expect(z.item()).toBe(1);
  
    z = mx.add(2, x);
    expect(z.dtype).toBe('int32');
    expect(z.item()).toBe(2);
  
    x = new mx.array(1, 'uint32');
    z = mx.add(x, 3);
    expect(z.dtype).toBe('uint32');
    expect(z.item()).toBe(4);
  
    z = mx.add(3, x);
    expect(z.dtype).toBe('uint32');
    expect(z.item()).toBe(4);
  
    z = mx.add(x, 3.0);
    expect(z.dtype).toBe('float32');
    expect(z.item()).toBe(4.0);
  
    z = mx.add(3.0, x);
    expect(z.dtype).toBe('float32');
    expect(z.item()).toBe(4.0);
  
    x = new mx.array(1, 'int64');
    z = mx.add(x, 3);
    expect(z.dtype).toBe('int64');
    expect(z.item()).toBe(4);
  
    z = mx.add(3, x);
    expect(z.dtype).toBe('int64');
    expect(z.item()).toBe(4);
  
    z = mx.add(x, 3.0);
    expect(z.dtype).toBe('float32');
    expect(z.item()).toBe(4.0);
  
    z = mx.add(3.0, x);
    expect(z.dtype).toBe('float32');
    expect(z.item()).toBe(4.0);
  
    x = new mx.array(1, 'float32');
    z = mx.add(x, 3);
    expect(z.dtype).toBe('float32');
    expect(z.item()).toBe(4);
  
    z = mx.add(3, x);
    expect(z.dtype).toBe('float32');
    expect(z.item()).toBe(4);
  
  });

});
