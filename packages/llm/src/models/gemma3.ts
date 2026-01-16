/**
 * Gemma 3 Model Architecture
 *
 * TypeScript translation of the Gemma 3 text model from mlx-lm.
 *
 * Key features:
 * - Interleaved global/local attention (pattern-based)
 * - Dual RoPE frequencies for global vs sliding window
 * - Q/K normalization per head
 * - Float16 residual clipping for stability
 *
 * ---
 *
 * Based on mlx-lm by Apple Inc.
 * https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/models/gemma3_text.py
 *
 * Copyright (c) 2023-2024 Apple Inc.
 * Licensed under the MIT License.
 */

import type { MLXArray, MX, Weights } from '../types.js';
import { Module, ModuleList } from '../layers/module.js';
import { Linear, QuantizedLinear } from '../layers/linear.js';
import { Embedding, QuantizedEmbedding } from '../layers/embedding.js';
import { RMSNorm } from '../layers/rms-norm.js';
import { DualRoPE } from '../layers/rope.js';
import { KVCache, RotatingKVCache, ModelCache } from '../cache/kv-cache.js';
import type { GenerativeModel } from '../generation/generate.js';

/**
 * Quantization configuration
 */
export interface QuantizationConfig {
  groupSize: number;
  bits: number;
}

/**
 * Helper type for linear layer (can be either Linear or QuantizedLinear)
 */
type LinearLayer = Linear | QuantizedLinear;

/**
 * Create a linear layer, either regular or quantized based on config
 */
function createLinear(
  mx: MX,
  inputDim: number,
  outputDim: number,
  bias: boolean,
  quantization?: QuantizationConfig
): LinearLayer {
  if (quantization) {
    return new QuantizedLinear(mx, {
      inputDim,
      outputDim,
      bias,
      groupSize: quantization.groupSize,
      bits: quantization.bits
    });
  }
  return new Linear(mx, { inputDim, outputDim, bias });
}

/**
 * Gemma3 model configuration
 */
export interface Gemma3Config {
  vocabSize: number;
  hiddenSize: number;
  numHiddenLayers: number;
  numAttentionHeads: number;
  numKeyValueHeads: number;
  headDim: number;
  intermediateSize: number;
  rmsNormEps: number;
  ropeTheta: number;              // Base frequency for global attention
  ropeLocalBaseFreq: number;      // Base frequency for sliding window
  maxPositionEmbeddings: number;
  slidingWindow: number;          // Sliding window size
  slidingWindowPattern: number;   // Full attention every N layers
  attentionLogitSoftcap?: number;
  finalLogitSoftcap?: number;
  tieWordEmbeddings?: boolean;
  quantization?: QuantizationConfig;  // Optional quantization config
}

/**
 * Default Gemma3 configuration (4B model)
 */
export const GEMMA3_4B_CONFIG: Gemma3Config = {
  vocabSize: 262144,
  hiddenSize: 2560,
  numHiddenLayers: 34,
  numAttentionHeads: 8,
  numKeyValueHeads: 4,
  headDim: 256,
  intermediateSize: 10240,
  rmsNormEps: 1e-6,
  ropeTheta: 1000000,
  ropeLocalBaseFreq: 10000,
  maxPositionEmbeddings: 32768,
  slidingWindow: 512,
  slidingWindowPattern: 6,
  tieWordEmbeddings: true
};

/**
 * Gemma3 Attention with interleaved global/local pattern
 */
class Gemma3Attention extends Module {
  private readonly numHeads: number;
  private readonly numKVHeads: number;
  private readonly headDim: number;
  private readonly scale: number;
  private readonly isGlobalLayer: boolean;
  private readonly slidingWindow: number;

  private qProj!: LinearLayer;
  private kProj!: LinearLayer;
  private vProj!: LinearLayer;
  private oProj!: LinearLayer;
  private qNorm!: RMSNorm;
  private kNorm!: RMSNorm;
  private rope: DualRoPE;

