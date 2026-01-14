# @mlx-node/codegen

Code generator for N-API bindings from MLX C++ headers.

## Overview

This package generates N-API C++ bindings by:
1. Parsing MLX C++ headers for function signatures
2. Filtering to public API via Python binding export list
3. Generating wrapper functions using a template
4. Formatting output with clang-format

## Architecture

```
MLX C++ Headers (ops.h, linalg.h, etc.)
         │
         ▼ cpp-header-parser.ts
    Function Signatures
         │
         ▼ export-list-parser.ts (from Python bindings)
    Filtered Public API
         │
         ▼ cpp-napi-generator.ts + templates/binding.cpp
    Generated binding.cpp
         │
         ▼ clang-format
    Formatted Output
```

## Usage

### Generate Bindings

```bash
# Requires MLX headers in build/_deps and Python bindings in /tmp/mlx-source
pnpm generate
```

### Check Freshness

```bash
# Compare local hash to GitHub main branch
pnpm check-bindings

# Update hash after acknowledging current state
pnpm check-bindings --update
```

## Components

### CppNapiGenerator

Main generator class that produces binding.cpp from parsed functions.

```typescript
import { CppNapiGenerator } from '@mlx-node/codegen';

const generator = new CppNapiGenerator(functions, exports, {
  format: true,  // Run clang-format (default: true)
});

const bindingCode = generator.generate();
```

### cpp-header-parser

Parses MLX C++ headers to extract function signatures.

```typescript
import { parseCppHeader } from '@mlx-node/codegen';

const header = parseCppHeader(headerContent, 'ops.h');
// Returns: { functions: CppFunction[], namespace: string }
```

### export-list-parser

Extracts exported function names from Python binding files.

```typescript
import { parseExportList } from '@mlx-node/codegen';

const exports = parseExportList(pythonContent, 'ops');
// Returns: ExportedFunction[]
```

### check-bindings

CLI tool to verify bindings are up-to-date with MLX.

```bash
# Check freshness
node dist/check-bindings.js

# Quiet mode (for CI)
node dist/check-bindings.js --quiet

# Update stored hash
node dist/check-bindings.js --update
```

## Files

| File | Purpose |
|------|---------|
| `src/cpp-header-parser.ts` | Parse C++ headers for function signatures |
| `src/export-list-parser.ts` | Extract export list from Python bindings |
| `src/cpp-napi-generator.ts` | Generate N-API wrapper code |
| `src/generate-from-cpp.ts` | CLI entry point for generation |
| `src/check-bindings.ts` | CLI for freshness checking |
| `templates/binding.cpp` | C++ template with markers |

## Template System

The generator uses `templates/binding.cpp` with marker-based replacement:

```cpp
// Static code: includes, MLXArray class, helpers...

// @@FUNCTION_WRAPPERS@@
// Generated function wrappers inserted here

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  // ...
  // @@EXPORTS@@
  // Generated export statements inserted here
}
```

## Type Mapping

| C++ Type | N-API Extraction |
|----------|------------------|
| `array` | `NapiToArray(info[n])` |
| `Shape` | `NapiToShape(info[n])` |
| `Dtype` | `NapiToDtype(info[n])` |
| `int` | `info[n].As<Napi::Number>().Int32Value()` |
| `bool` | `info[n].As<Napi::Boolean>().Value()` |
| `double` | `info[n].As<Napi::Number>().DoubleValue()` |
| `std::vector<int>` | `NapiToVecInt(info[n])` |
| `std::optional<T>` | Null check + extraction |

## Scripts

```json
{
  "build": "tsc",
  "generate": "node dist/generate-from-cpp.js",
  "check-bindings": "node dist/check-bindings.js"
}
```

## Binary Commands

When installed, provides:
- `mlx-generate` - Generate binding.cpp
- `mlx-check-bindings` - Check binding freshness
