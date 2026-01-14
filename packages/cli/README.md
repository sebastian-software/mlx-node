# @mlx-node/cli

CLI tools and scripts for mlx-node code generation.

## Purpose

Orchestrates the binding generation pipeline:
1. Parse MLX source files
2. Generate TypeScript definitions
3. Generate N-API C++ bindings
4. Validate coverage

## Commands

### Generate Bindings

```bash
pnpm generate
# or directly:
npx mlx-generate
```

Environment variables:
- `MLX_SOURCE` - Path to MLX source files (default: `.mlx-source/python/src`)
- `OUTPUT_DIR` - Output directory (default: `packages/mlx-node/generated`)

### Check Coverage

```bash
pnpm check-coverage
```

Validates that the parser captures all binding patterns in MLX source.

### Validate Completeness

```bash
pnpm validate
```

Python script for additional validation checks.

## Scripts

| Script | Purpose |
|--------|---------|
| `src/generate.ts` | Main generation orchestrator |
| `scripts/check-coverage.js` | Coverage validation |
| `scripts/validate-completeness.py` | Completeness checks |

## Output

Generated files are written to `packages/mlx-node/generated/`:

```
generated/
├── mlx-node.d.ts    # TypeScript definitions
├── binding.cpp      # N-API C++ bindings
├── binding.h        # C++ header
├── bindings.json    # Binding metadata
└── API.md           # API documentation
```

## Architecture Decision

See [ADR-008: Coverage Validation](../../docs/adr/008-coverage-validation.md) for the validation approach.
