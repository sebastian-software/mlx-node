/**
 * Sampling algorithms for text generation
 *
 * Implements:
 * - Temperature scaling
 * - Top-K filtering
 * - Top-P (nucleus) sampling
 * - Min-P sampling
 * - Repetition penalty
 *
 * Reference implementation:
 * https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/sample_utils.py
 */

import type { MLXArray, MX } from '../types.js';

/**
 * Sampling configuration
 */
export interface SamplerConfig {
  temperature?: number;       // Temperature for scaling (0 = greedy)
  topK?: number;              // Keep top K tokens
  topP?: number;              // Keep tokens with cumulative prob <= P
  minP?: number;              // Keep tokens with prob >= minP * max_prob
  repetitionPenalty?: number; // Penalize repeated tokens
  repetitionContextSize?: number; // How many past tokens to consider
}

/**
 * Logits processor interface
 */
export interface LogitsProcessor {
  process(logits: MLXArray, context?: MLXArray): MLXArray;
}

/**
 * Temperature scaling processor
 */
export class TemperatureProcessor implements LogitsProcessor {
  constructor(
    private mx: MX,
    private temperature: number
  ) {}

  process(logits: MLXArray): MLXArray {
    if (this.temperature === 0 || this.temperature === 1) {
      return logits;
    }
    return this.mx.divide(logits, this.temperature);
  }
}

/**
 * Top-K filtering processor
 *
 * Keeps only the top K tokens, sets others to -inf.
 * Uses argpartition for efficiency (O(n) vs O(n log n) for full sort).
 *
 * Reference: https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/sample_utils.py#L62-L75
 */
export class TopKProcessor implements LogitsProcessor {
  constructor(
    private mx: MX,
    private topK: number
  ) {}

  process(logits: MLXArray): MLXArray {
    if (this.topK <= 0) {
      return logits;
    }

    const vocabSize = logits.shape[logits.ndim - 1];
    if (this.topK >= vocabSize) {
      return logits;
    }

    // Use argpartition to find indices of tokens NOT in top-k
    // argpartition(-logits, k-1) puts the k largest at the front
    const negLogits = this.mx.negative(logits);
    const partitioned = this.mx.argpartition(negLogits, this.topK - 1, -1);

    // Get indices to mask (everything after the k-th position)
    const maskIdx = this.mx.slice_axis(partitioned, -1, this.topK);

    // Set those positions to -inf
    const negInf = this.mx.full([1], -Infinity, 'float32');
    return this.mx.put_along_axis(logits, maskIdx, negInf, -1);
  }
}

/**
 * Top-P (nucleus) sampling processor
 *
 * Keeps tokens with cumulative probability <= P.
 * Works by sorting probabilities, computing cumsum, then mapping
 * the mask back to original token order.
 *
 * Reference: https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/sample_utils.py#L78-L95
 */
export class TopPProcessor implements LogitsProcessor {
  constructor(
    private mx: MX,
    private topP: number
  ) {}

  process(logits: MLXArray): MLXArray {
    if (this.topP >= 1.0) {
      return logits;
    }

    // Convert logits to probabilities
    const probs = this.mx.softmax(logits, -1);

    // Sort indices by logits (ascending order)
    const sortedIndices = this.mx.argsort(logits, -1);

    // Gather probabilities in sorted order
    const sortedProbs = this.mx.take_along_axis(probs, sortedIndices, -1);

    // Compute cumulative sum (from smallest to largest)
    const cumulativeProbs = this.mx.cumsum(sortedProbs, -1);

    // Create inverse mapping to restore original order
    const vocabSize = logits.shape[logits.ndim - 1];
    const indices = this.mx.arange(0, vocabSize);
    const zerosLike = this.mx.zeros([vocabSize], 'int32');
    const inverseIndices = this.mx.put_along_axis(zerosLike, sortedIndices, indices, -1);

    // Map cumulative probs back to original order
    const cumulativeProbsOriginal = this.mx.take_along_axis(cumulativeProbs, inverseIndices, -1);

    // Keep tokens where cumulative prob > (1 - topP)
    // This means: tokens in the top-P nucleus
    const threshold = 1.0 - this.topP;
    const keepMask = this.mx.greater(cumulativeProbsOriginal, threshold);

    // Apply mask: keep tokens in nucleus, set others to -inf
    const negInf = this.mx.full([1], -Infinity, 'float32');
    return this.mx.where(keepMask, logits, negInf);
  }
}

/**
 * Min-P sampling processor
 *
 * Keeps tokens with probability >= minP * max_probability.
 * Works in log space for numerical stability.
 * Always keeps at least minTokensToKeep tokens.
 *
 * Reference: https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/sample_utils.py#L98-L124
 */
export class MinPProcessor implements LogitsProcessor {
  constructor(
    private mx: MX,
    private minP: number,
    private minTokensToKeep: number = 1
  ) {}

