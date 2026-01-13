# mlx-node

Node.js bindings for [MLX](https://github.com/ml-explore/mlx) - Apple's array framework for machine learning on Apple Silicon.

## Overview

This project provides native Node.js bindings for MLX, automatically generated from the Python bindings to stay in sync with upstream changes.

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
- Python 3.10+ (for MLX source)
- CMake 3.20+
- Xcode Command Line Tools (macOS)

### Setup

```bash
# Clone with MLX source
git clone --recursive https://github.com/user/mlx-node.git
cd mlx-node

# Install dependencies
npm install

# Generate bindings from MLX source
npm run generate
```

### Scripts

- `npm run build` - Compile TypeScript
- `npm run generate` - Parse MLX and generate bindings
- `npm run test-parser` - Test the nanobind parser

## Status

🚧 **Work in Progress**

- [x] Nanobind parser (extracts API from Python bindings)
- [x] TypeScript definition generator
- [ ] N-API C++ code generator
- [ ] Build system (CMake + node-gyp)
- [ ] Runtime type conversion
- [ ] CI/CD automation

## License

MIT
