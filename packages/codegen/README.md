# @mlx-node/codegen

Code generators for TypeScript definitions and N-API C++ bindings.

## Purpose

Transforms parsed binding metadata into:
- TypeScript definition files (`.d.ts`)
- N-API C++ binding code

## Generators

### TypeScriptGenerator

Generates TypeScript definitions from binding metadata.

```typescript
import { TypeScriptGenerator } from '@mlx-node/codegen';

const generator = new TypeScriptGenerator({
  moduleName: 'mlx-node',
  includeDocs: true,
  camelCase: false,
});

const dts = generator.generate(bindings);
```

### NapiGenerator

Generates N-API C++ binding code.

```typescript
import { NapiGenerator } from '@mlx-node/codegen';

const generator = new NapiGenerator({
  includeComments: true,
  namespace: 'mlx_node',
});

const cpp = generator.generateBindingCpp(bindings);
const header = generator.generateBindingHeader(bindings);
```

### TypeMapper

Maps nanobind/C++ types to TypeScript and N-API types.

```typescript
import { TypeMapper } from '@mlx-node/codegen';

TypeMapper.toTypeScript('array');        // 'NDArray'
TypeMapper.toTypeScript('float32');      // 'number'
TypeMapper.toNapi('std::vector<int>');   // 'Napi::Array'
```

## Output Files

| File | Description |
|------|-------------|
| `mlx-node.d.ts` | TypeScript definitions |
| `binding.cpp` | N-API C++ implementation |
| `binding.h` | C++ header file |
| `bindings.json` | Raw binding metadata |
| `API.md` | Generated API documentation |

## Testing

```bash
pnpm test
```

## Architecture Decision

See [ADR-004: Code Generation](../../docs/adr/004-code-generation.md) for the generation approach.
