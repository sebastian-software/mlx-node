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

  constructor(
    protected mx: MX,
    options: EmbeddingOptions
  ) {
    super();
    this.numEmbeddings = options.numEmbeddings;
    this.embeddingDim = options.embeddingDim;
  }

  /**
   * Get the weight parameter
   */
  get weight(): MLXArray {
    return this.getParameter('weight');
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
   * Use as output projection (for tied embeddings)
   * Computes: logits = x @ weight.T
   */
  asLinear(x: MLXArray): MLXArray {
    const weightT = this.mx.transpose(this.weight);
    return this.mx.matmul(x, weightT);
  }
}

/**
 * Quantized Embedding layer options
 */
export interface QuantizedEmbeddingOptions extends EmbeddingOptions {
  groupSize?: number;
  bits?: number;
}

/**
 * Quantized Embedding layer
 *
 * Stores embeddings in quantized format and dequantizes during lookup.
 * This saves memory at the cost of some compute overhead.
 */
export class QuantizedEmbedding extends Module {
  readonly numEmbeddings: number;
  readonly embeddingDim: number;
  readonly groupSize: number;
  readonly bits: number;

  constructor(
    protected mx: MX,
    options: QuantizedEmbeddingOptions
  ) {
    super();
    this.numEmbeddings = options.numEmbeddings;
    this.embeddingDim = options.embeddingDim;
    this.groupSize = options.groupSize ?? 64;
    this.bits = options.bits ?? 4;
  }

  /**
   * Get the quantized weight parameter
   */
  get weight(): MLXArray {
    return this.getParameter('weight');
  }

  /**
   * Get the scales parameter
   */
  get scales(): MLXArray {
    return this.getParameter('scales');
  }

  /**
   * Get the quantization biases parameter
   */
  get quantBiases(): MLXArray {
    return this.getParameter('biases');
  }

  /**
   * Forward pass: dequantize and lookup embeddings by token IDs
   *
   * @param indices Token IDs of shape (..., seqLen)
   * @returns Embeddings of shape (..., seqLen, embeddingDim)
   */
  forward(indices: MLXArray): MLXArray {
    // Dequantize the embedding table
    const dequantize = (this.mx as unknown as {
      dequantize: (
        w: MLXArray, scales: MLXArray, biases: MLXArray | undefined,
        groupSize?: number, bits?: number
      ) => MLXArray
    }).dequantize;

    if (!dequantize) {
      throw new Error('dequantize not available in mx');
    }

    const fullWeights = dequantize(
      this.weight,
      this.scales,
      this.quantBiases,
      this.groupSize,
      this.bits
    );

    // Perform embedding lookup
    return this.mx.take(fullWeights, indices, 0);
  }

  /**
   * Use as output projection (for tied embeddings)
   * Computes: logits = x @ dequantize(weight).T
   *
   * For quantized models, we use quantized_matmul instead of dequantizing
   */
  asLinear(x: MLXArray): MLXArray {
    const quantizedMatmul = (this.mx as unknown as {
      quantized_matmul: (
        x: MLXArray, w: MLXArray, scales: MLXArray, biases: MLXArray | undefined,
        transpose?: boolean, groupSize?: number, bits?: number
      ) => MLXArray
    }).quantized_matmul;

    if (!quantizedMatmul) {
      throw new Error('quantized_matmul not available in mx');
    }

    return quantizedMatmul(
      x,
      this.weight,
      this.scales,
      this.quantBiases,
      true,  // transpose
      this.groupSize,
      this.bits
    );
  }
}
