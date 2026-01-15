/**
 * Text generation loop
 *
 * Implements the core generation pipeline:
 * 1. Prefill (process prompt)
 * 2. Decode (generate tokens one by one)
 */

import type { MLXArray, MX } from '../types.js';
import { ModelCache } from '../cache/kv-cache.js';
import { Sampler, createSampler, type SamplerConfig } from './sampler.js';

/**
 * Generation configuration
 */
export interface GenerateConfig {
  maxTokens?: number;         // Maximum tokens to generate
  eosTokenId?: number;        // End of sequence token
  padTokenId?: number;        // Padding token (for batch)
  prefillChunkSize?: number;  // Process prompt in chunks of this size
  sampler?: SamplerConfig;    // Sampling configuration
}

/**
 * Generation result for a single step
 */
export interface GenerationStep {
  token: number;              // Generated token ID
  logprobs?: number[];        // Log probabilities (optional)
  finished: boolean;          // Whether generation is complete
}

/**
 * Model interface for generation
 */
export interface GenerativeModel {
  /**
   * Forward pass through the model
   *
   * @param tokens Input token IDs (batch, seqLen)
   * @param cache Optional KV cache
   * @returns Logits (batch, seqLen, vocabSize)
   */
  forward(tokens: MLXArray, cache?: ModelCache): MLXArray;

  /**
   * Get model configuration
   */
  readonly config: {
    vocabSize: number;
    numHiddenLayers: number;
    eosTokenId?: number;
  };

  /**
   * Create a new cache for this model
   */
  createCache(): ModelCache;
}

/**
 * Generator class for autoregressive text generation
 */
export class TextGenerator {
  private sampler: Sampler;
  private cache: ModelCache | null = null;
  private generatedTokens: number[] = [];

  constructor(
    private mx: MX,
    private model: GenerativeModel,
    private config: GenerateConfig = {}
  ) {
    this.sampler = createSampler(mx, config.sampler);
  }

  /**
   * Reset generator state
   */
  reset(): void {
    this.cache?.reset();
    this.cache = null;
    this.generatedTokens = [];
  }

  /**
   * Prefill: Process the prompt and populate KV cache
   *
   * @param promptTokens Prompt token IDs
   * @returns Logits for the last token
   */
  prefill(promptTokens: number[]): MLXArray {
    // Create fresh cache
    this.cache = this.model.createCache();
    this.generatedTokens = [];

    // Convert to MLX array
    const tokens = this.mx.array([promptTokens], 'int32');

    // Process in chunks if needed
    const chunkSize = this.config.prefillChunkSize ?? 2048;
    const seqLen = promptTokens.length;

    let logits: MLXArray;

    if (seqLen <= chunkSize) {
      // Single pass
      logits = this.model.forward(tokens, this.cache);
    } else {
      // Chunked processing
      let startIdx = 0;
      while (startIdx < seqLen) {
        const endIdx = Math.min(startIdx + chunkSize, seqLen);
        const chunk = promptTokens.slice(startIdx, endIdx);
        const chunkTokens = this.mx.array([chunk], 'int32');

        logits = this.model.forward(chunkTokens, this.cache);
        startIdx = endIdx;
      }
    }

    // Return logits for last position
    // logits shape: (batch, seqLen, vocabSize) -> (batch, vocabSize)
    const lastLogits = logits!; // TODO: Slice to get [:, -1, :]

    return lastLogits;
  }

  /**
   * Generate a single token
   *
   * @param prevToken Previous token (or last prompt token)
   * @returns Generated token and metadata
   */
  step(prevToken: number): GenerationStep {
    // Create input array
    const tokens = this.mx.array([[prevToken]], 'int32');

    // Forward pass with cache
    const logits = this.model.forward(tokens, this.cache!);

    // Get logits for this position
    // logits shape: (1, 1, vocabSize) -> (vocabSize)
    const stepLogits = logits; // TODO: Proper slicing

    // Sample next token
    const contextTokens = this.generatedTokens.length > 0
      ? this.mx.array([this.generatedTokens], 'int32')
      : undefined;

    const nextTokenArray = this.sampler.sample(stepLogits, contextTokens);

    // Extract token value
    const nextToken = nextTokenArray.item();

    // Track generated token
    this.generatedTokens.push(nextToken);

    // Check for EOS
    const eosTokenId = this.config.eosTokenId ?? this.model.config.eosTokenId;
    const finished = nextToken === eosTokenId;

    return {
      token: nextToken,
      finished
    };
  }

  /**
   * Generate tokens from a prompt
   *
   * @param promptTokens Tokenized prompt
   * @yields Generated tokens one at a time
   */
  *generate(promptTokens: number[]): Generator<GenerationStep, void, unknown> {
    const maxTokens = this.config.maxTokens ?? 256;

    // Prefill
    const initialLogits = this.prefill(promptTokens);

    // Sample first token from prompt logits
    const firstTokenArray = this.sampler.sample(initialLogits);
    const firstToken = firstTokenArray.item();
    this.generatedTokens.push(firstToken);

    const eosTokenId = this.config.eosTokenId ?? this.model.config.eosTokenId;

    yield {
      token: firstToken,
      finished: firstToken === eosTokenId
    };

    // Generate remaining tokens
    let prevToken = firstToken;
    for (let i = 1; i < maxTokens; i++) {
      const result = this.step(prevToken);
      yield result;

      if (result.finished) {
        break;
      }

      prevToken = result.token;
    }
  }

  /**
   * Generate all tokens at once (non-streaming)
   *
   * @param promptTokens Tokenized prompt
   * @returns Array of generated token IDs
   */
  generateAll(promptTokens: number[]): number[] {
    const tokens: number[] = [];

    for (const step of this.generate(promptTokens)) {
      tokens.push(step.token);
      if (step.finished) {
        break;
      }
    }

    return tokens;
  }
}

/**
 * Simple generation function
 */
export function generate(
  mx: MX,
  model: GenerativeModel,
  promptTokens: number[],
  config?: GenerateConfig
): Generator<GenerationStep, void, unknown> {
  const generator = new TextGenerator(mx, model, config);
  return generator.generate(promptTokens);
}

/**
 * Generate all tokens at once
 */
export function generateAll(
  mx: MX,
  model: GenerativeModel,
  promptTokens: number[],
  config?: GenerateConfig
): number[] {
  const generator = new TextGenerator(mx, model, config);
  return generator.generateAll(promptTokens);
}
