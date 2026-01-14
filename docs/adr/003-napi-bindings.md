# ADR-003: N-API over Native Abstractions

## Status
Accepted

## Context
Node.js offers several ways to create native addons:

1. **N-API (Node-API)** - Stable ABI, version-independent
2. **NAN (Native Abstractions for Node)** - Abstracts V8, but still version-dependent
3. **Direct V8 API** - Full power, but breaks between Node versions
4. **NAPI-RS (Rust)** - Requires Rust toolchain

## Decision
Use N-API via node-addon-api (C++ wrapper).

## Rationale
- **ABI Stability**: Compiled addon works across Node.js versions without recompilation
- **C++ Compatibility**: node-addon-api provides C++ ergonomics on top of C N-API
- **Ecosystem Support**: Best supported option, used by most native modules
- **MLX Integration**: MLX is C++, so C++ bindings are natural fit
- **Exception Support**: `NAPI_CPP_EXCEPTIONS` enables C++ exception handling

## Implementation

```cpp
// Using node-addon-api
#include <napi.h>

class MLXArray : public Napi::ObjectWrap<MLXArray> {
 public:
  static Napi::Object Init(Napi::Env env, Napi::Object exports);
  MLXArray(const Napi::CallbackInfo& info);

 private:
  mlx::core::array array_;
  Napi::Value GetShape(const Napi::CallbackInfo& info);
};

// CMakeLists.txt
target_compile_definitions(${PROJECT_NAME} PRIVATE
    NAPI_VERSION=8
    NAPI_CPP_EXCEPTIONS
)
```

## Consequences

### Positive
- Single build works on Node 18, 20, 22+
- No recompilation needed for Node upgrades
- C++ exception support simplifies error handling
- Mature tooling (cmake-js, prebuildify)

### Negative
- Slightly more verbose than NAN for some patterns
- Requires understanding of N-API concepts
- Some V8 features not exposed through N-API
