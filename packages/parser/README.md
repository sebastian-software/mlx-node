# @mlx-node/parser

Regex-based parser for nanobind C++ binding definitions.

## Purpose

Extracts binding metadata from MLX's Python binding source files (`python/src/*.cpp`). These files use [nanobind](https://github.com/wjakob/nanobind) to define Python bindings for MLX's C++ core.

## Usage

```typescript
import { NanobindRegexParser } from '@mlx-node/parser';

const parser = new NanobindRegexParser();
const bindings = parser.parse(cppSourceCode);
```

## Recognized Patterns

| Pattern | Type | Description |
|---------|------|-------------|
| `m.def("name", ...)` | function | Module-level function |
| `nb::class_<T>(m, "name")` | class | Class binding |
| `nb::enum_<T>(m, "name")` | enum | Enum binding |
| `m.attr("name") = ...` | attribute | Module attribute |
| `.def("name", ...)` | method | Class/enum method |
| `.def_prop_ro("name", ...)` | property | Read-only property |
| `.def_prop_rw("name", ...)` | property | Read-write property |
| `.def_ro("name", ...)` | field | Read-only field |
| `.def_rw("name", ...)` | field | Read-write field |
| `.def_static("name", ...)` | static | Static method |
| `nb::init<...>()` | constructor | Class constructor |
| `.def_submodule("name")` | submodule | Nested module |

## Output Structure

```typescript
interface Binding {
  type: 'function' | 'class' | 'enum' | 'attribute' | 'submodule';
  name: string;
  signature?: string;
  docstring?: string;
  // Class-specific
  cppClass?: string;
  methods?: Method[];
  properties?: Property[];
  constructors?: Constructor[];
}
```

## Testing

```bash
pnpm test
```

## Architecture Decision

See [ADR-002: Regex-Based Parser](../../docs/adr/002-regex-based-parser.md) for why regex was chosen over AST/Tree-Sitter.
