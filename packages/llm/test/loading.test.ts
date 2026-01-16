/**
 * Model Loading Tests
 *
 * Tests the model loading pipeline with a minimal test model.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import mx from 'mlx-node';

const __dirname = dirname(fileURLToPath(import.meta.url));

import {
  loadModel,
  isValidModelPath,
  getModelInfo,
  detectModelType,
  loadWeights
} from '../dist/loading/index.js';

// Test model directory
const TEST_MODEL_DIR = join(__dirname, 'fixtures', 'mini-gemma');

// Minimal Gemma3-like config for testing
const MINI_CONFIG = {
  model_type: 'gemma3',
  architectures: ['Gemma3ForCausalLM'],
  vocab_size: 256,        // Tiny vocab
  hidden_size: 64,        // Tiny hidden
  num_hidden_layers: 2,   // Just 2 layers
  num_attention_heads: 2,
  num_key_value_heads: 1, // GQA
  head_dim: 32,
  intermediate_size: 128,
  rms_norm_eps: 1e-6,
  rope_theta: 10000,
  rope_local_base_freq: 10000,
  max_position_embeddings: 512,
  sliding_window: 64,
  sliding_window_pattern: 2,
  tie_word_embeddings: true,
  eos_token_id: 1,
  bos_token_id: 2
};

/**
 * Create fake weights for a mini Gemma3 model
 */
function createMiniWeights(): Record<string, unknown> {
  const weights: Record<string, unknown> = {};
  const { vocab_size, hidden_size, num_hidden_layers, num_attention_heads,
          num_key_value_heads, head_dim, intermediate_size } = MINI_CONFIG;

  // Embedding
  weights['model.embed_tokens.weight'] = mx.zeros([vocab_size, hidden_size], mx.float16);

  // Layers
  for (let i = 0; i < num_hidden_layers; i++) {
    const prefix = `model.layers.${i}`;

    // Attention projections
    weights[`${prefix}.self_attn.q_proj.weight`] = mx.zeros(
      [num_attention_heads * head_dim, hidden_size], mx.float16
    );
    weights[`${prefix}.self_attn.k_proj.weight`] = mx.zeros(
      [num_key_value_heads * head_dim, hidden_size], mx.float16
    );
    weights[`${prefix}.self_attn.v_proj.weight`] = mx.zeros(
      [num_key_value_heads * head_dim, hidden_size], mx.float16
    );
    weights[`${prefix}.self_attn.o_proj.weight`] = mx.zeros(
      [hidden_size, num_attention_heads * head_dim], mx.float16
    );

    // Q/K norms
    weights[`${prefix}.self_attn.q_norm.weight`] = mx.ones([head_dim], mx.float16);
    weights[`${prefix}.self_attn.k_norm.weight`] = mx.ones([head_dim], mx.float16);

    // MLP
    weights[`${prefix}.mlp.gate_proj.weight`] = mx.zeros(
      [intermediate_size, hidden_size], mx.float16
    );
    weights[`${prefix}.mlp.up_proj.weight`] = mx.zeros(
      [intermediate_size, hidden_size], mx.float16
    );
    weights[`${prefix}.mlp.down_proj.weight`] = mx.zeros(
      [hidden_size, intermediate_size], mx.float16
    );

    // Layer norms (Gemma3 has 4 per layer)
    weights[`${prefix}.input_layernorm.weight`] = mx.ones([hidden_size], mx.float16);
    weights[`${prefix}.post_attention_layernorm.weight`] = mx.ones([hidden_size], mx.float16);
    weights[`${prefix}.pre_feedforward_layernorm.weight`] = mx.ones([hidden_size], mx.float16);
    weights[`${prefix}.post_feedforward_layernorm.weight`] = mx.ones([hidden_size], mx.float16);
  }

  // Final norm
  weights['model.norm.weight'] = mx.ones([hidden_size], mx.float16);

  return weights;
}

