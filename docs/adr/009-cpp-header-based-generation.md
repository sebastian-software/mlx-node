# ADR-009: C++ Header-Based Generation

## Status

Accepted (supersedes ADR-001, ADR-002)

## Context

The original approach parsed Python nanobind binding files to extract function signatures. This had several issues:

1. **Indirection**: Parsing Python bindings that wrap C++ felt indirect
2. **Complexity**: Nanobind syntax required complex regex patterns
3. **Type information**: Python bindings often lose C++ type details
4. **Maintenance**: Parser needed updates when nanobind patterns changed

MLX C++ headers contain the authoritative function signatures with full type information.

## Decision

Generate N-API bindings directly from MLX C++ headers:

1. **Parse C++ headers** (`ops.h`, `linalg.h`, `fft.h`, `random.h`) for function signatures
2. **Use Python bindings only for export list** - determine which functions are public API
3. **Generate N-API wrappers** using a template-based approach
4. **Commit generated code** - `binding.cpp` is stable and rarely changes
5. **Hash-based freshness check** - detect when MLX updates require regeneration

### Architecture

```
C++ Headers → Function Signatures
     ↓
Python Bindings → Export List (public API filter)
     ↓
CppNapiGenerator + template → binding.cpp
     ↓
clang-format → Formatted output (committed)
```

### Template System

Static C++ code lives in `templates/binding.cpp` with markers:
- `// @@FUNCTION_WRAPPERS@@` - Generated wrapper functions
- `// @@EXPORTS@@` - Module export statements

This separates concerns: template handles boilerplate, generator handles per-function logic.

## Rationale

**Why C++ headers over Python bindings?**
- Headers are the source of truth for signatures
- Full type information available (no inference needed)
- Simpler regex patterns for C++ function declarations
- Less code to maintain

**Why still use Python bindings?**
- Not all C++ functions are exposed to Python
- Python bindings define the public API
- Export list extraction is simple (just function names)

**Why commit generated code?**
- Bindings change rarely (only when MLX adds/changes functions)
- Faster builds (no generation step needed)
- Easier debugging (can inspect generated code)
- Hash-based check detects when regeneration needed

**Why clang-format?**
- Generator code doesn't need manual indentation
- Consistent formatting regardless of generation logic
- Same tool can format template and other C++ files

## Consequences

### Positive

- Simpler codebase (removed parser package, CLI package)
- More accurate type handling
- Faster development cycle
- Generated code is inspectable and debuggable
- Hash-based check prevents stale bindings

### Negative

- Still requires Python binding files for export list
- Two-source approach (headers + Python) could drift
- clang-format dependency for generation

### Neutral

- Generated `binding.cpp` is ~3000 lines (acceptable)
- Hash check requires network access to GitHub
