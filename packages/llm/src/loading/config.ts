/**
 * Model Configuration Parsing
 *
 * Parses HuggingFace config.json files and maps to our model configs.
 */

import type { Gemma3Config } from '../models/gemma3.js';

/**
 * Raw HuggingFace config.json structure
 */
export interface HFConfig {
  model_type?: string;
  architectures?: string[];
  vocab_size?: number;
  hidden_size?: number;
  num_hidden_layers?: number;
  num_attention_heads?: number;
  num_key_value_heads?: number;
  head_dim?: number;
  intermediate_size?: number;
  rms_norm_eps?: number;
  rope_theta?: number;
  rope_local_base_freq?: number;
  max_position_embeddings?: number;
  sliding_window?: number;
  sliding_window_pattern?: number;
  attn_logit_softcapping?: number;
  final_logit_softcapping?: number;
  tie_word_embeddings?: boolean;
  eos_token_id?: number | number[];
  bos_token_id?: number;
  pad_token_id?: number;
  // Nested config for multimodal models
  text_config?: HFConfig;
  // Quantization config
  quantization?: {
    group_size?: number;
    bits?: number;
  };
  quantization_config?: {
    group_size?: number;
    bits?: number;
  };
  [key: string]: unknown;
}

/**
 * Check if model is multimodal (has nested text_config)
 */
export function isMultimodalConfig(config: HFConfig): boolean {
  return config.text_config !== undefined;
}

/**
 * Get text model config from potentially nested config
 */
export function getTextConfig(config: HFConfig): HFConfig {
  return config.text_config ?? config;
}

/**
 * Get quantization config if present
 */
export function getQuantizationConfig(config: HFConfig): { groupSize: number; bits: number } | null {
  const qConfig = config.quantization ?? config.quantization_config;
  if (!qConfig) return null;
  return {
    groupSize: qConfig.group_size ?? 64,
    bits: qConfig.bits ?? 4
  };
}

/**
 * Supported model architectures
 */
export type ModelType = 'gemma3' | 'llama' | 'mistral' | 'phi3';

/**
 * Detect model type from HuggingFace config
 */
export function detectModelType(config: HFConfig): ModelType {
  const modelType = config.model_type?.toLowerCase();
  const architectures = config.architectures?.map(a => a.toLowerCase()) ?? [];

  // Check model_type field
  if (modelType) {
    if (modelType.includes('gemma')) return 'gemma3';
    if (modelType.includes('llama')) return 'llama';
    if (modelType.includes('mistral')) return 'mistral';
    if (modelType.includes('phi')) return 'phi3';
  }

  // Check architectures field
  for (const arch of architectures) {
    if (arch.includes('gemma')) return 'gemma3';
    if (arch.includes('llama')) return 'llama';
    if (arch.includes('mistral')) return 'mistral';
    if (arch.includes('phi')) return 'phi3';
  }

  throw new Error(
    `Unknown model type. model_type=${modelType}, architectures=${architectures.join(', ')}`
  );
}

/**
 * Parse Gemma3 config from HuggingFace config.json
 * Handles both direct config and nested text_config for multimodal models
 */
export function parseGemma3Config(hfConfig: HFConfig): Gemma3Config {
  // Get the text config (may be nested in multimodal models)
  const textConfig = getTextConfig(hfConfig);

  // Get quantization config (from root config, not nested)
  const quantConfig = getQuantizationConfig(hfConfig);

  return {
    vocabSize: textConfig.vocab_size ?? 262144,
    hiddenSize: textConfig.hidden_size ?? 2560,
    numHiddenLayers: textConfig.num_hidden_layers ?? 34,
    numAttentionHeads: textConfig.num_attention_heads ?? 8,
    numKeyValueHeads: textConfig.num_key_value_heads ?? 4,
    headDim: textConfig.head_dim ?? 256,
    intermediateSize: textConfig.intermediate_size ?? 10240,
    rmsNormEps: textConfig.rms_norm_eps ?? 1e-6,
    ropeTheta: textConfig.rope_theta ?? 1000000,
    ropeLocalBaseFreq: textConfig.rope_local_base_freq ?? 10000,
    maxPositionEmbeddings: textConfig.max_position_embeddings ?? 32768,
    slidingWindow: textConfig.sliding_window ?? 512,
    slidingWindowPattern: textConfig.sliding_window_pattern ?? 6,
    attentionLogitSoftcap: textConfig.attn_logit_softcapping,
    finalLogitSoftcap: textConfig.final_logit_softcapping,
    tieWordEmbeddings: textConfig.tie_word_embeddings ?? true,
    quantization: quantConfig ?? undefined
  };
}

/**
 * Generic model config with common fields
 */
export interface ModelConfig {
  modelType: ModelType;
  vocabSize: number;
  hiddenSize: number;
  numHiddenLayers: number;
  numAttentionHeads: number;
  numKeyValueHeads?: number;
  intermediateSize?: number;
  eosTokenId?: number;
  bosTokenId?: number;
  padTokenId?: number;
}

/**
 * Extract common model config
 */
export function parseModelConfig(hfConfig: HFConfig): ModelConfig {
  const modelType = detectModelType(hfConfig);

  // Handle eos_token_id which can be number or array
  let eosTokenId: number | undefined;
  if (typeof hfConfig.eos_token_id === 'number') {
    eosTokenId = hfConfig.eos_token_id;
  } else if (Array.isArray(hfConfig.eos_token_id) && hfConfig.eos_token_id.length > 0) {
    eosTokenId = hfConfig.eos_token_id[0];
  }

  return {
    modelType,
    vocabSize: hfConfig.vocab_size ?? 32000,
    hiddenSize: hfConfig.hidden_size ?? 4096,
    numHiddenLayers: hfConfig.num_hidden_layers ?? 32,
    numAttentionHeads: hfConfig.num_attention_heads ?? 32,
    numKeyValueHeads: hfConfig.num_key_value_heads,
    intermediateSize: hfConfig.intermediate_size,
    eosTokenId,
    bosTokenId: hfConfig.bos_token_id,
    padTokenId: hfConfig.pad_token_id
  };
}
