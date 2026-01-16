/**
 * Model Loader
 *
 * Main entry point for loading models from disk.
 *
 * Usage:
 *   const model = await loadModel(mx, '/path/to/model');
 *   const output = model.forward(tokens);
 */

import type { MX, Weights } from '../types.js';
import type { GenerativeModel } from '../generation/generate.js';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { type HFConfig, detectModelType, parseGemma3Config, getQuantizationConfig, isMultimodalConfig } from './config.js';
import { loadWeights, printWeightInfo, detectWeightPrefix, remapWeightKeys } from './weights.js';
import { Gemma3Model } from '../models/gemma3.js';

/**
 * Model loading options
 */
export interface LoadModelOptions {
  /**
   * Print weight loading info for debugging
   */
  verbose?: boolean;

  /**
   * Override the detected model type
   */
  modelType?: string;
}

/**
 * Loaded model result
 */
export interface LoadedModel {
  /**
   * The model instance ready for inference
   */
  model: GenerativeModel;

  /**
   * The parsed configuration
   */
  config: HFConfig;

  /**
   * Model type that was loaded
   */
  modelType: string;

  /**
   * Number of parameters in the model
   */
  numParameters: number;
}

/**
 * Load a model from a directory containing config.json and safetensors files.
 *
 * @param mx - MLX runtime
 * @param modelPath - Path to model directory (must contain config.json)
 * @param options - Loading options
 * @returns Loaded model ready for inference
 *
 * @example
 * ```typescript
 * const { model } = await loadModel(mx, './models/gemma-3-4b');
 *
 * const tokens = mx.array([[1, 2, 3]]);
 * const logits = model.forward(tokens);
 * ```
 */
export function loadModel(
  mx: MX,
  modelPath: string,
  options: LoadModelOptions = {}
): LoadedModel {
  const { verbose = false, modelType: overrideModelType } = options;

  // Load config.json
  const configPath = join(modelPath, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`config.json not found in ${modelPath}`);
  }

  const configJson = readFileSync(configPath, 'utf-8');
  const hfConfig: HFConfig = JSON.parse(configJson);

  if (verbose) {
    console.log(`Loading model from: ${modelPath}`);
    console.log(`Model type: ${hfConfig.model_type}`);
    console.log(`Architectures: ${hfConfig.architectures?.join(', ')}`);
  }

  // Detect model type
  const modelType = overrideModelType ?? detectModelType(hfConfig);

  if (verbose) {
    console.log(`Detected model type: ${modelType}`);
  }

  // Get quantization config
  const quantConfig = getQuantizationConfig(hfConfig);
  if (verbose && quantConfig) {
    console.log(`Quantization: ${quantConfig.bits}-bit, group_size=${quantConfig.groupSize}`);
  }

  // Load weights
  let weights = loadWeights(mx, modelPath);

  if (verbose) {
    printWeightInfo(weights);
  }

  // Detect and remap weight prefix (e.g., language_model. for multimodal)
  const weightPrefix = detectWeightPrefix(weights);
  if (weightPrefix) {
    if (verbose) {
      console.log(`Detected weight prefix: '${weightPrefix}', remapping...`);
    }
    weights = remapWeightKeys(weights, weightPrefix);
  }

  // Create model based on type
  let model: GenerativeModel;

  switch (modelType) {
    case 'gemma3': {
      const config = parseGemma3Config(hfConfig);
      model = createGemma3Model(mx, config, weights, hfConfig);
      break;
    }

    default:
      throw new Error(`Model type '${modelType}' not yet supported`);
  }

  return {
    model,
    config: hfConfig,
    modelType,
    numParameters: model.numParameters()
  };
}

/**
 * Create and load a Gemma3 model
 */
function createGemma3Model(
  mx: MX,
  config: ReturnType<typeof parseGemma3Config>,
  weights: Weights,
  hfConfig: HFConfig
): Gemma3Model {
  // Create model
  const model = new Gemma3Model(mx, config);

  // Set EOS token from config
  if (hfConfig.eos_token_id !== undefined) {
    const eosId = Array.isArray(hfConfig.eos_token_id)
      ? hfConfig.eos_token_id[0]
      : hfConfig.eos_token_id;
    (model.config as { eosTokenId?: number }).eosTokenId = eosId;
  }

  // Load weights into model
  model.loadWeights(weights);

  return model;
}

/**
 * Check if a path contains a valid model
 */
export function isValidModelPath(modelPath: string): boolean {
  const configPath = join(modelPath, 'config.json');
  if (!existsSync(configPath)) {
    return false;
  }

  // Check for at least one safetensors file
  try {
    const files = readdirSync(modelPath);
    return files.some((f: string) => f.endsWith('.safetensors'));
  } catch {
    return false;
  }
}

/**
 * Get model info without loading weights (fast)
 */
export function getModelInfo(modelPath: string): {
  modelType: string;
  config: HFConfig;
  numLayers: number;
  hiddenSize: number;
  vocabSize: number;
  isMultimodal: boolean;
  isQuantized: boolean;
} {
  const configPath = join(modelPath, 'config.json');
  if (!existsSync(configPath)) {
    throw new Error(`config.json not found in ${modelPath}`);
  }

  const configJson = readFileSync(configPath, 'utf-8');
  const hfConfig: HFConfig = JSON.parse(configJson);
  const modelType = detectModelType(hfConfig);

  // Get text config for multimodal models
  const textConfig = hfConfig.text_config ?? hfConfig;
  const quantConfig = getQuantizationConfig(hfConfig);

  return {
    modelType,
    config: hfConfig,
    numLayers: textConfig.num_hidden_layers ?? 0,
    hiddenSize: textConfig.hidden_size ?? 0,
    vocabSize: textConfig.vocab_size ?? 0,
    isMultimodal: isMultimodalConfig(hfConfig),
    isQuantized: quantConfig !== null
  };
}