  constructor(
    private mx: MX,
    config: Gemma3Config,
    layerIndex: number
  ) {
    super();

    this.numHeads = config.numAttentionHeads;
    this.numKVHeads = config.numKeyValueHeads;
    this.headDim = config.headDim;
    this.scale = Math.pow(this.headDim, -0.5);
    this.slidingWindow = config.slidingWindow;

    // Determine if this is a global (full attention) layer
    // Pattern: every Nth layer uses full attention
    this.isGlobalLayer = (layerIndex % config.slidingWindowPattern) === 0;

    const quant = config.quantization;

    // Q, K, V, O projections (quantized if config specifies)
    this.qProj = createLinear(
      mx, config.hiddenSize, this.numHeads * this.headDim, false, quant
    );
    this.registerModule('q_proj', this.qProj);

    this.kProj = createLinear(
      mx, config.hiddenSize, this.numKVHeads * this.headDim, false, quant
    );
    this.registerModule('k_proj', this.kProj);

    this.vProj = createLinear(
      mx, config.hiddenSize, this.numKVHeads * this.headDim, false, quant
    );
    this.registerModule('v_proj', this.vProj);

    this.oProj = createLinear(
      mx, this.numHeads * this.headDim, config.hiddenSize, false, quant
    );
    this.registerModule('o_proj', this.oProj);

    // Per-head Q/K normalization (Gemma3 specific)
    this.qNorm = new RMSNorm(mx, { dims: this.headDim, eps: config.rmsNormEps });
    this.registerModule('q_norm', this.qNorm);

    this.kNorm = new RMSNorm(mx, { dims: this.headDim, eps: config.rmsNormEps });
    this.registerModule('k_norm', this.kNorm);

    // Dual RoPE with different frequencies for global/local
    this.rope = new DualRoPE(mx, {
      dims: this.headDim,
      globalBase: config.ropeTheta,
      localBase: config.ropeLocalBaseFreq
    });
  }

  forward(
    x: MLXArray,
    mask?: MLXArray,
    cache?: KVCache | RotatingKVCache
  ): MLXArray {
    const [batch, seqLen] = x.shape;

    // Project to Q, K, V
    let q = this.qProj.forward(x);
    let k = this.kProj.forward(x);
    let v = this.vProj.forward(x);

    // Reshape to (batch, seqLen, numHeads, headDim)
    q = this.mx.reshape(q, [batch, seqLen, this.numHeads, this.headDim]);
    k = this.mx.reshape(k, [batch, seqLen, this.numKVHeads, this.headDim]);
    v = this.mx.reshape(v, [batch, seqLen, this.numKVHeads, this.headDim]);

    // Apply Q/K normalization
    q = this.qNorm.forward(q);
    k = this.kNorm.forward(k);

    // Apply appropriate RoPE based on layer type
    const offset = cache?.length ?? 0;
    if (this.isGlobalLayer) {
      [q, k] = this.rope.forwardGlobal(q, k, offset);
    } else {
      [q, k] = this.rope.forwardLocal(q, k, offset);
    }

    // Update cache
    if (cache) {
      [k, v] = cache.update(k, v);
    }

    // Expand K, V for GQA (repeat interleave)
    const kvRepeats = this.numHeads / this.numKVHeads;
    if (kvRepeats > 1) {
      k = this.mx.repeat_interleave(k, kvRepeats, 2);
      v = this.mx.repeat_interleave(v, kvRepeats, 2);
    }

    // Transpose for attention: (batch, numHeads, seqLen, headDim)
    q = this.mx.transpose(q, [0, 2, 1, 3]);
    k = this.mx.transpose(k, [0, 2, 1, 3]);
    v = this.mx.transpose(v, [0, 2, 1, 3]);

    // Scaled dot-product attention
    // Pass empty string for mask_mode when using custom mask
    const output = this.mx.fast.scaledDotProductAttention(
      q, k, v, this.scale, '', mask
    );

    // Transpose back and reshape
    const outTransposed = this.mx.transpose(output, [0, 2, 1, 3]);
    const outReshaped = this.mx.reshape(
      outTransposed,
      [batch, seqLen, this.numHeads * this.headDim]
    );

    return this.oProj.forward(outReshaped);
  }
}

/**
 * Gemma3 MLP with GELU activation
 *
 * Supports both regular and quantized weights.
 * Uses gated activation: down(gelu(gate(x)) * up(x))
 */
class Gemma3MLP extends Module {
  private gateProj!: LinearLayer;
  private upProj!: LinearLayer;
  private downProj!: LinearLayer;

  constructor(
    private mx: MX,
    config: Gemma3Config
  ) {
    super();

    const quant = config.quantization;

    this.gateProj = createLinear(
      mx, config.hiddenSize, config.intermediateSize, false, quant
    );
    this.registerModule('gate_proj', this.gateProj);

    this.upProj = createLinear(
      mx, config.hiddenSize, config.intermediateSize, false, quant
    );
    this.registerModule('up_proj', this.upProj);

    this.downProj = createLinear(
      mx, config.intermediateSize, config.hiddenSize, false, quant
    );
    this.registerModule('down_proj', this.downProj);
  }

