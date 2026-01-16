# ADR-006: Package Structure

## Status
Accepted (Revised)

## Context
Given the monorepo decision, we needed to decide on package granularity.

Initial plan was 4 packages (parser, codegen, cli, runtime), but this proved over-engineered. Parser and codegen are tightly coupled, and a separate CLI package added no value.

## Decision
Use a simplified structure with 2 core packages + optional high-level packages.

## Package Structure

```
packages/
├── codegen/         # @mlx-node/codegen
│   ├── src/
│   │   ├── index.ts
│   │   ├── regex-parser.ts      # Parser integrated here
│   │   ├── type-mapper.ts
│   │   ├── ts-generator.ts
│   │   └── cpp-napi-generator.ts
│   ├── test/
│   └── package.json
│
├── mlx-node/        # mlx-node (published to npm)
│   ├── src/
│   ├── generated/   # Output from codegen
│   ├── test/
│   ├── CMakeLists.txt
│   └── package.json
│
└── llm/             # @mlx-node/llm (optional, WIP)
    ├── src/
    └── package.json
```

## Dependency Graph

```
@mlx-node/codegen (no dependencies)
       ↓ (generates files for)
mlx-node (consumes generated/, no runtime dependencies on codegen)
       ↓ (used by)
@mlx-node/llm (depends on mlx-node at runtime)
```

## Rationale

### Simplified Structure
- **codegen**: Parser + code generation in one package (they always change together)
- **mlx-node**: Native addon + JavaScript API (the published package)
- **llm**: Optional high-level package for LLM inference

### Why Not Separate Parser?
Parser and codegen are tightly coupled:
- Parser output format is dictated by codegen needs
- Changes to one almost always require changes to the other
- No external consumers need the parser standalone

### Why No CLI Package?
- Generation is triggered via `pnpm generate` in the monorepo
- No need for a standalone CLI tool
- Scripts live in root `scripts/` directory

## Consequences

### Positive
- Fewer packages to maintain
- Simpler dependency management
- Parser/codegen changes are atomic

### Negative
- Parser cannot be reused independently (acceptable trade-off)
