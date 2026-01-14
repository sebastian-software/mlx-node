# ADR-004: Generate Code Instead of Manual Bindings

## Status
Accepted

## Context
We needed to decide how to create the N-API bindings:

1. **Manual Bindings** - Hand-write each function wrapper
2. **Generated Bindings** - Parse source and generate wrapper code
3. **Hybrid** - Generate skeleton, manually implement complex cases

## Decision
Generate all binding code from parsed binding metadata.

## Rationale
- **Scalability**: MLX has 274+ functions - manual writing is unsustainable
- **Consistency**: Generated code follows consistent patterns
- **Maintainability**: Upstream changes automatically reflected
- **Type Safety**: TypeScript definitions always match implementation
- **Documentation**: JSDoc comments generated from Python docstrings

## Generated Artifacts

```
packages/mlx-node/generated/
├── binding.cpp      # N-API C++ implementation (~700 KB)
├── binding.h        # C++ header file
├── mlx-node.d.ts    # TypeScript definitions
├── bindings.json    # Parsed binding metadata (for tooling)
└── API.md           # API documentation
```

## Generation Pipeline

```
MLX Source (.cpp)
    → @mlx-node/parser (extract bindings)
    → @mlx-node/codegen (transform to output)
    → generated/ files
```

## Code Generation Examples

### TypeScript Definition
```typescript
// Input: nb::sig("def zeros(shape: Sequence[int], dtype: Dtype = float32) -> array")
// Output:
export function zeros(shape?: number[], dtype?: Dtype): MLXArray;
```

### N-API Wrapper
```cpp
// Generated wrapper for mlx::zeros
Napi::Value Wrap_zeros(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

  std::vector<int> shape;
  if (info.Length() > 0 && info[0].IsArray()) {
    Napi::Array arr = info[0].As<Napi::Array>();
    for (uint32_t i = 0; i < arr.Length(); i++) {
      shape.push_back(arr.Get(i).As<Napi::Number>().Int32Value());
    }
  }

  mlx::core::array result = mlx::core::zeros(shape);
  return ArrayToNapi(env, result);
}
```

## Consequences

### Positive
- Adding new MLX functions requires no code changes
- TypeScript types always accurate
- Easy to regenerate when MLX updates
- Consistent error handling across all functions

### Negative
- Generated code may be suboptimal for some cases
- Complex functions may need manual implementation
- Large generated files (~700KB binding.cpp)