  /**
   * GELU activation: 0.5 * x * (1 + erf(x / sqrt(2)))
   */
  private gelu(x: MLXArray): MLXArray {
    const sqrt2 = Math.sqrt(2);
    const xNorm = this.mx.divide(x, sqrt2);
    const erfVal = this.mx.erf(xNorm);
    const onePlusErf = this.mx.add(erfVal, 1);
    const xTimesErf = this.mx.multiply(x, onePlusErf);
    return this.mx.multiply(xTimesErf, 0.5);
  }

  forward(x: MLXArray): MLXArray {
    // Gated MLP: down(gelu(gate(x)) * up(x))
    const gate = this.gateProj.forward(x);
    const up = this.upProj.forward(x);
    const gateActivated = this.gelu(gate);
    const gatedUp = this.mx.multiply(gateActivated, up);
    return this.downProj.forward(gatedUp);
  }
}

/**
 * Clip residual values to prevent float16 overflow
 * Gemma3 uses this for numerical stability
 */
function clipResidual(mx: MX, x: MLXArray, residual: MLXArray): MLXArray {
  // Cast to float32, add, clip, cast back
  const xF32 = x.astype('float32');
  const resF32 = residual.astype('float32');
  const sum = mx.add(xF32, resF32);
  const clipped = mx.clip(sum, -65504, 65504); // float16 range
  return clipped.astype('float16');
}

/**
 * Gemma3 Transformer Block
 */
class Gemma3TransformerBlock extends Module {
  private attention: Gemma3Attention;
  private mlp: Gemma3MLP;
  private inputLayernorm: RMSNorm;
  private postAttentionLayernorm: RMSNorm;
  private preFFLayernorm: RMSNorm;
  private postFFLayernorm: RMSNorm;

  constructor(
    private mx: MX,
    config: Gemma3Config,
    layerIndex: number
  ) {
    super();

    this.attention = new Gemma3Attention(mx, config, layerIndex);
    this.registerModule('self_attn', this.attention);

    this.mlp = new Gemma3MLP(mx, config);
    this.registerModule('mlp', this.mlp);

    // Four layer norms as per Gemma3 architecture
    this.inputLayernorm = new RMSNorm(mx, {
      dims: config.hiddenSize,
      eps: config.rmsNormEps
    });
    this.registerModule('input_layernorm', this.inputLayernorm);

    this.postAttentionLayernorm = new RMSNorm(mx, {
      dims: config.hiddenSize,
      eps: config.rmsNormEps
    });
    this.registerModule('post_attention_layernorm', this.postAttentionLayernorm);

    this.preFFLayernorm = new RMSNorm(mx, {
      dims: config.hiddenSize,
      eps: config.rmsNormEps
    });
    this.registerModule('pre_feedforward_layernorm', this.preFFLayernorm);

    this.postFFLayernorm = new RMSNorm(mx, {
      dims: config.hiddenSize,
      eps: config.rmsNormEps
    });
    this.registerModule('post_feedforward_layernorm', this.postFFLayernorm);
  }

  forward(
    x: MLXArray,
    mask?: MLXArray,
    cache?: KVCache | RotatingKVCache
  ): MLXArray {
    // Pre-attention norm
    let residual = x;
    x = this.inputLayernorm.forward(x);

    // Self-attention
    x = this.attention.forward(x, mask, cache);

    // Post-attention norm + residual
    x = this.postAttentionLayernorm.forward(x);
    x = clipResidual(this.mx, residual, x);

    // Pre-FF norm
    residual = x;
    x = this.preFFLayernorm.forward(x);

    // Feed-forward
    x = this.mlp.forward(x);

    // Post-FF norm + residual
    x = this.postFFLayernorm.forward(x);
    x = clipResidual(this.mx, residual, x);

    return x;
  }
}

/**
 * Gemma3 Language Model
 */
class Gemma3LanguageModel extends Module {
  private embedTokens: Embedding | QuantizedEmbedding;
  private layers: ModuleList;
  private norm: RMSNorm;

  constructor(
    private mx: MX,
    private config: Gemma3Config
  ) {
    super();

    // Token embeddings (quantized if config specifies)
    if (config.quantization) {
      this.embedTokens = new QuantizedEmbedding(mx, {
        numEmbeddings: config.vocabSize,
        embeddingDim: config.hiddenSize,
        groupSize: config.quantization.groupSize,
        bits: config.quantization.bits
      });
    } else {
      this.embedTokens = new Embedding(mx, {
        numEmbeddings: config.vocabSize,
        embeddingDim: config.hiddenSize
      });
    }
    this.registerModule('embed_tokens', this.embedTokens);

    // Transformer layers
    const layers: Gemma3TransformerBlock[] = [];
    for (let i = 0; i < config.numHiddenLayers; i++) {
      layers.push(new Gemma3TransformerBlock(mx, config, i));
    }
    this.layers = new ModuleList(layers);
    this.registerModule('layers', this.layers);

    // Final normalization
    this.norm = new RMSNorm(mx, {
      dims: config.hiddenSize,
      eps: config.rmsNormEps
    });
    this.registerModule('norm', this.norm);
  }

