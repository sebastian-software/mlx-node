/**
 * Embedding layer
 *
 * Lookup table for token embeddings
 */

import type { MLXArray, MX } from '../types.js';
import { Module } from './module.js';

export interface EmbeddingOptions {
  numEmbeddings: number;
  embeddingDim: number;
}

export class Embedding extends Module {
  readonly numEmbeddings: number;
  readonly embeddingDim: number;

  private weight!: MLXArray;

  constructor(
    private mx: MX,
    options: EmbeddingOptions
  ) {
    super();
    this.numEmbeddings = options.numEmbeddings;
    this.embeddingDim = options.embeddingDim;
  }

  /**
   * Initialize with weight tensor
   */
  initialize(weight: MLXArray): void {
    this.weight = weight;
    this.registerParameter('weight', weight);
  }

  /**
   * Forward pass: lookup embeddings by token IDs
   *
   * @param indices Token IDs of shape (..., seqLen)
   * @returns Embeddings of shape (..., seqLen, embeddingDim)
   */
  forward(indices: MLXArray): MLXArray {
    return this.mx.take(this.weight, indices, 0);
  }

  /**
   * Get the weight matrix (for tied embeddings)
   */
  getWeight(): MLXArray {
    return this.weight;
  }

  /**
   * Use as output projection (for tied embeddings)
   * Computes: logits = x @ weight.T
   */
  asLinear(x: MLXArray): MLXArray {
    return this.mx.matmul(x, this.weight.T);
  }
}
