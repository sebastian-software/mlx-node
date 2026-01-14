/**
 * Core types for @mlx-node/llm
 */

// Re-export MLX types - these will come from mlx-node once bindings are complete
// For now, define interfaces that match the expected API

export interface MLXArray {
  readonly shape: number[];
  readonly ndim: number;
  readonly size: number;
  readonly dtype: Dtype;
  readonly itemsize: number;
  readonly nbytes: number;
  readonly T: MLXArray;

  reshape(shape: number[]): MLXArray;
  astype(dtype: DtypeCategory): MLXArray;
  tolist(): number | number[] | number[][] | number[][][];
  item(): number;
}

export type DtypeCategory =
  | 'bool'
  | 'uint8' | 'uint16' | 'uint32' | 'uint64'
  | 'int8' | 'int16' | 'int32' | 'int64'
  | 'float16' | 'float32' | 'float64' | 'bfloat16'
  | 'complex64';

export interface Dtype {
  readonly size: number;
}

export type StreamOrDevice = unknown;

/**
 * MLX Core operations interface
 * This will be populated from mlx-node bindings
 */
export interface MX {
  // Array creation
  array(data: ArrayLike, dtype?: DtypeCategory): MLXArray;
  zeros(shape: number[], dtype?: DtypeCategory): MLXArray;
  ones(shape: number[], dtype?: DtypeCategory): MLXArray;
  full(shape: number[], value: number, dtype?: DtypeCategory): MLXArray;
  arange(start: number, stop?: number, step?: number, dtype?: DtypeCategory): MLXArray;

  // Array operations
  add(a: MLXArray, b: MLXArray | number): MLXArray;
  subtract(a: MLXArray, b: MLXArray | number): MLXArray;
  multiply(a: MLXArray, b: MLXArray | number): MLXArray;
  divide(a: MLXArray, b: MLXArray | number): MLXArray;
  matmul(a: MLXArray, b: MLXArray): MLXArray;
  sqrt(a: MLXArray): MLXArray;
  rsqrt(a: MLXArray): MLXArray;
  exp(a: MLXArray): MLXArray;
  log(a: MLXArray): MLXArray;
  abs(a: MLXArray): MLXArray;
  negative(a: MLXArray): MLXArray;
  square(a: MLXArray): MLXArray;
  power(a: MLXArray, b: MLXArray | number): MLXArray;
  maximum(a: MLXArray, b: MLXArray | number): MLXArray;
  minimum(a: MLXArray, b: MLXArray | number): MLXArray;
  clip(a: MLXArray, min: number | null, max: number | null): MLXArray;

  // Reductions
  sum(a: MLXArray, axis?: number | number[], keepdims?: boolean): MLXArray;
  mean(a: MLXArray, axis?: number | number[], keepdims?: boolean): MLXArray;
  max(a: MLXArray, axis?: number | number[], keepdims?: boolean): MLXArray;
  min(a: MLXArray, axis?: number | number[], keepdims?: boolean): MLXArray;
  argmax(a: MLXArray, axis?: number, keepdims?: boolean): MLXArray;
  argmin(a: MLXArray, axis?: number, keepdims?: boolean): MLXArray;

  // Shape operations
  reshape(a: MLXArray, shape: number[]): MLXArray;
  transpose(a: MLXArray, axes?: number[]): MLXArray;
  squeeze(a: MLXArray, axis?: number | number[]): MLXArray;
  expandDims(a: MLXArray, axis: number | number[]): MLXArray;
  concatenate(arrays: MLXArray[], axis?: number): MLXArray;
  split(a: MLXArray, indices: number | number[], axis?: number): MLXArray[];
  stack(arrays: MLXArray[], axis?: number): MLXArray;
  take(a: MLXArray, indices: MLXArray, axis?: number): MLXArray;

  // Activations
  softmax(a: MLXArray, axis?: number): MLXArray;
  sigmoid(a: MLXArray): MLXArray;
  relu(a: MLXArray): MLXArray;
  gelu(a: MLXArray): MLXArray;
  silu(a: MLXArray): MLXArray;
  tanh(a: MLXArray): MLXArray;

  // Comparison
  where(condition: MLXArray, x: MLXArray, y: MLXArray): MLXArray;
  equal(a: MLXArray, b: MLXArray | number): MLXArray;
  notEqual(a: MLXArray, b: MLXArray | number): MLXArray;
  less(a: MLXArray, b: MLXArray | number): MLXArray;
  lessEqual(a: MLXArray, b: MLXArray | number): MLXArray;
  greater(a: MLXArray, b: MLXArray | number): MLXArray;
  greaterEqual(a: MLXArray, b: MLXArray | number): MLXArray;

  // Random
  random: {
    categorical(logits: MLXArray, axis?: number, shape?: number[], numSamples?: number): MLXArray;
    uniform(low?: number, high?: number, shape?: number[], dtype?: DtypeCategory): MLXArray;
    normal(shape?: number[], dtype?: DtypeCategory): MLXArray;
  };

  // Fast operations (optimized kernels)
  fast: {
    rmsNorm(x: MLXArray, weight: MLXArray | null, eps: number): MLXArray;
    rope(
      q: MLXArray,
      k: MLXArray,
      dims: number,
      traditional?: boolean,
      base?: number,
      scale?: number,
      offset?: number | MLXArray
    ): [MLXArray, MLXArray];
    scaledDotProductAttention(
      q: MLXArray,
      k: MLXArray,
      v: MLXArray,
      scale: number,
      mask?: MLXArray
    ): MLXArray;
  };

  // I/O
  load(filepath: string): Record<string, MLXArray>;
  save(filepath: string, arrays: Record<string, MLXArray>): void;

  // Evaluation
  eval(...arrays: MLXArray[]): void;
}

export type ArrayLike =
  | number
  | boolean
  | number[]
  | number[][]
  | number[][][]
  | number[][][][]
  | boolean[]
  | MLXArray;

/**
 * Model configuration base
 */
export interface BaseModelArgs {
  vocabSize: number;
  hiddenSize: number;
  numHiddenLayers: number;
  numAttentionHeads: number;
  numKeyValueHeads?: number;
  intermediateSize?: number;
  headDim?: number;
  rmsNormEps?: number;
  ropeTheta?: number;
  ropeTraditional?: boolean;
  maxPositionEmbeddings?: number;
  tieWordEmbeddings?: boolean;
}

/**
 * Weight map from safetensors
 */
export type Weights = Record<string, MLXArray>;
