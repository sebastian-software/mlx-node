/**
 * MLP (Feed-Forward Network) variants
 *
 * Implements:
 * - Standard MLP (Linear → Activation → Linear)
 * - Gated MLP (SwiGLU, GeGLU, etc.)
 * - Mixture of Experts (MoE)
 */

import type { MLXArray, MX } from '../types.js';
import { Module, ModuleList } from './module.js';
import { Linear } from './linear.js';

/**
 * Activation function types
 */
export type ActivationType = 'relu' | 'gelu' | 'silu' | 'tanh' | 'sigmoid';

/**
 * Standard MLP configuration
 */
export interface MLPConfig {
  hiddenSize: number;
  intermediateSize: number;
  activation?: ActivationType;
  bias?: boolean;
}

/**
 * Gated MLP configuration (SwiGLU, etc.)
 */
export interface GatedMLPConfig extends MLPConfig {
  gatedActivation: boolean;
}

/**
 * Mixture of Experts configuration
 */
export interface MoEConfig {
  hiddenSize: number;
  intermediateSize: number;
  numExperts: number;
  topK: number;
  activation?: ActivationType;
  bias?: boolean;
  routerBias?: boolean;
}

/**
 * Standard MLP
 *
 * y = down(activation(up(x)))
 */
export class MLP extends Module {
  protected upProj!: Linear;
  protected downProj!: Linear;
  protected activation: ActivationType;

  constructor(
    protected mx: MX,
    config: MLPConfig
  ) {
    super();
    this.activation = config.activation ?? 'silu';

    this.upProj = new Linear(mx, {
      inputDim: config.hiddenSize,
      outputDim: config.intermediateSize,
      bias: config.bias ?? false
    });
    this.registerModule('up_proj', this.upProj);

    this.downProj = new Linear(mx, {
      inputDim: config.intermediateSize,
      outputDim: config.hiddenSize,
      bias: config.bias ?? false
    });
    this.registerModule('down_proj', this.downProj);
  }

  /**
   * Apply activation function
   */
  protected applyActivation(x: MLXArray): MLXArray {
    switch (this.activation) {
      case 'relu':
        return this.mx.relu(x);
      case 'gelu':
        return this.mx.gelu(x);
      case 'silu':
        return this.mx.silu(x);
      case 'tanh':
        return this.mx.tanh(x);
      case 'sigmoid':
        return this.mx.sigmoid(x);
      default:
        return this.mx.silu(x);
    }
  }

  forward(x: MLXArray): MLXArray {
    const up = this.upProj.forward(x);
    const activated = this.applyActivation(up);
    return this.downProj.forward(activated);
  }
}

/**
 * Gated MLP (SwiGLU, GeGLU, etc.)
 *
 * y = down(activation(gate(x)) * up(x))
 *
 * Used by LLaMA, Gemma, Mistral, etc.
 */
export class GatedMLP extends MLP {
  protected gateProj!: Linear;

  constructor(
    mx: MX,
    config: GatedMLPConfig
  ) {
    super(mx, config);

    this.gateProj = new Linear(mx, {
      inputDim: config.hiddenSize,
      outputDim: config.intermediateSize,
      bias: config.bias ?? false
    });
    this.registerModule('gate_proj', this.gateProj);
  }

  forward(x: MLXArray): MLXArray {
    // gate(x) * activation(up(x))
    const gate = this.gateProj.forward(x);
    const up = this.upProj.forward(x);

    const gateActivated = this.applyActivation(gate);
    const gatedUp = this.mx.multiply(gateActivated, up);

    return this.downProj.forward(gatedUp);
  }
}

/**
 * Single Expert MLP (used within MoE)
 */
class Expert extends GatedMLP {
  constructor(
    mx: MX,
    config: {
      hiddenSize: number;
      intermediateSize: number;
      activation?: ActivationType;
      bias?: boolean;
    }
  ) {
    super(mx, { ...config, gatedActivation: true });
  }
}

