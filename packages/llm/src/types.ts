/**
 * Core types for @mlx-node/llm
 *
 * These types match the mlx-node API which uses Python-style snake_case.
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
 *
 * Uses snake_case to match mlx-node's Python-derived API.
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
  erf(a: MLXArray): MLXArray;
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

  // Sorting and searching
  sort(a: MLXArray, axis?: number): MLXArray;
  argsort(a: MLXArray, axis?: number): MLXArray;
  partition(a: MLXArray, kth: number, axis?: number): MLXArray;
  argpartition(a: MLXArray, kth: number, axis?: number): MLXArray;
  topk(a: MLXArray, k: number, axis?: number): MLXArray;

  // Cumulative operations
  cumsum(a: MLXArray, axis?: number, reverse?: boolean, inclusive?: boolean): MLXArray;
  cumprod(a: MLXArray, axis?: number, reverse?: boolean, inclusive?: boolean): MLXArray;

  // Shape operations (snake_case to match mlx-node)
  reshape(a: MLXArray, shape: number[]): MLXArray;
  transpose(a: MLXArray, axes?: number[]): MLXArray;
  squeeze(a: MLXArray, axis?: number | number[]): MLXArray;
  expand_dims(a: MLXArray, axis: number | number[]): MLXArray;
  concatenate(arrays: MLXArray[], axis?: number): MLXArray;
  split(a: MLXArray, indices: number | number[], axis?: number): MLXArray[];
  stack(arrays: MLXArray[], axis?: number): MLXArray;
  take(a: MLXArray, indices: MLXArray, axis?: number): MLXArray;
  take_along_axis(a: MLXArray, indices: MLXArray, axis: number): MLXArray;
  put_along_axis(a: MLXArray, indices: MLXArray, values: MLXArray, axis: number): MLXArray;
  broadcast_to(a: MLXArray, shape: number[]): MLXArray;

  // LLM utility functions
  /**
   * Repeat elements along an axis (for GQA KV head expansion)
   * Unlike repeat which tiles the whole array, this repeats each element:
   * [a,b,c] with repeats=2 -> [a,a,b,b,c,c]
   */
  repeat_interleave(a: MLXArray, repeats: number, axis?: number): MLXArray;

  /**
   * Take the last element along an axis (for logits extraction)
   * Equivalent to arr[:, -1, :] when axis=1
   */
  take_last(a: MLXArray, axis: number, keepdims?: boolean): MLXArray;

  /**
   * Slice along a single axis (for KV cache operations)
   * Equivalent to arr[:, start:end, :] when axis=1
   */
  slice_axis(a: MLXArray, axis: number, start?: number, end?: number): MLXArray;

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
  not_equal(a: MLXArray, b: MLXArray | number): MLXArray;
  less(a: MLXArray, b: MLXArray | number): MLXArray;
  less_equal(a: MLXArray, b: MLXArray | number): MLXArray;
  greater(a: MLXArray, b: MLXArray | number): MLXArray;
  greater_equal(a: MLXArray, b: MLXArray | number): MLXArray;

  // Random
  random: {
    categorical(logits: MLXArray, axis?: number, shape?: number[], numSamples?: number): MLXArray;
    uniform(low?: number, high?: number, shape?: number[], dtype?: DtypeCategory): MLXArray;
    normal(shape?: number[], dtype?: DtypeCategory): MLXArray;
  };

  // Fast operations (optimized kernels)
  fast: {
    rmsNorm(x: MLXArray, weight: MLXArray | null, eps: number): MLXArray;
    /**
     * Apply rotary position embeddings to a single array
     * @param x Input array of shape (batch, seqLen, nHeads, headDim)
     * @param dims Number of dimensions to apply RoPE to
     * @param traditional Use traditional RoPE formulation
     * @param base Base frequency for position encoding
     * @param scale Scaling factor
     * @param offset Position offset for incremental decoding
     */
    rope(
      x: MLXArray,
      dims: number,
      traditional?: boolean,
      base?: number,
      scale?: number,
      offset?: number
    ): MLXArray;
    /**
     * Scaled dot-product attention
     * @param q Query tensor
     * @param k Key tensor
     * @param v Value tensor
     * @param scale Attention scale factor
     * @param maskMode Mask mode: "" (custom mask), "causal", etc.
     * @param mask Optional custom mask array
     */
    scaledDotProductAttention(
      q: MLXArray,
      k: MLXArray,
      v: MLXArray,
      scale: number,
      maskMode?: string,
      mask?: MLXArray
    ): MLXArray;
  };

  // I/O
  load(filepath: string): Record<string, MLXArray>;
  save(filepath: string, arrays: Record<string, MLXArray>): void;
  load_safetensors(filepath: string): Weights;
  save_safetensors(filepath: string, arrays: Weights, metadata?: Record<string, string>): void;

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
