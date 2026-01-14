# ADR-002: Regex-Based Parser over AST/Tree-Sitter

## Status
Accepted

## Context
To extract binding information from nanobind C++ code, we needed a parsing strategy:

1. **Tree-Sitter C++ parser** - Full AST, handles all C++ syntax
2. **libclang/clangd** - Complete C++ understanding, requires compilation
3. **Regex-based parser** - Simple patterns, fast, no dependencies

## Decision
Use a regex-based parser tailored to nanobind's specific patterns.

## Rationale
- **Predictable Patterns**: Nanobind uses very consistent patterns:
  - `m.def("name", ...)` for functions
  - `nb::class_<T>(m, "Name")` for classes
  - `.def("method", ...)` for methods
  - `nb::sig("def ...")` for signatures
- **No Build Requirements**: Works without compiling C++
- **Fast Iteration**: Easy to add new patterns as discovered
- **Sufficient Accuracy**: Achieved 100% coverage on all binding categories

## Implementation Details

Key patterns handled:

```typescript
// Functions: m.def("name", ...)
const defPattern = /m\.def\s*\(\s*"([^"]+)"/g;

// Classes: nb::class_<T>(m, "Name")
const classPattern = /nb::class_<([^>]+)>\s*\(\s*\w+\s*,\s*"([^"]+)"/g;

// Methods: .def("name", ...) - excluding .def_ro, .def_static, etc.
const methodPattern = /\.def\s*\(\s*"([^"]+)"/g;

// Signatures: nb::sig("def ...")
const sigMatch = fullDef.match(/nb::sig\s*\(\s*"([^"]+)"\s*\)/);
```

Special handling for:
- Balanced parentheses extraction
- Raw string literals (`R"pbdoc(...)pbdoc"`)
- Chained method calls (`.def().def().def()`)
- Variable-assigned class definitions
- Submodule variable names (`metal.def()` vs `m.def()`)

## Consequences

### Positive
- No external dependencies (tree-sitter binaries, libclang)
- Fast execution (~100ms to parse all files)
- Easy to debug and extend
- Works on any platform without build tools

### Negative
- May break if nanobind changes its macro patterns significantly
- Cannot understand C++ semantics (only patterns)
- Edge cases require manual pattern additions