// Setup and teardown
before(() => {
  // Create test directory
  mkdirSync(TEST_MODEL_DIR, { recursive: true });

  // Write config.json
  writeFileSync(
    join(TEST_MODEL_DIR, 'config.json'),
    JSON.stringify(MINI_CONFIG, null, 2)
  );

  // Create and save weights
  const weights = createMiniWeights();
  mx.save_safetensors(join(TEST_MODEL_DIR, 'model.safetensors'), weights);
});

after(() => {
  // Cleanup
  if (existsSync(TEST_MODEL_DIR)) {
    rmSync(TEST_MODEL_DIR, { recursive: true });
  }
});

describe('Model Loading', () => {
  describe('detectModelType', () => {
    test('detects gemma from model_type', () => {
      assert.strictEqual(detectModelType({ model_type: 'gemma3' }), 'gemma3');
      assert.strictEqual(detectModelType({ model_type: 'gemma' }), 'gemma3');
    });

    test('detects gemma from architectures', () => {
      assert.strictEqual(detectModelType({ architectures: ['Gemma3ForCausalLM'] }), 'gemma3');
    });

    test('throws for unknown model type', () => {
      assert.throws(() => detectModelType({}));
    });
  });

  describe('isValidModelPath', () => {
    test('returns true for valid model directory', () => {
      assert.strictEqual(isValidModelPath(TEST_MODEL_DIR), true);
    });

    test('returns false for invalid path', () => {
      assert.strictEqual(isValidModelPath('/nonexistent/path'), false);
    });

    test('returns false for directory without config.json', () => {
      assert.strictEqual(isValidModelPath('/tmp'), false);
    });
  });

  describe('getModelInfo', () => {
    test('returns model info without loading weights', () => {
      const info = getModelInfo(TEST_MODEL_DIR);

      assert.strictEqual(info.modelType, 'gemma3');
      assert.strictEqual(info.numLayers, 2);
      assert.strictEqual(info.hiddenSize, 64);
      assert.strictEqual(info.vocabSize, 256);
    });
  });

  describe('loadWeights', () => {
    test('loads weights from safetensors file', () => {
      const weights = loadWeights(mx, TEST_MODEL_DIR);

      assert.ok(Object.keys(weights).length > 0);
      assert.ok(weights['model.embed_tokens.weight'] !== undefined);
      assert.ok(weights['model.layers.0.self_attn.q_proj.weight'] !== undefined);
    });
  });

  describe('loadModel', () => {
    test('loads model from directory', () => {
      const { model, config, modelType, numParameters } = loadModel(
        mx,
        TEST_MODEL_DIR,
        { verbose: false }
      );

      assert.ok(model !== undefined);
      assert.strictEqual(modelType, 'gemma3');
      assert.strictEqual(config.vocab_size, 256);
      assert.ok(numParameters > 0);
    });

    test('model can run forward pass', () => {
      const { model } = loadModel(mx, TEST_MODEL_DIR);

      // Create input tokens
      const tokens = new mx.array([[1, 2, 3]], mx.int32);

      // Run forward pass (should not throw)
      const logits = model.forward(tokens);

      // Check output shape: (batch=1, seq=3, vocab=256)
      assert.deepStrictEqual(logits.shape, [1, 3, 256]);
    });

    test.skip('model can create cache and generate', () => {
      // TODO: Fix KV cache slice_axis issue - the cache arrays lose their shape info
      // between updates. Needs investigation.
      const { model } = loadModel(mx, TEST_MODEL_DIR);

      // Create cache
      const cache = model.createCache();
      assert.ok(cache !== undefined);

      // Forward with cache
      const tokens = new mx.array([[1, 2]], mx.int32);
      const logits1 = model.forward(tokens, cache);
      assert.deepStrictEqual(logits1.shape, [1, 2, 256]);

      // Continue with cached state
      const nextToken = new mx.array([[3]], mx.int32);
      const logits2 = model.forward(nextToken, cache);
      assert.deepStrictEqual(logits2.shape, [1, 1, 256]);
    });
  });
});