  forward(
    tokens: MLXArray,
    cache?: ModelCache
  ): MLXArray {
    // Token embeddings
    let x = this.embedTokens.forward(tokens);

    // Normalize embeddings (Gemma3 specific)
    x = this.mx.multiply(x, Math.sqrt(this.config.hiddenSize));

    // Create attention mask
    const mask = this.createCausalMask(tokens.shape[1], cache?.offset ?? 0);

    // Pass through transformer layers
    for (let i = 0; i < this.layers.length; i++) {
      const layer = this.layers.get(i) as Gemma3TransformerBlock;
      const layerCache = cache?.getLayerCache(i);
      x = layer.forward(x, mask, layerCache);
    }

    // Final normalization
    return this.norm.forward(x);
  }

  private createCausalMask(seqLen: number, offset: number): MLXArray | undefined {
    if (seqLen === 1) {
      return undefined; // No mask needed for single token
    }

    // Create causal mask: lower triangular
    // mask[i, j] = -inf if j > i + offset else 0
    const totalLen = offset + seqLen;

    // Create row indices (query positions): [0, 1, ..., seqLen-1] + offset
    const rows = this.mx.arange(offset, offset + seqLen);
    const rowsExpanded = this.mx.expand_dims(rows, 1); // (seqLen, 1)

    // Create column indices (key positions): [0, 1, ..., totalLen-1]
    const cols = this.mx.arange(0, totalLen);
    const colsExpanded = this.mx.expand_dims(cols, 0); // (1, totalLen)

    // mask[i,j] = -inf where col > row (future positions)
    // Using broadcasting: (seqLen, 1) vs (1, totalLen) -> (seqLen, totalLen)
    const isCausal = this.mx.greater(colsExpanded, rowsExpanded);

    // Convert boolean mask to float mask with -inf for masked positions
    const negInf = this.mx.full([1], -Infinity, 'float16');
    const zeroVal = this.mx.full([1], 0, 'float16');

    return this.mx.where(isCausal, negInf, zeroVal);
  }
}

/**
 * Gemma3 Model (full model with LM head)
 */
export class Gemma3Model extends Module implements GenerativeModel {
  private model: Gemma3LanguageModel;
  private lmHead: LinearLayer | null = null;

  readonly config: Gemma3Config & {
    eosTokenId?: number;
  };

  constructor(
    private mx: MX,
    config: Gemma3Config
  ) {
    super();

    this.config = {
      ...config,
      eosTokenId: 1 // Default EOS token for Gemma
    };

    this.model = new Gemma3LanguageModel(mx, config);
    this.registerModule('model', this.model);

    // LM head (may be tied with embeddings)
    // Note: For quantized models with tied embeddings, we use the embedding weight directly
    if (!config.tieWordEmbeddings) {
      this.lmHead = createLinear(
        mx, config.hiddenSize, config.vocabSize, false, config.quantization
      );
      this.registerModule('lm_head', this.lmHead);
    }
  }

  forward(tokens: MLXArray, cache?: ModelCache): MLXArray {
    // Get hidden states from language model
    const hidden = this.model.forward(tokens, cache);

    // Project to vocabulary
    if (this.lmHead) {
      return this.lmHead.forward(hidden);
    }

    // Tied embeddings: use embedding weight as LM head
    const embedTokens = this.model.modules().get('embed_tokens') as Embedding;
    return embedTokens.asLinear(hidden);
  }

  createCache(): ModelCache {
    // Create layer-specific caches based on attention pattern
    const layerConfigs = [];
    for (let i = 0; i < this.config.numHiddenLayers; i++) {
      const isGlobalLayer = (i % this.config.slidingWindowPattern) === 0;
      if (isGlobalLayer) {
        layerConfigs.push({ type: 'standard' as const });
      } else {
        layerConfigs.push({
          type: 'rotating' as const,
          windowSize: this.config.slidingWindow
        });
      }
    }

    return new ModelCache(this.mx, this.config.numHiddenLayers, { layerConfigs });
  }
}

/**
 * Load Gemma3 model from weights
 */
export function loadGemma3(
  mx: MX,
  config: Gemma3Config,
  weights: Weights
): Gemma3Model {
  const model = new Gemma3Model(mx, config);
  model.loadWeights(weights);
  return model;
}

// Note: parseGemma3Config is in loading/config.ts to avoid circular dependencies
// and to properly handle multimodal models with nested text_config
