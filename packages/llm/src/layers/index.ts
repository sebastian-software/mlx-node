/**
 * Neural network layers for LLM inference
 */

export { Module, ModuleList } from './module.js';
export { Linear, QuantizedLinear, type LinearOptions, type QuantizedLinearOptions } from './linear.js';
export { Embedding, type EmbeddingOptions } from './embedding.js';
export { RMSNorm, type RMSNormOptions } from './rms-norm.js';
export {
  RoPE,
  DualRoPE,
  LongRoPE,
  createRoPE,
  type RoPEConfig,
  type DualRoPEConfig,
  type LongRoPEConfig,
  type RoPEVariant
} from './rope.js';
export {
  Attention,
  SlidingWindowAttention,
  InterleavedAttention,
  type AttentionConfig,
  type SlidingWindowConfig,
  type InterleavedConfig
} from './attention.js';
export {
  MLP,
  GatedMLP,
  MixtureOfExperts,
  SwiGLU,
  GeGLU,
  type MLPConfig,
  type GatedMLPConfig,
  type MoEConfig,
  type ActivationType
} from './mlp.js';
