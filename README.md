# mlx-node

Node.js bindings for [MLX](https://github.com/ml-explore/mlx) - Apple's array framework for machine learning on Apple Silicon.

## Overview

This project provides native Node.js bindings for MLX, automatically generated from the Python bindings to stay in sync with upstream changes.

## Features

- **Automatic Sync**: Bindings are auto-generated from MLX Python source
- **Full Type Safety**: TypeScript definitions generated alongside bindings
- **Native Performance**: Direct N-API bindings to MLX C++ core
- **100% Coverage**: Parser captures all 274 functions, 13 classes, and 137 methods
- **Monorepo Architecture**: Clean separation of parser, codegen, CLI, and native addon

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

## Project Structure

```
mlx-node/
├── packages/
│   ├── parser/          # @mlx-node/parser - Nanobind C++ parser
│   ├── codegen/         # @mlx-node/codegen - TypeScript/N-API generators
│   ├── cli/             # @mlx-node/cli - Code generation CLI + scripts
│   └── mlx-node/        # mlx-node - Main native addon package
├── pnpm-workspace.yaml
├── turbo.json
└── docs/
    └── ARCHITECTURE.md  # Architecture Decision Records
```

### Package Overview

| Package | Description |
|---------|-------------|
| `@mlx-node/parser` | Regex-based parser for nanobind C++ binding definitions |
| `@mlx-node/codegen` | TypeScript definition and N-API C++ code generators |
| `@mlx-node/cli` | CLI tools and scripts for code generation and coverage checks |
| `mlx-node` | Main package with native addon, published to npm |

### Dependency Graph

```
@mlx-node/parser (no dependencies)
       ↓
@mlx-node/codegen (depends on parser)
       ↓
@mlx-node/cli (depends on parser + codegen)
       ↓ (generates files for)
mlx-node (consumes generated/, no runtime dependencies on other packages)
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    MLX Python Source                        │
│                 (nanobind C++ bindings)                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ parse
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  @mlx-node/parser                           │
│              (Regex-based nanobind parser)                  │
└─────────────────────┬───────────────────────────────────────┘
                      │ transform
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                  @mlx-node/codegen                          │
│        (TypeScript + N-API C++ code generators)             │
└─────────────────────┬───────────────────────────────────────┘
                      │ generate
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                   mlx-node/generated/                       │
│   ├── mlx-node.d.ts    (TypeScript definitions)             │
│   ├── binding.cpp      (N-API C++ bindings)                 │
│   ├── binding.h        (C++ header)                         │
│   └── bindings.json    (Parsed binding metadata)            │
└─────────────────────────────────────────────────────────────┘
```

## Development

### Prerequisites

- Node.js 18+
- pnpm 9+
- CMake 3.20+
- Xcode Command Line Tools (macOS)

### Setup

```bash
# Clone
git clone https://github.com/user/mlx-node.git
cd mlx-node

# Install dependencies (builds native module in stub mode)
pnpm install

# Download MLX source files (sparse checkout, ~2MB)
pnpm setup

# Generate bindings
pnpm generate

# Run tests
pnpm test
```

The setup script downloads only the required `python/src/*.cpp` files from MLX using git sparse-checkout, storing them locally in `.mlx-source/` (~2MB instead of ~500MB for full repo).

### Scripts

| Script | Description |
|--------|-------------|
| `pnpm install` | Install all dependencies |
| `pnpm build` | Build all TypeScript packages (via turbo) |
| `pnpm generate` | Parse MLX and generate bindings |
| `pnpm test` | Run all tests |
| `pnpm check-coverage` | Verify parser coverage against MLX source |

### Package-specific Commands

```bash
# Run parser tests only
pnpm --filter @mlx-node/parser test

# Run native addon tests only
pnpm --filter mlx-node test

# Build specific package
pnpm --filter @mlx-node/codegen build

# Rebuild native module
pnpm --filter mlx-node rebuild
```

### Building with MLX

To build with actual MLX support:

```bash
# Install MLX
pip install mlx

# Set MLX directory (if needed)
export MLX_DIR=/path/to/mlx/cmake

# Rebuild native module
pnpm --filter mlx-node rebuild
```

## Generated API

The generator extracts **318 bindings** from MLX Python with **100% coverage**:

| Category | Count | Coverage |
|----------|-------|----------|
| Functions | 274 | 100% |
| Classes | 13 | 100% |
| Enums | 2 | 100% |
| Attributes | 22 | 100% |
| Methods | 137 | 100% |
| Properties | 20 | 100% |
| Constructors | 6 | 100% |
| Submodules | 7 | 100% |

## Status

| Feature | Status |
|---------|--------|
| Nanobind parser | ✅ 100% coverage |
| TypeScript generator | ✅ Complete |
| N-API C++ generator | ✅ Complete |
| Build system (CMake) | ✅ Complete |
| Monorepo (pnpm/turbo) | ✅ Complete |
| Stub implementation | ✅ Complete |
| Test suite | ✅ 35 tests passing |
| CI/CD (GitHub Actions) | ✅ Complete |
| Auto-sync workflow | ✅ Weekly updates |
| Full MLX integration | 🚧 In Progress |

## Documentation

- [Architecture Decision Records](docs/adr/) - Design decisions and rationale

## License

MIT

## Acknowledgments

- [MLX](https://github.com/ml-explore/mlx) by Apple
- [nanobind](https://github.com/wjakob/nanobind) for Python bindings
- [node-addon-api](https://github.com/nodejs/node-addon-api) for N-API
- [pnpm](https://pnpm.io/) for package management
- [Turborepo](https://turbo.build/) for monorepo build orchestration
