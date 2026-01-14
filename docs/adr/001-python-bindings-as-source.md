# ADR-001: Parse Python Bindings as Source of Truth

## Status
Accepted

## Context
MLX provides bindings for multiple languages. We needed to decide which source to use for generating Node.js bindings:

1. **MLX C++ API directly** - Most complete but very complex, no type annotations
2. **MLX Python bindings (nanobind)** - Already curated public API with type signatures
3. **Manual definition** - Full control but high maintenance burden

## Decision
Use the MLX Python bindings (nanobind C++ source) as the source of truth.

## Rationale
- **Curated API**: The Python bindings represent the intentional public API
- **Type Information**: `nb::sig()` annotations provide Python type signatures that map well to TypeScript
- **Docstrings**: `R"pbdoc()"` strings contain user-facing documentation
- **Stability**: Python API is more stable than internal C++ API
- **Automatic Sync**: Changes to Python API automatically surface in our parser

## Consequences

### Positive
- Automatic tracking of upstream API changes
- Type signatures available for code generation
- Documentation included in bindings

### Negative
- Dependent on nanobind's binding patterns remaining consistent
- Cannot expose C++ API features not in Python
- Parser must understand nanobind macro patterns