  process(logits: MLXArray): MLXArray {
    if (this.minP <= 0) {
      return logits;
    }

    // Work in log space: log(minP * max_prob) = log(minP) + max_logit - logsumexp
    // But simpler: compare probs directly since softmax is computed anyway

    // Sort by logits descending
    const negLogits = this.mx.negative(logits);
    const sortedIndices = this.mx.argsort(negLogits, -1);
    const sortedLogits = this.mx.take_along_axis(logits, sortedIndices, -1);

    // Get max logit (first in sorted order)
    const maxLogit = this.mx.slice_axis(sortedLogits, -1, 0, 1);

    // Threshold in log space: log(minP) + maxLogit
    // token is kept if logit >= maxLogit + log(minP)
    const logMinP = Math.log(this.minP);
    const scaledThreshold = this.mx.add(maxLogit, logMinP);

    // Create mask for tokens to remove
    const tokensToRemove = this.mx.less(sortedLogits, scaledThreshold);

    // Always keep at least minTokensToKeep tokens
    // Set the first minTokensToKeep positions to false (don't remove)
    const vocabSize = logits.shape[logits.ndim - 1];
    const keepIndices = this.mx.arange(0, vocabSize);
    const alwaysKeep = this.mx.less(keepIndices, this.minTokensToKeep);
    const falseArray = this.mx.zeros([1], 'bool');
    const finalMask = this.mx.where(alwaysKeep, falseArray, tokensToRemove);

    // Apply mask in sorted order
    const negInf = this.mx.full([1], -Infinity, 'float32');
    const maskedSortedLogits = this.mx.where(finalMask, negInf, sortedLogits);

    // Map back to original order
    const indices = this.mx.arange(0, vocabSize);
    const zerosLike = this.mx.zeros([vocabSize], 'int32');
    const inverseIndices = this.mx.put_along_axis(zerosLike, sortedIndices, indices, -1);

    return this.mx.take_along_axis(maskedSortedLogits, inverseIndices, -1);
  }
}

/**
 * Repetition penalty processor
 *
 * Penalizes tokens that appeared in the context.
 * For positive logits: divide by penalty (reduce probability)
 * For negative logits: multiply by penalty (reduce probability)
 *
 * Reference: https://github.com/ml-explore/mlx-lm/blob/main/mlx_lm/sample_utils.py#L127-L148
 */
export class RepetitionPenaltyProcessor implements LogitsProcessor {
  constructor(
    private mx: MX,
    private penalty: number,
    private contextSize: number = 20
  ) {}

  process(logits: MLXArray, context?: MLXArray): MLXArray {
    if (this.penalty === 1.0 || !context || context.size === 0) {
      return logits;
    }

    // Get the last contextSize tokens
    const contextLen = context.shape[context.ndim - 1];
    const tokens = contextLen > this.contextSize
      ? this.mx.slice_axis(context, -1, -this.contextSize)
      : context;

    // Flatten to 1D and ensure int32
    const flatTokens = this.mx.reshape(tokens, [-1]);

    // Get logits for tokens in context
    const selectedLogits = this.mx.take_along_axis(
      this.mx.expand_dims(logits, 0),
      this.mx.expand_dims(flatTokens, 0),
      -1
    );

    // Apply penalty based on sign
    // positive logits: divide by penalty
    // negative logits: multiply by penalty
    const isNegative = this.mx.less(selectedLogits, 0);
    const penaltyTensor = this.mx.full([1], this.penalty, 'float32');

    const penalizedSelected = this.mx.where(
      isNegative,
      this.mx.multiply(selectedLogits, penaltyTensor),
      this.mx.divide(selectedLogits, penaltyTensor)
    );

    // Put penalized values back
    const result = this.mx.put_along_axis(
      this.mx.expand_dims(logits, 0),
      this.mx.expand_dims(flatTokens, 0),
      penalizedSelected,
      -1
    );

    return this.mx.squeeze(result, 0);
  }
}

/**
 * Combined sampler with all processors
 */
export class Sampler {
  private processors: LogitsProcessor[] = [];

  constructor(
    private mx: MX,
    config: SamplerConfig = {}
  ) {
    // Add processors in order

    // Repetition penalty first (before temperature)
    if (config.repetitionPenalty && config.repetitionPenalty !== 1.0) {
      this.processors.push(
        new RepetitionPenaltyProcessor(
          mx,
          config.repetitionPenalty,
          config.repetitionContextSize
        )
      );
    }

    // Top-K (before temperature for efficiency)
    if (config.topK && config.topK > 0) {
      this.processors.push(new TopKProcessor(mx, config.topK));
    }

    // Temperature
    const temp = config.temperature ?? 1.0;
    if (temp !== 1.0) {
      this.processors.push(new TemperatureProcessor(mx, temp));
    }

    // Top-P
    if (config.topP && config.topP < 1.0) {
      this.processors.push(new TopPProcessor(mx, config.topP));
    }

    // Min-P
    if (config.minP && config.minP > 0) {
      this.processors.push(new MinPProcessor(mx, config.minP));
    }
  }

  /**
   * Sample a token from logits
   *
   * @param logits Logits of shape (batch, vocabSize)
   * @param context Optional context tokens for repetition penalty
   * @returns Sampled token IDs of shape (batch,)
   */
  sample(logits: MLXArray, context?: MLXArray): MLXArray {
    // Apply all processors
    let processed = logits;
    for (const processor of this.processors) {
      processed = processor.process(processed, context);
    }

    // Check for greedy decoding
    const isGreedy = this.processors.some(
      p => p instanceof TemperatureProcessor && (p as TemperatureProcessor)['temperature'] === 0
    );

    if (isGreedy) {
      // Greedy: take argmax
      return this.mx.argmax(processed, -1);
    }

    // Sample from categorical distribution
    return this.mx.random.categorical(processed, -1);
  }
}

/**
 * Create a sampler from config
 */
export function createSampler(mx: MX, config?: SamplerConfig): Sampler {
  return new Sampler(mx, config ?? {});
}

/**
 * Greedy sampler (always picks most likely token)
 */
export function greedySampler(mx: MX): Sampler {
  return new Sampler(mx, { temperature: 0 });
}
