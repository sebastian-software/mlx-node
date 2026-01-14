# mlx-node

Node.js bindings for [MLX](https://github.com/ml-explore/mlx) - Apple's array framework for machine learning on Apple Silicon.

## Overview

This project provides native Node.js bindings for MLX, generated from C++ headers to stay in sync with upstream changes.

## Features

- **C++ Header Based**: Bindings generated directly from MLX C++ headers
- **Native Performance**: Direct N-API bindings to MLX C++ core
- **200+ Functions**: Covers all core MLX operations
- **Automatic Formatting**: Generated code formatted with clang-format
- **Hash-Based Freshness Check**: Detect when MLX updates require regeneration

## Installation

```bash
npm install mlx-node
```

**Requirements:**
- macOS with Apple Silicon (M1/M2/M3/M4)
- Node.js 18+

## Usage

```javascript
import mlx from 'mlx-node';

// Create arrays
const a = mlx.array([1, 2, 3, 4]);
const b = mlx.array([5, 6, 7, 8]);

// Operations
const c = mlx.add(a, b);
console.log(c.tolist()); // [6, 8, 10, 12]

// Matrix operations
const matrix = mlx.array([[1, 2], [3, 4]]);
console.log(matrix.shape); // [2, 2]

// Reductions
const sum = mlx.sum(matrix);
const mean = mlx.mean(matrix, 0); // along axis 0
```

## Project Structure

```
mlx-node/
├── packages/
│   ├── codegen/         # @mlx-node/codegen - C++ header parser & N-API generator
│   ├── mlx-node/        # mlx-node - Main native addon package
│   └── llm/             # @mlx-node/llm - LLM inference (WIP)
├── pnpm-workspace.yaml
├── turbo.json
├── .clang-format        # C++ code formatting config
└── docs/
    └── adr/             # Architecture Decision Records
```

### Package Overview

| Package | Description |
|---------|-------------|
| `@mlx-node/codegen` | C++ header parser, N-API generator, freshness checker |
| `mlx-node` | Main package with native addon, published to npm |
| `@mlx-node/llm` | LLM inference layers (work in progress) |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MLX C++ Headers                          │
│              (ops.h, linalg.h, fft.h, random.h)            │
└─────────────────────┬───────────────────────────────────────┘
                      │ parse signatures
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                 MLX Python Bindings                         │
│              (ops.cpp, linalg.cpp, etc.)                   │
│                → export list only                          │
└─────────────────────┬───────────────────────────────────────┘
                      │ filter public API
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  @mlx-node/codegen                          │
│     CppNapiGenerator + templates/binding.cpp               │
└─────────────────────┬───────────────────────────────────────┘
                      │ generate + clang-format
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              mlx-node/generated/binding.cpp                 │
│                    (committed to repo)                      │
└─────────────────────────────────────────────────────────────┘
```

## Development

### Prerequisites

- Node.js 18+
- pnpm 9+
- CMake 3.20+
- Xcode Command Line Tools (for clang-format)

### Setup

```bash
# Clone
git clone https://github.com/user/mlx-node.git
cd mlx-node

# Install dependencies
pnpm install

# Build TypeScript
pnpm build

# Build native addon (uses committed binding.cpp)
pnpm --filter mlx-node build

# Run tests
pnpm test
```

### Regenerating Bindings

Bindings are committed to the repo and rarely need regeneration. To check if they're outdated:

```bash
# Check if MLX has updates
pnpm --filter @mlx-node/codegen check-bindings

# If outdated, download fresh MLX source and regenerate
curl -L https://github.com/ml-explore/mlx/archive/main.tar.gz | tar xz -C /tmp
mv /tmp/mlx-main /tmp/mlx-source
pnpm --filter @mlx-node/codegen generate
```

### Scripts

| Script | Description |
|--------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all TypeScript packages |
| `pnpm test` | Run all tests |
| `pnpm --filter @mlx-node/codegen check-bindings` | Check if bindings need updating |
| `pnpm --filter @mlx-node/codegen generate` | Regenerate binding.cpp |

## Generated API

The generator produces bindings for **200+ functions** from MLX:

| Category | Examples |
|----------|----------|
| Array Creation | `zeros`, `ones`, `full`, `arange`, `linspace` |
| Math | `add`, `subtract`, `multiply`, `divide`, `matmul` |
| Reductions | `sum`, `mean`, `max`, `min`, `prod`, `var`, `std` |
| Linear Algebra | `inv`, `svd`, `qr`, `eigh`, `cholesky` |
| FFT | `fft`, `ifft`, `fft2`, `rfft` |
| Random | `uniform`, `normal`, `randint`, `bernoulli` |
| Neural Network | `conv1d`, `conv2d`, `softmax`, `relu`, `gelu` |

## Status

| Feature | Status |
|---------|--------|
| C++ header parser | Complete |
| N-API generator | Complete |
| clang-format integration | Complete |
| Hash-based freshness check | Complete |
| Build system (CMake) | Complete |
| Monorepo (pnpm/turbo) | Complete |
| Test suite | 13 tests passing |
| LLM inference | In Progress |

## Documentation

- [Architecture Decision Records](docs/adr/) - Design decisions and rationale

## License

MIT

## Acknowledgments

- [MLX](https://github.com/ml-explore/mlx) by Apple
- [node-addon-api](https://github.com/nodejs/node-addon-api) for N-API
- [pnpm](https://pnpm.io/) for package management
- [Turborepo](https://turbo.build/) for monorepo build orchestration
