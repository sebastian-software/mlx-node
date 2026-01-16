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
   * Get the weight parameter
   */
  get weight(): MLXArray {
    return this.getParameter('weight');
  }

  /**
   * Get the bias parameter (if present)
   */
  get bias(): MLXArray | undefined {
    return this.hasParameter('bias') ? this.getParameter('bias') : undefined;
  }

  /**
   * Forward pass: y = x @ W.T + b
   */
  forward(x: MLXArray): MLXArray {
    // x: (..., inputDim)
    // weight: (outputDim, inputDim)
    // result: (..., outputDim)
    const weightT = this.mx.transpose(this.weight);
    let out = this.mx.matmul(x, weightT);

    const bias = this.bias;
    if (bias) {
      out = this.mx.add(out, bias);
    }

    return out;
  }
}

/**
 * Quantized Linear layer for 4/8-bit weights
 *
 * Uses quantized_matmul for efficient inference with compressed weights.
 * Weights are stored as (weight, scales, biases) for affine quantization.
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
   * Get the quantization biases parameter (not output bias)
   */
  get quantBiases(): MLXArray {
    return this.getParameter('biases');
  }

  /**
   * Get the output bias parameter (if present)
   */
  get bias(): MLXArray | undefined {
    return this.hasParameter('bias') ? this.getParameter('bias') : undefined;
  }

  /**
   * Forward pass with quantized matmul
   *
   * quantized_matmul(x, w, scales, biases, transpose=True, group_size, bits)
   */
  forward(x: MLXArray): MLXArray {
    // Access quantized_matmul from mx
    const quantizedMatmul = (this.mx as unknown as {
      quantized_matmul: (
        x: MLXArray, w: MLXArray, scales: MLXArray, biases: MLXArray | undefined,
        transpose?: boolean, groupSize?: number, bits?: number
      ) => MLXArray
    }).quantized_matmul;

    if (!quantizedMatmul) {
      throw new Error('quantized_matmul not available in mx');
    }

    // Call quantized matmul: output = x @ dequantize(w).T
    let out = quantizedMatmul(
      x,
      this.weight,
      this.scales,
      this.quantBiases,
      true,  // transpose
      this.groupSize,
      this.bits
    );

    // Add output bias if present
    const bias = this.bias;
    if (bias) {
      out = this.mx.add(out, bias);
    }

    return out;
  }
}
