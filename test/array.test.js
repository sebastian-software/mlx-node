/**
 * MLX Array Tests
 *
 * Tests for the MLXArray class and type conversions.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load native module
let mlx;
try {
  mlx = require(join(__dirname, '..', 'build', 'Release', 'mlx_node.node'));
} catch (e) {
  console.error('Native module not found. Run `npm run build:native` first.');
  process.exit(1);
}

describe('MLXArray', () => {
  test('should create array from JavaScript array', () => {
    const arr = new mlx.array([1, 2, 3, 4, 5]);
    assert.strictEqual(arr.size, 5);
    assert.strictEqual(arr.dtype, 'float32');
  });

  test('should create array from single number', () => {
    const arr = new mlx.array(42);
    assert.strictEqual(arr.size, 1);
    assert.strictEqual(arr.item(), 42);
  });

  test('should convert to JavaScript array via tolist()', () => {
    const input = [1, 2, 3, 4, 5];
    const arr = new mlx.array(input);
    const output = arr.tolist();

    assert.strictEqual(output.length, input.length);
    for (let i = 0; i < input.length; i++) {
      assert.strictEqual(output[i], input[i]);
    }
  });

  test('should have correct shape', () => {
    const arr = new mlx.array([1, 2, 3]);
    const shape = arr.shape;

    assert.ok(Array.isArray(shape));
    assert.ok(shape.includes(3));
  });

  test('should report ndim correctly', () => {
    const arr = new mlx.array([1, 2, 3]);
    assert.ok(arr.ndim >= 1);
  });
});

describe('Dtype Constants', () => {
  test('should have all dtype constants', () => {
    const expectedDtypes = [
      'bool', 'uint8', 'uint16', 'uint32', 'uint64',
      'int8', 'int16', 'int32', 'int64',
      'float16', 'float32', 'float64', 'bfloat16', 'complex64'
    ];

    for (const dtype of expectedDtypes) {
      assert.ok(mlx[dtype] !== undefined, `Missing dtype: ${dtype}`);
    }
  });

  test('dtype constants should be strings', () => {
    assert.strictEqual(typeof mlx.float32, 'string');
    assert.strictEqual(mlx.float32, 'float32');
  });
});

describe('Module Info', () => {
  test('should have version string', () => {
    assert.ok(mlx.__version__);
    assert.strictEqual(typeof mlx.__version__, 'string');
  });

  test('should indicate MLX availability', () => {
    assert.strictEqual(typeof mlx.__mlx_available__, 'boolean');
    // In stub mode, this should be false
    console.log(`  MLX available: ${mlx.__mlx_available__}`);
  });
});

describe('Stub Functions', () => {
  test('add should exist', () => {
    assert.strictEqual(typeof mlx.add, 'function');
  });

  test('multiply should exist', () => {
    assert.strictEqual(typeof mlx.multiply, 'function');
  });

  test('zeros should exist', () => {
    assert.strictEqual(typeof mlx.zeros, 'function');
  });

  test('ones should exist', () => {
    assert.strictEqual(typeof mlx.ones, 'function');
  });
});
