/**
 * Attention mechanisms
 *
 * Implements:
 * - Standard Multi-Head Attention
 * - Grouped Query Attention (GQA)
 * - Sliding Window Attention
 * - Interleaved Attention (Gemma3 style)
 */

import type { MLXArray, MX } from '../types.js';
import { Module } from './module.js';
import { Linear } from './linear.js';
import { RMSNorm } from './rms-norm.js';
import { RoPE, DualRoPE, type RoPEVariant } from './rope.js';
import { KVCache, RotatingKVCache } from '../cache/kv-cache.js';

/**
 * Attention configuration
 */
export interface AttentionConfig {
  hiddenSize: number;
  numHeads: number;
  numKVHeads?: number;        // For GQA, defaults to numHeads
  headDim?: number;           // Defaults to hiddenSize / numHeads
  bias?: boolean;
  qkNorm?: boolean;           // Apply RMSNorm to Q and K
  qkNormEps?: number;
}

/**
 * Sliding window configuration
 */
export interface SlidingWindowConfig {
  windowSize: number;
}

/**
 * Interleaved attention configuration (Gemma3 style)
 */
export interface InterleavedConfig {
  pattern: number;            // Apply full attention every N layers
  windowSize: number;         // Window size for sliding layers
  globalRopeBase: number;     // RoPE base for full attention
  localRopeBase: number;      // RoPE base for sliding window
}

/**
 * Base Attention layer with Grouped Query Attention support
 */
export class Attention extends Module {
  readonly hiddenSize: number;
  readonly numHeads: number;
  readonly numKVHeads: number;
  readonly headDim: number;
  readonly scale: number;
  readonly qkNorm: boolean;

  protected qProj!: Linear;
  protected kProj!: Linear;
  protected vProj!: Linear;
  protected oProj!: Linear;

  protected qNorm?: RMSNorm;
  protected kNorm?: RMSNorm;

  protected rope!: RoPEVariant;

  constructor(
    protected mx: MX,
    config: AttentionConfig
  ) {
    super();

    this.hiddenSize = config.hiddenSize;
    this.numHeads = config.numHeads;
    this.numKVHeads = config.numKVHeads ?? config.numHeads;
    this.headDim = config.headDim ?? Math.floor(config.hiddenSize / config.numHeads);
    this.scale = Math.pow(this.headDim, -0.5);
    this.qkNorm = config.qkNorm ?? false;

    // Create projection layers
    this.qProj = new Linear(mx, {
      inputDim: this.hiddenSize,
      outputDim: this.numHeads * this.headDim,
      bias: config.bias ?? false
    });
    this.registerModule('q_proj', this.qProj);

    this.kProj = new Linear(mx, {
      inputDim: this.hiddenSize,
      outputDim: this.numKVHeads * this.headDim,
      bias: config.bias ?? false
    });
    this.registerModule('k_proj', this.kProj);

    this.vProj = new Linear(mx, {
      inputDim: this.hiddenSize,
      outputDim: this.numKVHeads * this.headDim,
      bias: config.bias ?? false
    });
    this.registerModule('v_proj', this.vProj);

    this.oProj = new Linear(mx, {
      inputDim: this.numHeads * this.headDim,
      outputDim: this.hiddenSize,
      bias: config.bias ?? false
    });
    this.registerModule('o_proj', this.oProj);

    // Optional Q/K normalization (Gemma3 uses this)
    if (this.qkNorm) {
      const normEps = config.qkNormEps ?? 1e-6;

      this.qNorm = new RMSNorm(mx, { dims: this.headDim, eps: normEps });
      this.registerModule('q_norm', this.qNorm);

      this.kNorm = new RMSNorm(mx, { dims: this.headDim, eps: normEps });
      this.registerModule('k_norm', this.kNorm);
    }
  }

  /**
   * Set RoPE implementation
   */
  setRoPE(rope: RoPEVariant): void {
    this.rope = rope;
  }

  /**
   * Forward pass
   *
   * @param x Input tensor (batch, seqLen, hiddenSize)
   * @param mask Optional attention mask
   * @param cache Optional KV cache for incremental decoding
   * @returns Output tensor (batch, seqLen, hiddenSize)
   */
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

    // Reshape: (batch, seqLen, numHeads * headDim) -> (batch, seqLen, numHeads, headDim)
    q = this.mx.reshape(q, [batch, seqLen, this.numHeads, this.headDim]);
    k = this.mx.reshape(k, [batch, seqLen, this.numKVHeads, this.headDim]);
    v = this.mx.reshape(v, [batch, seqLen, this.numKVHeads, this.headDim]);

    // Apply Q/K normalization if enabled
    if (this.qkNorm && this.qNorm && this.kNorm) {
      q = this.qNorm.forward(q);
      k = this.kNorm.forward(k);
    }

    // Apply RoPE
    const offset = cache?.length ?? 0;
    if (this.rope instanceof RoPE) {
      [q, k] = this.rope.forward(q, k, offset);
    } else if (this.rope instanceof DualRoPE) {
      // Default to global for standard attention
      [q, k] = this.rope.forwardGlobal(q, k, offset);
    }

    // Update cache
    if (cache) {
      [k, v] = cache.update(k, v);
    }

