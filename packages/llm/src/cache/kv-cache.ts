/**
 * Key-Value Cache implementations for efficient autoregressive generation
 *
 * Implements:
 * - KVCache: Standard cache with dynamic allocation
 * - RotatingKVCache: Circular buffer for sliding window attention
 */

import type { MLXArray, MX } from '../types.js';

/**
 * Cache entry for a single layer
 */
export interface CacheEntry {
  keys: MLXArray | null;
  values: MLXArray | null;
}

/**
 * Standard KV Cache
 *
 * Stores key-value pairs for all previous positions.
 * Allocates in chunks for efficiency.
 */
export class KVCache {
  private keys: MLXArray | null = null;
  private values: MLXArray | null = null;
  private offset = 0;
  private readonly step: number;

  constructor(
    private mx: MX,
    options?: { step?: number }
  ) {
    // Allocation chunk size
    this.step = options?.step ?? 256;
  }

  /**
   * Get current sequence length in cache
   */
  get length(): number {
    return this.offset;
  }

  /**
   * Check if cache is empty
   */
  get isEmpty(): boolean {
    return this.offset === 0;
  }

  /**
   * Update cache with new keys and values
   *
   * @param keys New keys of shape (batch, seqLen, nKVHeads, headDim)
   * @param values New values of shape (batch, seqLen, nKVHeads, headDim)
   * @returns Full keys and values including history
   */
  update(keys: MLXArray, values: MLXArray): [MLXArray, MLXArray] {
    const seqLen = keys.shape[1];

    if (this.keys === null || this.values === null) {
      // First call - allocate initial cache
      const [batch, , nKVHeads, headDim] = keys.shape;
      const allocLen = Math.ceil((seqLen + this.step) / this.step) * this.step;

      this.keys = this.mx.zeros([batch, allocLen, nKVHeads, headDim], 'float16');
      this.values = this.mx.zeros([batch, allocLen, nKVHeads, headDim], 'float16');
    }

    // Check if we need to grow the cache
    const currentAlloc = this.keys.shape[1];
    if (this.offset + seqLen > currentAlloc) {
      const [batch, , nKVHeads, headDim] = this.keys.shape;
      const newAllocLen = Math.ceil((this.offset + seqLen + this.step) / this.step) * this.step;

      // Get existing data (only up to current offset)
      const existingKeys = this.mx.slice_axis(this.keys, 1, 0, this.offset);
      const existingValues = this.mx.slice_axis(this.values, 1, 0, this.offset);

      // Create new larger arrays and concatenate
      const padding = this.mx.zeros([batch, newAllocLen - this.offset, nKVHeads, headDim], 'float16');
      this.keys = this.mx.concatenate([existingKeys, padding], 1);
      this.values = this.mx.concatenate([existingValues, padding], 1);
    }

    // Update cache at current offset
    if (this.offset === 0) {
      this.keys = keys;
      this.values = values;
    } else {
      // Get existing data up to current offset
      const prevKeys = this.mx.slice_axis(this.keys, 1, 0, this.offset);
      const prevValues = this.mx.slice_axis(this.values, 1, 0, this.offset);

      // Concatenate with new keys/values
      this.keys = this.mx.concatenate([prevKeys, keys], 1);
      this.values = this.mx.concatenate([prevValues, values], 1);
    }

    this.offset += seqLen;

    return [this.keys, this.values];
  }

  /**
   * Reset the cache
   */
  reset(): void {
    this.keys = null;
    this.values = null;
    this.offset = 0;
  }

  /**
   * Get current cache state (for inspection)
   */
  getState(): CacheEntry {
    return {
      keys: this.keys,
      values: this.values
    };
  }
}

/**
 * Rotating KV Cache for Sliding Window Attention
 *
 * Implements a circular buffer that keeps the most recent `maxSize` positions.
 * Used for models with sliding window attention like Gemma3 local layers.
 */
export class RotatingKVCache {
  private keys: MLXArray | null = null;
  private values: MLXArray | null = null;
  private offset = 0;
  private readonly maxSize: number;
  private readonly keepFirst: number;

  constructor(
    private mx: MX,
    options: {
      maxSize: number;       // Sliding window size
      keepFirst?: number;    // Keep first N tokens (for special tokens)
    }
  ) {
    this.maxSize = options.maxSize;
    this.keepFirst = options.keepFirst ?? 0;
  }

  /**
   * Get current sequence length (may be less than total tokens seen)
   */
  get length(): number {
    if (this.keys === null) return 0;
    return Math.min(this.offset, this.maxSize + this.keepFirst);
  }

