# ADR-006: Fine-Grained Package Structure

## Status
Accepted

## Context
Given the monorepo decision, we needed to decide on package granularity:

1. **Coarse** - 2 packages: tooling + runtime
2. **Fine-Grained** - 4 packages: parser, codegen, cli, runtime
3. **Very Fine** - Many small packages (one per generator, etc.)

## Decision
Use fine-grained structure with 4 packages.

## Package Structure

```
packages/
├── parser/          # @mlx-node/parser
│   ├── src/
│   │   ├── index.ts
│   │   └── regex-parser.ts
│   ├── test/
│   └── package.json
│
├── codegen/         # @mlx-node/codegen
│   ├── src/
│   │   ├── index.ts
│   │   ├── type-mapper.ts
│   │   ├── ts-generator.ts
│   │   └── napi-generator.ts
│   └── package.json
│
├── cli/             # @mlx-node/cli
│   ├── src/
│   │   ├── index.ts
│   │   └── generate.ts
│   ├── bin/
│   │   └── mlx-generate.js
│   ├── scripts/
│   │   ├── check-coverage.js
│   │   └── validate-completeness.py
│   └── package.json
│
└── mlx-node/        # mlx-node (published to npm)
    ├── src/native/
    │   └── stub.cpp
    ├── lib/
    │   ├── index.js
    │   └── index.d.ts
    ├── generated/   # Output from CLI
    ├── test/
    ├── CMakeLists.txt
    └── package.json
```

## Dependency Graph

```
@mlx-node/parser (no dependencies)
       ↓
@mlx-node/codegen (depends on parser)
       ↓
@mlx-node/cli (depends on parser + codegen)
       ↓ (generates files for)
mlx-node (consumes generated/, no runtime dependencies)
```

## Rationale

### Single Responsibility
Each package has one clear purpose:
- **parser**: Parse nanobind C++ → binding metadata
- **codegen**: Transform metadata → code files
- **cli**: Orchestrate generation + provide scripts
- **mlx-node**: Native addon + JavaScript API

### Reusability
- Parser could be used by other projects needing nanobind parsing
- Codegen could generate bindings for other runtimes (Deno, Bun)

### Testability
- Each package can be tested in isolation
- Parser tests don't need codegen
- Codegen tests don't need native compilation

### Future Extensibility
Easy to add new packages:
- `@mlx-node/nn` - Neural network layers
- `@mlx-node/optimizers` - Optimizer implementations
- `@mlx-node/data` - Data loading utilities

## Consequences

### Positive
- Clear boundaries between components
- Parser can be versioned independently
- CLI scripts don't ship with runtime
- Smaller published package size

### Negative
- More packages to maintain
- Cross-package changes require coordination
- More complex dependency management