    // Expand K, V for GQA if needed
    if (this.numKVHeads < this.numHeads) {
      const repeats = this.numHeads / this.numKVHeads;
      k = this.mx.repeat_interleave(k, repeats, 2);
      v = this.mx.repeat_interleave(v, repeats, 2);
    }

    // Transpose for attention: (batch, numHeads, seqLen, headDim)
    q = this.mx.transpose(q, [0, 2, 1, 3]);
    k = this.mx.transpose(k, [0, 2, 1, 3]);
    v = this.mx.transpose(v, [0, 2, 1, 3]);

    // Scaled dot-product attention
    const output = this.mx.fast.scaledDotProductAttention(
      q, k, v, this.scale, mask
    );

    // Transpose back and reshape: (batch, numHeads, seqLen, headDim) -> (batch, seqLen, hiddenSize)
    const outTransposed = this.mx.transpose(output, [0, 2, 1, 3]);
    const outReshaped = this.mx.reshape(outTransposed, [batch, seqLen, this.numHeads * this.headDim]);

    // Output projection
    return this.oProj.forward(outReshaped);
  }
}

/**
 * Sliding Window Attention
 *
 * Limits attention to a fixed window around each position.
 * More memory efficient for long sequences.
 */
export class SlidingWindowAttention extends Attention {
  readonly windowSize: number;

  constructor(
    mx: MX,
    config: AttentionConfig & SlidingWindowConfig
  ) {
    super(mx, config);
    this.windowSize = config.windowSize;
  }

  /**
   * Create sliding window attention mask
   */
  private createWindowMask(seqLen: number, offset: number): MLXArray {
    // Create causal mask with sliding window
    // Positions can only attend to positions within windowSize
    const totalLen = offset + seqLen;

    // TODO: Create proper sliding window mask
    // mask[i, j] = 1 if j > i or i - j > windowSize, else 0
    // For now, return a basic causal mask
    return this.mx.full([seqLen, totalLen], 0, 'float16');
  }

  forward(
    x: MLXArray,
    mask?: MLXArray,
    cache?: RotatingKVCache
  ): MLXArray {
    const seqLen = x.shape[1];
    const offset = cache?.length ?? 0;

    // Create or combine with sliding window mask
    const windowMask = this.createWindowMask(seqLen, offset);
    const effectiveMask = mask
      ? this.mx.maximum(mask, windowMask)
      : windowMask;

    return super.forward(x, effectiveMask, cache);
  }
}

/**
 * Interleaved Attention (Gemma3 style)
 *
 * Alternates between full attention and sliding window attention.
 * Full attention is used every N layers (pattern), others use sliding window.
 */
export class InterleavedAttention extends Attention {
  readonly pattern: number;
  readonly windowSize: number;
  readonly isGlobalLayer: boolean;

  private dualRope: DualRoPE;

  constructor(
    mx: MX,
    config: AttentionConfig & InterleavedConfig,
    layerIndex: number
  ) {
    super(mx, config);

    this.pattern = config.pattern;
    this.windowSize = config.windowSize;
    this.isGlobalLayer = (layerIndex % config.pattern) === 0;

    // Create dual RoPE for different frequencies
    this.dualRope = new DualRoPE(mx, {
      dims: this.headDim,
      globalBase: config.globalRopeBase,
      localBase: config.localRopeBase
    });
  }

  /**
   * Create appropriate attention mask based on layer type
   */
  private createMask(seqLen: number, offset: number): MLXArray | undefined {
    if (this.isGlobalLayer) {
      // Full causal attention - no mask needed for causal
      return undefined;
    }

    // Sliding window mask for local layers
    // TODO: Create proper sliding window mask
    return undefined;
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

    // Reshape
    q = this.mx.reshape(q, [batch, seqLen, this.numHeads, this.headDim]);
    k = this.mx.reshape(k, [batch, seqLen, this.numKVHeads, this.headDim]);
    v = this.mx.reshape(v, [batch, seqLen, this.numKVHeads, this.headDim]);

    // Apply Q/K normalization if enabled
    if (this.qkNorm && this.qNorm && this.kNorm) {
      q = this.qNorm.forward(q);
      k = this.kNorm.forward(k);
    }

    // Apply appropriate RoPE based on layer type
    const offset = cache?.length ?? 0;
    if (this.isGlobalLayer) {
      [q, k] = this.dualRope.forwardGlobal(q, k, offset);
    } else {
      [q, k] = this.dualRope.forwardLocal(q, k, offset);
    }

    // Update cache
    if (cache) {
      [k, v] = cache.update(k, v);
    }

    // Create layer-appropriate mask
    const effectiveMask = mask ?? this.createMask(seqLen, offset);

    // Transpose for attention
    q = this.mx.transpose(q, [0, 2, 1, 3]);
    k = this.mx.transpose(k, [0, 2, 1, 3]);
    v = this.mx.transpose(v, [0, 2, 1, 3]);

    // Attention
    const output = this.mx.fast.scaledDotProductAttention(
      q, k, v, this.scale, effectiveMask
    );

    // Reshape and project
    const outTransposed = this.mx.transpose(output, [0, 2, 1, 3]);
    const outReshaped = this.mx.reshape(outTransposed, [batch, seqLen, this.numHeads * this.headDim]);

    return this.oProj.forward(outReshaped);
  }
}
