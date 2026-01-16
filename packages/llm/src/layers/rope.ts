/**
 * Rotary Position Embeddings (RoPE)
 *
 * Implements various RoPE variants:
 * - Standard RoPE
 * - Dual RoPE (Gemma3: different frequencies for global/local attention)
 * - LongRoPE (Phi3: context extension with scaling factors)
 */

import type { MLXArray, MX } from '../types.js';

/**
 * Standard RoPE configuration
 */
export interface RoPEConfig {
  dims: number;
  traditional?: boolean;
  base?: number;
  scale?: number;
}

/**
 * Dual RoPE configuration for Gemma3
 * Uses different base frequencies for global vs local attention
 */
export interface DualRoPEConfig {
  dims: number;
  traditional?: boolean;
  globalBase: number;    // e.g., 1_000_000 for full attention
  localBase: number;     // e.g., 10_000 for sliding window
  scale?: number;
}

/**
 * LongRoPE configuration for Phi3
 * Supports context extension with short/long scaling factors
 */
export interface LongRoPEConfig {
  dims: number;
  traditional?: boolean;
  base?: number;
  originalMaxPosition: number;
  maxPosition: number;
  scalingType: 'linear' | 'su' | 'longrope';
  shortFactor?: number[];
  longFactor?: number[];
}

/**
 * Standard RoPE implementation
 *
 * Uses mx.fast.rope for optimized computation
 */
export class RoPE {
  readonly dims: number;
  readonly traditional: boolean;
  readonly base: number;
  readonly scale: number;

  constructor(
    private mx: MX,
    config: RoPEConfig
  ) {
    this.dims = config.dims;
    this.traditional = config.traditional ?? false;
    this.base = config.base ?? 10000;
    this.scale = config.scale ?? 1.0;
  }

  /**
   * Apply rotary embeddings to queries and keys
   *
   * @param q Query tensor of shape (batch, seqLen, nHeads, headDim)
   * @param k Key tensor of shape (batch, seqLen, nKVHeads, headDim)
   * @param offset Position offset for incremental decoding
   * @returns [rotatedQ, rotatedK] with same shapes as input
   */
  forward(
    q: MLXArray,
    k: MLXArray,
    offset: number = 0
  ): [MLXArray, MLXArray] {
    // mx.fast.rope operates on a single array, so call it separately for q and k
    const rotatedQ = this.mx.fast.rope(
      q,
      this.dims,
      this.traditional,
      this.base,
      this.scale,
      offset
    );
    const rotatedK = this.mx.fast.rope(
      k,
      this.dims,
      this.traditional,
      this.base,
      this.scale,
      offset
    );
    return [rotatedQ, rotatedK];
  }
}

/**
 * Dual RoPE for Gemma3
 *
 * Uses different base frequencies for global (full) and local (sliding) attention.
 * Global layers use a larger base for better long-range position encoding.
 * Local layers use a smaller base optimized for the sliding window size.
 */
export class DualRoPE {
  private globalRope: RoPE;
  private localRope: RoPE;

  constructor(
    mx: MX,
    config: DualRoPEConfig
  ) {
    this.globalRope = new RoPE(mx, {
      dims: config.dims,
      traditional: config.traditional,
      base: config.globalBase,
      scale: config.scale
    });

    this.localRope = new RoPE(mx, {
      dims: config.dims,
      traditional: config.traditional,
      base: config.localBase,
      scale: config.scale
    });
  }

  /**
   * Apply rotary embeddings using global (full attention) frequency
   */
  forwardGlobal(
    q: MLXArray,
    k: MLXArray,
    offset: number = 0
  ): [MLXArray, MLXArray] {
    return this.globalRope.forward(q, k, offset);
  }

  /**
   * Apply rotary embeddings using local (sliding window) frequency
   */
  forwardLocal(
    q: MLXArray,
    k: MLXArray,
    offset: number = 0
  ): [MLXArray, MLXArray] {
    return this.localRope.forward(q, k, offset);
  }
}

/**
 * LongRoPE for Phi3
 *
 * Implements context extension through various scaling strategies.
 * Allows models to handle sequences much longer than their training context.
 */
export class LongRoPE {
  readonly dims: number;
  readonly traditional: boolean;
  readonly base: number;
  readonly originalMaxPosition: number;
  readonly maxPosition: number;
  readonly scalingType: 'linear' | 'su' | 'longrope';
  readonly shortFactor: number[];
  readonly longFactor: number[];

  private scale: number;

  constructor(
    private mx: MX,
    config: LongRoPEConfig
  ) {
    this.dims = config.dims;
    this.traditional = config.traditional ?? false;
    this.base = config.base ?? 10000;
    this.originalMaxPosition = config.originalMaxPosition;
    this.maxPosition = config.maxPosition;
    this.scalingType = config.scalingType;
    this.shortFactor = config.shortFactor ?? [];
    this.longFactor = config.longFactor ?? [];

    // Compute linear scale factor
    this.scale = this.maxPosition / this.originalMaxPosition;
  }

  /**
   * Apply LongRoPE with appropriate scaling
   *
   * The scaling strategy depends on the configuration:
   * - linear: Simple frequency scaling
   * - su: SuScaled RoPE with short/long factors
   * - longrope: Advanced long context RoPE
   */
  forward(
    q: MLXArray,
    k: MLXArray,
    offset: number = 0,
    seqLen?: number
  ): [MLXArray, MLXArray] {
    // Determine which scaling to use based on sequence length
    const effectiveLen = seqLen ?? offset;
    const useShortFactor = effectiveLen <= this.originalMaxPosition;

    let effectiveScale: number;
    if (this.scalingType === 'linear') {
      effectiveScale = this.scale;
    } else {
      // For su/longrope, we need custom frequency computation
      // This is a simplified version - full implementation would need
      // to apply the short/long factors to individual frequency dimensions
      effectiveScale = useShortFactor ? 1.0 : this.scale;
    }

    // mx.fast.rope operates on a single array, so call it separately for q and k
    const rotatedQ = this.mx.fast.rope(
      q,
      this.dims,
      this.traditional,
      this.base,
      effectiveScale,
      offset
    );
    const rotatedK = this.mx.fast.rope(
      k,
      this.dims,
      this.traditional,
      this.base,
      effectiveScale,
      offset
    );
    return [rotatedQ, rotatedK];
  }
}

/**
 * Factory function to create appropriate RoPE variant
 */
export type RoPEVariant = RoPE | DualRoPE | LongRoPE;

export function createRoPE(
  mx: MX,
  config: RoPEConfig | DualRoPEConfig | LongRoPEConfig
): RoPEVariant {
  if ('globalBase' in config && 'localBase' in config) {
    return new DualRoPE(mx, config);
  }

  if ('scalingType' in config) {
    return new LongRoPE(mx, config);
  }

  return new RoPE(mx, config);
}
