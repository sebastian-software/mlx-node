# ADR-007: Stub Mode for Development Without MLX

## Status
Accepted

## Context
MLX only works on macOS with Apple Silicon. We needed development options for:
- CI on Linux runners
- Development on Intel Macs
- Quick iteration without full MLX build
- Testing API shape without MLX installed

## Decision
Implement a "stub mode" that provides the full API shape without actual MLX functionality.

## Rationale
- **CI Accessibility**: Can run tests on any platform
- **Fast Iteration**: No need to install MLX for API development
- **API Validation**: Ensures API shape is correct before MLX integration
- **Contributor Friendly**: Lower barrier to entry for contributors

## Implementation

### CMake Detection
```cmake
# CMakeLists.txt
if(NOT MLX_FOUND)
    message(STATUS "⚠ MLX not found. Building in STUB MODE.")
    set(MLX_STUB_MODE ON)
endif()

if(MLX_STUB_MODE)
    set(BINDING_SOURCES ${CMAKE_SOURCE_DIR}/src/native/stub.cpp)
else()
    set(BINDING_SOURCES ${CMAKE_SOURCE_DIR}/generated/binding.cpp)
endif()

target_compile_definitions(${PROJECT_NAME} PRIVATE
    MLX_AVAILABLE=$<NOT:$<BOOL:${MLX_STUB_MODE}>>
)
```

### Stub Implementation
```cpp
// stub.cpp provides:

// 1. MLXArray class with all properties
class MLXArray : public Napi::ObjectWrap<MLXArray> {
  Napi::Value GetShape(const Napi::CallbackInfo& info);  // Returns actual shape
  Napi::Value GetDtype(const Napi::CallbackInfo& info);  // Returns dtype string
  Napi::Value GetSize(const Napi::CallbackInfo& info);   // Returns element count
  Napi::Value ToList(const Napi::CallbackInfo& info);    // Returns JS array
};

// 2. All dtype constants
exports.Set("float32", Napi::String::New(env, "float32"));

// 3. Function stubs that work with local data
Napi::Value Wrap_add(const Napi::CallbackInfo& info) {
  // In stub mode: throw or return placeholder
  throw Napi::Error::New(env, "add requires MLX");
}

// 4. Module info
exports.Set("__mlx_available__", Napi::Boolean::New(env, false));
exports.Set("__version__", Napi::String::New(env, "0.1.0-stub"));
```

### Runtime Detection
```javascript
// lib/index.js
import mlx from './native/mlx_node.node';

if (!mlx.__mlx_available__) {
  console.warn('MLX not available - running in stub mode');
}
```

## Test Compatibility

Tests are designed to work in both modes:

```javascript
test('should indicate MLX availability', () => {
  assert.strictEqual(typeof mlx.__mlx_available__, 'boolean');
  console.log(`MLX available: ${mlx.__mlx_available__}`);
});

test('should create array from JavaScript array', () => {
  const arr = new mlx.array([1, 2, 3]);
  assert.strictEqual(arr.size, 3);  // Works in stub mode
});
```

## Consequences

### Positive
- Faster development cycle
- CI works on GitHub's Linux runners
- API stability testing without MLX
- Documentation and types can be developed independently

### Negative
- Cannot test actual computations in stub mode
- Two code paths to maintain
- Risk of stub/real behavior divergence
