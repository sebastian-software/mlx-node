/**
 * Linear (fully connected) layer
 *
 * Computes: y = x @ weight.T + bias
 */

import type { MLXArray, MX } from '../types.js';
import { Module } from './module.js';

export interface LinearOptions {
  inputDim: number;
  outputDim: number;
  bias?: boolean;
}

export class Linear extends Module {
  readonly inputDim: number;
  readonly outputDim: number;
  readonly hasBias: boolean;

  private weight!: MLXArray;
  private bias: MLXArray | null = null;

  constructor(
    private mx: MX,
    options: LinearOptions
  ) {
    super();
    this.inputDim = options.inputDim;
    this.outputDim = options.outputDim;
    this.hasBias = options.bias ?? true;
  }

  /**
   * Initialize with weight tensors
   */
  initialize(weight: MLXArray, bias?: MLXArray): void {
    this.weight = weight;
    this.registerParameter('weight', weight);

    if (bias && this.hasBias) {
      this.bias = bias;
      this.registerParameter('bias', bias);
    }
  }

  /**
   * Forward pass: y = x @ W.T + b
   */
  forward(x: MLXArray): MLXArray {
    // x: (..., inputDim)
    // weight: (outputDim, inputDim)
    // result: (..., outputDim)
    let out = this.mx.matmul(x, this.weight.T);

    if (this.bias) {
      out = this.mx.add(out, this.bias);
    }

    return out;
  }
}

/**
 * Quantized Linear layer for 4/8-bit weights
 */
export interface QuantizedLinearOptions extends LinearOptions {
  groupSize?: number;
  bits?: number;
}

export class QuantizedLinear extends Module {
  readonly inputDim: number;
  readonly outputDim: number;
  readonly hasBias: boolean;
  readonly groupSize: number;
  readonly bits: number;

  private weight!: MLXArray;
  private scales!: MLXArray;
  private biases!: MLXArray;
  private bias: MLXArray | null = null;

  constructor(
    private mx: MX,
    options: QuantizedLinearOptions
  ) {
    super();
    this.inputDim = options.inputDim;
    this.outputDim = options.outputDim;
    this.hasBias = options.bias ?? true;
    this.groupSize = options.groupSize ?? 64;
    this.bits = options.bits ?? 4;
  }

  /**
   * Initialize with quantized weight tensors
   */
  initialize(
    weight: MLXArray,
    scales: MLXArray,
    biases: MLXArray,
    bias?: MLXArray
  ): void {
    this.weight = weight;
    this.scales = scales;
    this.biases = biases;
    this.registerParameter('weight', weight);
    this.registerParameter('scales', scales);
    this.registerParameter('biases', biases);

    if (bias && this.hasBias) {
      this.bias = bias;
      this.registerParameter('bias', bias);
    }
  }

  /**
   * Forward pass with quantized matmul
   * Note: This requires mx.quantized_matmul or similar
   */
  forward(x: MLXArray): MLXArray {
    // TODO: Use quantized matmul when available
    // For now, this is a placeholder that would need the actual
    // quantized matmul implementation from mlx-node
    throw new Error('QuantizedLinear requires quantized_matmul support in mlx-node');
  }
}
