/**
 * Real Model Loading Tests
 *
 * Tests loading real HuggingFace models from cache.
 * These tests require models to be downloaded first.
 */

import { describe, test, before, after } from 'node:test';
import assert from 'node:assert';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import mx from 'mlx-node';

import {
  detectModelType,
  parseGemma3Config,
  getQuantizationConfig,
  isMultimodalConfig,
  getTextConfig
} from '../dist/loading/config.js';
import {
  loadWeights,
  detectWeightPrefix,
  remapWeightKeys
} from '../dist/loading/weights.js';
import { getModelInfo } from '../dist/loading/index.js';

// HuggingFace cache location
const HF_CACHE = join(process.env.HOME!, '.cache/huggingface/hub');

/**
 * Get the snapshot path for a model in the HuggingFace cache
 */
function getModelPath(modelName: string): string | null {
  const modelDir = join(HF_CACHE, `models--${modelName.replace(/\//g, '--')}`);
  if (!existsSync(modelDir)) {
    return null;
  }

  const snapshotsDir = join(modelDir, 'snapshots');
  if (!existsSync(snapshotsDir)) {
    return null;
  }

  const snapshots = readdirSync(snapshotsDir);
  if (snapshots.length === 0) {
    return null;
  }

  return join(snapshotsDir, snapshots[0]);
}

