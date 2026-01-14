# mlx-node

Node.js bindings for [MLX](https://github.com/ml-explore/mlx) - Apple's array framework for machine learning on Apple Silicon.

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

## API

See [generated/API.md](generated/API.md) for full API documentation.

**Summary:**
- 274 functions
- 13 classes
- 137 methods
- Full TypeScript support

## Building

### Stub Mode (without MLX)

```bash
pnpm install
pnpm build:native
```

### Full MLX Integration

```bash
pip install mlx
export MLX_DIR=/path/to/mlx/cmake  # if needed
pnpm rebuild
```

## Testing

```bash
pnpm test
```

## Generated Files

This package consumes generated files from `@mlx-node/cli`:

| File | Purpose |
|------|---------|
| `generated/mlx-node.d.ts` | TypeScript definitions |
| `generated/binding.cpp` | N-API C++ implementation |
| `generated/binding.h` | C++ header |

## Architecture Decisions

- [ADR-003: N-API Bindings](../../docs/adr/003-napi-bindings.md)
- [ADR-007: Stub Mode](../../docs/adr/007-stub-mode.md)