/**
 * Mixture of Experts MLP
 *
 * Routes each token to top-K experts and combines their outputs.
 * Used by GPT-OSS, Mixtral, etc.
 */
export class MixtureOfExperts extends Module {
  readonly numExperts: number;
  readonly topK: number;

  private router!: Linear;
  private experts!: ModuleList;

  constructor(
    private mx: MX,
    config: MoEConfig
  ) {
    super();
    this.numExperts = config.numExperts;
    this.topK = config.topK;

    // Router: projects hidden state to expert logits
    this.router = new Linear(mx, {
      inputDim: config.hiddenSize,
      outputDim: config.numExperts,
      bias: config.routerBias ?? false
    });
    this.registerModule('router', this.router);

    // Create experts
    const expertConfigs = {
      hiddenSize: config.hiddenSize,
      intermediateSize: config.intermediateSize,
      activation: config.activation,
      bias: config.bias
    };

    const experts: Expert[] = [];
    for (let i = 0; i < config.numExperts; i++) {
      experts.push(new Expert(mx, expertConfigs));
    }
    this.experts = new ModuleList(experts);
    this.registerModule('experts', this.experts);
  }

  /**
   * Compute top-K routing
   */
  private computeRouting(x: MLXArray): {
    expertIndices: MLXArray;
    expertWeights: MLXArray;
  } {
    // x: (batch, seqLen, hiddenSize)
    // Router logits: (batch, seqLen, numExperts)
    const routerLogits = this.router.forward(x);

    // Softmax over experts
    const routerProbs = this.mx.softmax(routerLogits, -1);

    // Get top-K experts
    // TODO: Implement proper top-k selection
    // For now, this is a placeholder
    // expertIndices: (batch, seqLen, topK)
    // expertWeights: (batch, seqLen, topK)

    // Simplified: use argmax for top-1
    const topIndices = this.mx.argmax(routerProbs, -1, true);
    const topWeights = this.mx.max(routerProbs, -1, true);

    return {
      expertIndices: topIndices,
      expertWeights: topWeights
    };
  }

  forward(x: MLXArray): MLXArray {
    const [batch, seqLen, hiddenSize] = x.shape;

    // Compute routing
    const { expertIndices, expertWeights } = this.computeRouting(x);

    // TODO: Implement proper expert routing and combination
    // This requires scatter/gather operations and expert-parallel computation

    // Simplified version: run through all experts and combine
    // (This is inefficient but functionally correct)
    let output = this.mx.zeros([batch, seqLen, hiddenSize], 'float16');

    for (let i = 0; i < this.numExperts; i++) {
      const expert = this.experts.get(i) as Expert;
      const expertOutput = expert.forward(x);

      // Create mask for tokens routed to this expert
      const expertMask = this.mx.equal(expertIndices, i);

      // Weight and accumulate
      // output += expertOutput * expertWeights * expertMask
      const weighted = this.mx.multiply(expertOutput, expertWeights);
      const masked = this.mx.where(expertMask, weighted, this.mx.zeros([1], 'float16'));
      output = this.mx.add(output, masked);
    }

    return output;
  }
}

/**
 * SwiGLU activation helper
 * Commonly used gated activation: silu(gate) * up
 */
export class SwiGLU extends GatedMLP {
  constructor(
    mx: MX,
    config: Omit<GatedMLPConfig, 'gatedActivation' | 'activation'>
  ) {
    super(mx, {
      ...config,
      gatedActivation: true,
      activation: 'silu'
    });
  }
}

/**
 * GeGLU activation helper
 * GELU-gated variant
 */
export class GeGLU extends GatedMLP {
  constructor(
    mx: MX,
    config: Omit<GatedMLPConfig, 'gatedActivation' | 'activation'>
  ) {
    super(mx, {
      ...config,
      gatedActivation: true,
      activation: 'gelu'
    });
  }
}
