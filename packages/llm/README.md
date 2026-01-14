# @mlx-node/llm

LLM inference for mlx-node - run large language models natively in Node.js on Apple Silicon.

## Status

**Work in Progress** - Core infrastructure complete, model implementations pending.

## Features

### Layers

- **Linear / QuantizedLinear** - Fully connected layers with optional quantization
- **Embedding** - Token embedding lookup with tied weights support
- **RMSNorm** - Root Mean Square normalization
- **RoPE variants** - Standard, Dual (Gemma3), LongRoPE (Phi3)
- **Attention** - Standard, Sliding Window, Interleaved (Gemma3)
- **MLP** - Standard, Gated (SwiGLU), Mixture of Experts

### Cache

- **KVCache** - Standard key-value cache with dynamic allocation
- **RotatingKVCache** - Circular buffer for sliding window attention
- **ModelCache** - Per-layer cache management

### Generation

- **Sampler** - Temperature, Top-K, Top-P, Min-P, Repetition Penalty
- **Generator** - Streaming and batch generation

## Target Models

| Model | Status | Features |
|-------|--------|----------|
| Gemma3 | Planned | Interleaved attention, Dual RoPE |
| GPT-OSS | Planned | Mixture of Experts (128 experts, top-4) |
| Phi3 | Planned | LongRoPE context extension |

## Usage (Planned)

```typescript
import { loadModel, generate } from '@mlx-node/llm';

// Load a model from Hugging Face
const model = await loadModel('mlx-community/gemma-3-4b-it-4bit');

// Generate text
const tokens = await model.tokenize('What is machine learning?');

for await (const step of generate(model, tokens)) {
  const text = model.detokenize([step.token]);
  process.stdout.write(text);
}
```

## Architecture

```
@mlx-node/llm
├── layers/           # Neural network layers
│   ├── module.ts     # Base Module class
│   ├── linear.ts     # Linear layers
│   ├── embedding.ts  # Token embeddings
│   ├── rms-norm.ts   # RMSNorm
│   ├── rope.ts       # Rotary position embeddings
│   ├── attention.ts  # Attention mechanisms
│   └── mlp.ts        # MLP variants
├── cache/            # KV cache implementations
│   └── kv-cache.ts   # Standard and rotating cache
├── generation/       # Text generation
│   ├── sampler.ts    # Sampling algorithms
│   └── generate.ts   # Generation loop
└── models/           # Model architectures (TODO)
    ├── gemma3.ts
    ├── gpt-oss.ts
    └── phi3.ts
```

## Dependencies

- `mlx-node` - Core MLX bindings for array operations

## Development

```bash
# Build
pnpm build

# Test
pnpm test
```

## Related

- [mlx-lm](https://github.com/ml-explore/mlx-lm) - Python LLM inference (reference implementation)
- [mlx-node](../mlx-node) - Core MLX bindings for Node.js
