/**
 * RMS Normalization layer
 *
 * Root Mean Square Layer Normalization as used in LLaMA, Gemma, etc.
 * Formula: y = x * rsqrt(mean(x^2) + eps) * weight
 */

import type { MLXArray, MX } from '../types.js';
import { Module } from './module.js';

export interface RMSNormOptions {
  dims: number;
  eps?: number;
}

export class RMSNorm extends Module {
  readonly dims: number;
  readonly eps: number;

  constructor(
    private mx: MX,
    options: RMSNormOptions
  ) {
    super();
    this.dims = options.dims;
    this.eps = options.eps ?? 1e-6;
  }

  /**
   * Get the weight parameter
   */
  get weight(): MLXArray {
    return this.getParameter('weight');
  }

  /**
   * Forward pass using mx.fast.rms_norm
   *
   * @param x Input tensor of shape (..., dims)
   * @returns Normalized tensor of same shape
   */
  forward(x: MLXArray): MLXArray {
    return this.mx.fast.rmsNorm(x, this.weight, this.eps);
  }

  /**
   * Manual RMS norm implementation (fallback)
   * Use this if mx.fast.rmsNorm is not available
   */
  forwardManual(x: MLXArray): MLXArray {
    // x^2
    const xSquared = this.mx.square(x);

    // mean(x^2) over last axis
    const meanSquared = this.mx.mean(xSquared, -1, true);

    // rsqrt(mean(x^2) + eps)
    const rsqrt = this.mx.rsqrt(this.mx.add(meanSquared, this.eps));

    // x * rsqrt * weight
    const normalized = this.mx.multiply(x, rsqrt);
    return this.mx.multiply(normalized, this.weight);
  }
}
