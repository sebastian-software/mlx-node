/**
 * MLX Node.js Bindings Type Definitions
 */

// Core Types
export type DtypeString =
  | 'bool' | 'uint8' | 'uint16' | 'uint32' | 'uint64'
  | 'int8' | 'int16' | 'int32' | 'int64'
  | 'float16' | 'float32' | 'float64' | 'bfloat16'
  | 'complex64';

export interface Dtype {
  readonly size: number;
}

export type DeviceType = 'cpu' | 'gpu';

export interface Device {
  readonly type: DeviceType;
}

export interface Stream {
  readonly device: Device;
}

export type StreamOrDevice = Stream | Device | undefined;

// Array-like input types
export type ArrayLike =
  | MLXArray
  | number
  | number[]
  | number[][]
  | number[][][]
  | boolean
  | boolean[]
  | Float32Array
  | Float64Array
  | Int32Array;

/**
 * MLX N-dimensional array
 */
export declare class MLXArray {
  /** Array shape */
  readonly shape: number[];
  /** Number of dimensions */
  readonly ndim: number;
  /** Total number of elements */
  readonly size: number;
  /** Data type */
  readonly dtype: DtypeString;
  /** Number of bytes per element */
  readonly itemsize: number;
  /** Total number of bytes */
  readonly nbytes: number;

  /** Create array from data */
  constructor(data?: ArrayLike, dtype?: DtypeString);

  /** Convert to JavaScript array */
  tolist(): number | number[] | number[][] | number[][][];

  /** Get scalar value */
  item(): number;

  /** Reshape the array */
  reshape(shape: number[]): MLXArray;

  /** Cast to different dtype */
  astype(dtype: DtypeString, stream?: StreamOrDevice): MLXArray;
}

// Dtype constants
export declare const bool: DtypeString;
export declare const uint8: DtypeString;
export declare const uint16: DtypeString;
export declare const uint32: DtypeString;
export declare const uint64: DtypeString;
export declare const int8: DtypeString;
export declare const int16: DtypeString;
export declare const int32: DtypeString;
export declare const int64: DtypeString;
export declare const float16: DtypeString;
export declare const float32: DtypeString;
export declare const float64: DtypeString;
export declare const bfloat16: DtypeString;
export declare const complex64: DtypeString;

// Alias for Python-like API
export { MLXArray as array };

// Core module (all native exports)
export declare const core: typeof import('./index');

// Default export
declare const mlx: {
  array: typeof MLXArray;
  MLXArray: typeof MLXArray;
  bool: DtypeString;
  uint8: DtypeString;
  uint16: DtypeString;
  uint32: DtypeString;
  uint64: DtypeString;
  int8: DtypeString;
  int16: DtypeString;
  int32: DtypeString;
  int64: DtypeString;
  float16: DtypeString;
  float32: DtypeString;
  float64: DtypeString;
  bfloat16: DtypeString;
  complex64: DtypeString;
  // Additional functions will be added here
  [key: string]: unknown;
};

export default mlx;
