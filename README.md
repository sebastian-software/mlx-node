# mlx-node

[![CI](https://github.com/user/mlx-node/actions/workflows/ci.yml/badge.svg)](https://github.com/user/mlx-node/actions/workflows/ci.yml)

Node.js bindings for [MLX](https://github.com/ml-explore/mlx) - Apple's array framework for machine learning on Apple Silicon.

## Overview

This project provides native Node.js bindings for MLX, automatically generated from the Python bindings to stay in sync with upstream changes.

## Features

- **Automatic Sync**: Bindings are auto-generated from MLX Python source
- **Full Type Safety**: TypeScript definitions generated alongside bindings
- **Native Performance**: Direct N-API bindings to MLX C++ core
- **Zero-Copy** (planned): TypedArray support for efficient data transfer

## Installation

```bash
npm install mlx-node
```

**Requirements:**
- macOS with Apple Silicon (M1/M2/M3)
- Node.js 18+
- MLX installed (`pip install mlx`)

## Usage

```javascript
import mlx from 'mlx-node';

// Create arrays
const a = new mlx.array([1, 2, 3, 4]);
const b = new mlx.array([5, 6, 7, 8]);

// Operations
const c = mlx.add(a, b);
console.log(c.tolist()); // [6, 8, 10, 12]

// Matrix operations
const matrix = new mlx.array([[1, 2], [3, 4]]);
console.log(matrix.shape); // [2, 2]
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MLX Python Source                         │
│                 (nanobind C++ bindings)                      │
└─────────────────────┬───────────────────────────────────────┘
                      │ parse
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  Nanobind Parser                             │
│              (src/parser/regex-parser.ts)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │ generate
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              TypeScript Definitions                          │
│               (generated/mlx-node.d.ts)                      │
├─────────────────────────────────────────────────────────────┤
│                 N-API C++ Bindings                           │
│                (generated/binding.cpp)                       │
└─────────────────────────────────────────────────────────────┘
```

## Development

### Prerequisites

- Node.js 18+
- CMake 3.20+
- Xcode Command Line Tools (macOS)
- MLX source (cloned automatically)

### Setup

```bash
# Clone
git clone https://github.com/user/mlx-node.git
cd mlx-node

# Install dependencies
npm install

# Clone MLX source for parsing
git clone --depth 1 https://github.com/ml-explore/mlx.git /tmp/mlx-source

# Generate bindings
npm run generate

# Build native module (stub mode without MLX)
npm run build:native

# Run tests
npm test
```

### Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Generate and build everything |
| `npm run build:ts` | Compile TypeScript only |
| `npm run build:native` | Build native module |
| `npm run generate` | Parse MLX and generate bindings |
| `npm test` | Run test suite |
| `npm run clean` | Clean build artifacts |

### Building with MLX

To build with actual MLX support:

```bash
# Install MLX
pip install mlx

# Set MLX directory (if needed)
export MLX_DIR=/path/to/mlx/cmake

# Build
npm run build:native
```

## Generated API

The generator extracts **311+ bindings** from MLX Python:

- **274 functions** (227 with full type signatures)
- **13 classes** (array, Dtype, Device, Stream, etc.)
- **2 enums** (DtypeCategory, DeviceType)
- **22 constants** (dtype values)

## Status

| Feature | Status |
|---------|--------|
| Nanobind parser | ✅ Complete |
| TypeScript generator | ✅ Complete |
| N-API C++ generator | ✅ Complete |
| Build system (CMake) | ✅ Complete |
| Stub implementation | ✅ Complete |
| Test suite | ✅ 13 tests passing |
| CI/CD (GitHub Actions) | ✅ Complete |
| Auto-sync workflow | ✅ Weekly updates |
| Full MLX integration | 🚧 In Progress |

## CI/CD

- **CI**: Builds and tests on every push/PR
- **Sync**: Weekly auto-sync with MLX upstream
- **Release**: Automated builds for tagged releases

## License

MIT

## Acknowledgments

- [MLX](https://github.com/ml-explore/mlx) by Apple
- [nanobind](https://github.com/wjakob/nanobind) for Python bindings
- [node-addon-api](https://github.com/nodejs/node-addon-api) for N-API