  /**
   * Get total tokens seen (including evicted ones)
   */
  get totalSeen(): number {
    return this.offset;
  }

  /**
   * Check if cache is empty
   */
  get isEmpty(): boolean {
    return this.offset === 0;
  }

  /**
   * Update cache with new keys and values
   *
   * When cache exceeds maxSize, oldest entries (except first keepFirst)
   * are overwritten in a circular fashion.
   *
   * @param keys New keys of shape (batch, seqLen, nKVHeads, headDim)
   * @param values New values of shape (batch, seqLen, nKVHeads, headDim)
   * @returns Keys and values within the sliding window
   */
  update(keys: MLXArray, values: MLXArray): [MLXArray, MLXArray] {
    const seqLen = keys.shape[1];

    if (this.keys === null || this.values === null) {
      // First call - just store directly
      this.keys = keys;
      this.values = values;
      this.offset = seqLen;
      return [this.keys, this.values];
    }

    // Concatenate new tokens
    this.keys = this.mx.concatenate([this.keys, keys], 1);
    this.values = this.mx.concatenate([this.values, values], 1);
    this.offset += seqLen;

    // Apply sliding window if exceeds maxSize
    const totalLen = this.keys.shape[1];
    const maxLen = this.maxSize + this.keepFirst;

    if (totalLen > maxLen) {
      // Keep first `keepFirst` tokens + last `maxSize` tokens
      if (this.keepFirst > 0) {
        // Get first keepFirst tokens
        const firstKeys = this.mx.slice_axis(this.keys, 1, 0, this.keepFirst);
        const firstValues = this.mx.slice_axis(this.values, 1, 0, this.keepFirst);

        // Get last maxSize tokens (negative indexing)
        const lastKeys = this.mx.slice_axis(this.keys, 1, -this.maxSize);
        const lastValues = this.mx.slice_axis(this.values, 1, -this.maxSize);

        // Combine: [first N] + [last maxSize]
        this.keys = this.mx.concatenate([firstKeys, lastKeys], 1);
        this.values = this.mx.concatenate([firstValues, lastValues], 1);
      } else {
        // Simple case: just keep last maxLen tokens
        this.keys = this.mx.slice_axis(this.keys, 1, -maxLen);
        this.values = this.mx.slice_axis(this.values, 1, -maxLen);
      }
    }

    return [this.keys, this.values];
  }

  /**
   * Get the attention mask for sliding window
   *
   * Returns a mask where positions outside the window are masked out.
   */
  getWindowMask(queryLen: number): MLXArray | null {
    if (this.offset <= this.maxSize + this.keepFirst) {
      // No masking needed - within window
      return null;
    }

    // TODO: Create proper sliding window mask
    // Shape: (queryLen, keyLen) where keyLen = min(offset, maxSize + keepFirst)
    return null;
  }

  /**
   * Reset the cache
   */
  reset(): void {
    this.keys = null;
    this.values = null;
    this.offset = 0;
  }

  /**
   * Get current cache state
   */
  getState(): CacheEntry {
    return {
      keys: this.keys,
      values: this.values
    };
  }
}

/**
 * Cache for an entire model (all layers)
 */
export class ModelCache {
  private caches: (KVCache | RotatingKVCache)[] = [];

  constructor(
    private mx: MX,
    private numLayers: number,
    private config?: {
      // Per-layer cache configuration
      // For models like Gemma3 with interleaved attention
      layerConfigs?: Array<{
        type: 'standard' | 'rotating';
        windowSize?: number;
      }>;
    }
  ) {
    this.initializeCaches();
  }

  private initializeCaches(): void {
    for (let i = 0; i < this.numLayers; i++) {
      const layerConfig = this.config?.layerConfigs?.[i];

      if (layerConfig?.type === 'rotating' && layerConfig.windowSize) {
        this.caches.push(
          new RotatingKVCache(this.mx, { maxSize: layerConfig.windowSize })
        );
      } else {
        this.caches.push(new KVCache(this.mx));
      }
    }
  }

  /**
   * Get cache for a specific layer
   */
  getLayerCache(layerIndex: number): KVCache | RotatingKVCache {
    return this.caches[layerIndex];
  }

  /**
   * Get current offset (sequence length)
   */
  get offset(): number {
    return this.caches[0]?.length ?? 0;
  }

  /**
   * Reset all layer caches
   */
  reset(): void {
    for (const cache of this.caches) {
      cache.reset();
    }
  }
}