describe('Real Model Tests', () => {
  const gemmaModelPath = getModelPath('mlx-community/gemma-3-text-4b-it-4bit');

  describe('Config Parsing', () => {
    test('parses multimodal Gemma config with nested text_config', async (t) => {
      if (!gemmaModelPath) {
        t.skip('Gemma model not downloaded');
        return;
      }

      const { readFileSync } = await import('node:fs');
      const configPath = join(gemmaModelPath, 'config.json');
      const config = JSON.parse(readFileSync(configPath, 'utf-8'));

      // Should detect as multimodal
      assert.strictEqual(isMultimodalConfig(config), true);

      // Should extract text config
      const textConfig = getTextConfig(config);
      assert.strictEqual(textConfig.hidden_size, 2560);
      assert.strictEqual(textConfig.num_hidden_layers, 34);
      assert.strictEqual(textConfig.vocab_size, 262208);

      // Should detect model type
      assert.strictEqual(detectModelType(config), 'gemma3');

      // Should get quantization config
      const qConfig = getQuantizationConfig(config);
      assert.ok(qConfig !== null);
      assert.strictEqual(qConfig?.bits, 4);
      assert.strictEqual(qConfig?.groupSize, 64);

      // Should parse full config
      const gemmaConfig = parseGemma3Config(config);
      assert.strictEqual(gemmaConfig.hiddenSize, 2560);
      assert.strictEqual(gemmaConfig.numHiddenLayers, 34);
    });
  });

  describe('Weight Loading', () => {
    test('detects language_model prefix in multimodal weights', async (t) => {
      if (!gemmaModelPath) {
        t.skip('Gemma model not downloaded');
        return;
      }

      const safetensorsPath = join(gemmaModelPath, 'model.safetensors');
      if (!existsSync(safetensorsPath)) {
        t.skip('Model safetensors not downloaded');
        return;
      }

      const weights = loadWeights(mx as unknown as typeof mx, gemmaModelPath);

      // Should detect the language_model. prefix
      const prefix = detectWeightPrefix(weights);
      assert.strictEqual(prefix, 'language_model.');

      // Should be able to remap weights
      const remapped = remapWeightKeys(weights, prefix);
      const remappedKeys = Object.keys(remapped);

      // After remapping, keys should start with 'model.'
      const hasModelPrefix = remappedKeys.some(k => k.startsWith('model.'));
      assert.strictEqual(hasModelPrefix, true);

      // Should have expected layer structure
      assert.ok(remapped['model.embed_tokens.weight'] !== undefined);
    });

    test('checks weight shapes for quantized model', async (t) => {
      if (!gemmaModelPath) {
        t.skip('Gemma model not downloaded');
        return;
      }

      const safetensorsPath = join(gemmaModelPath, 'model.safetensors');
      if (!existsSync(safetensorsPath)) {
        t.skip('Model safetensors not downloaded');
        return;
      }

      let weights = loadWeights(mx as unknown as typeof mx, gemmaModelPath);
      const prefix = detectWeightPrefix(weights);
      weights = remapWeightKeys(weights, prefix);

      // Quantized weights have weight, scales, biases per layer
      const layerPrefix = 'model.layers.0.self_attn.q_proj';
      const hasWeight = weights[`${layerPrefix}.weight`] !== undefined;
      const hasScales = weights[`${layerPrefix}.scales`] !== undefined;
      const hasBiases = weights[`${layerPrefix}.biases`] !== undefined;

      assert.strictEqual(hasWeight, true, 'Should have quantized weight');
      assert.strictEqual(hasScales, true, 'Should have scales');
      assert.strictEqual(hasBiases, true, 'Should have quantization biases');

      // Check shapes
      const qWeight = weights[`${layerPrefix}.weight`];
      const qScales = weights[`${layerPrefix}.scales`];

      console.log(`  q_proj.weight shape: [${qWeight.shape.join(', ')}]`);
      console.log(`  q_proj.scales shape: [${qScales.shape.join(', ')}]`);
    });
  });

  describe('Model Info', () => {
    test('gets model info from real model path', async (t) => {
      if (!gemmaModelPath) {
        t.skip('Gemma model not downloaded');
        return;
      }

      const info = getModelInfo(gemmaModelPath);

      assert.strictEqual(info.modelType, 'gemma3');
      assert.strictEqual(info.numLayers, 34);
      assert.strictEqual(info.hiddenSize, 2560);
      assert.strictEqual(info.vocabSize, 262208);
      assert.strictEqual(info.isMultimodal, true);
      assert.strictEqual(info.isQuantized, true);

      console.log(`  Model type: ${info.modelType}`);
      console.log(`  Num layers: ${info.numLayers}`);
      console.log(`  Hidden size: ${info.hiddenSize}`);
      console.log(`  Vocab size: ${info.vocabSize}`);
      console.log(`  Is multimodal: ${info.isMultimodal}`);
      console.log(`  Is quantized: ${info.isQuantized}`);
    });
  });

  describe('Quantized Model Loading', () => {
    test('loads quantized model and runs forward pass', async (t) => {
      if (!gemmaModelPath) {
        t.skip('Gemma model not downloaded');
        return;
      }

      const safetensorsPath = join(gemmaModelPath, 'model.safetensors');
      if (!existsSync(safetensorsPath)) {
        t.skip('Model safetensors not downloaded');
        return;
      }

      // Import loadModel
      const { loadModel } = await import('../dist/loading/loader.js');

      console.log('  Loading quantized Gemma3 model...');
      const startTime = Date.now();

      const { model, modelType, numParameters, config } = loadModel(
        mx as unknown as typeof mx,
        gemmaModelPath,
        { verbose: false }
      );

      const loadTime = Date.now() - startTime;
      console.log(`  Model loaded in ${loadTime}ms`);
      console.log(`  Model type: ${modelType}`);
      console.log(`  Parameters: ${(numParameters / 1e9).toFixed(2)}B`);
      console.log(`  Quantization: ${config.quantization?.bits ?? 'none'}-bit`);

      // Test forward pass with a simple input
      const tokens = new mx.array([[1, 2, 3]], mx.int32);

      console.log('  Running forward pass...');
      const forwardStart = Date.now();
      const logits = model.forward(tokens);
      const forwardTime = Date.now() - forwardStart;

      console.log(`  Forward pass completed in ${forwardTime}ms`);
      console.log(`  Output shape: [${logits.shape.join(', ')}]`);

      // Verify output shape: (batch=1, seq=3, vocab=262208)
      assert.strictEqual(logits.shape.length, 3);
      assert.strictEqual(logits.shape[0], 1);
      assert.strictEqual(logits.shape[1], 3);
      // vocab size should be 262208 for this model
      assert.strictEqual(logits.shape[2], 262208);
    });
  });
});
