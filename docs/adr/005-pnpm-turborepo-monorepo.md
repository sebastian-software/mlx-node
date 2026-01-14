# ADR-005: Monorepo with pnpm and Turborepo

## Status
Accepted

## Context
As the project grew, we needed better organization:

1. **Single Package** - All code in one npm package
2. **Separate Repos** - Parser, codegen, runtime as separate repositories
3. **Monorepo** - Multiple packages in one repo with shared tooling

Package manager options:
- npm workspaces
- yarn workspaces
- pnpm workspaces

Build orchestration options:
- npm scripts
- Lerna
- Nx
- Turborepo

## Decision
Use a pnpm workspace monorepo with Turborepo for build orchestration.

## Rationale

### pnpm over npm/yarn
- **Disk Efficiency**: Content-addressable storage, no duplicate packages
- **Strict Dependencies**: Prevents phantom dependencies
- **Speed**: Faster installs due to hard links
- **Workspace Protocol**: `workspace:*` for local dependencies

### Turborepo over alternatives
- **Simplicity**: Zero-config for common cases
- **Caching**: Local and remote build caching
- **Parallelization**: Automatic parallel task execution
- **Dependency-Aware**: Respects `dependsOn` for correct build order

## Configuration

### pnpm-workspace.yaml
```yaml
packages:
  - 'packages/*'
```

### turbo.json
```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "generate": {
      "dependsOn": ["^build"],
      "outputs": ["packages/mlx-node/generated/**"],
      "cache": false
    },
    "test": {
      "dependsOn": ["build"]
    }
  }
}
```

### Root package.json
```json
{
  "name": "mlx-node-monorepo",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "test": "turbo run test",
    "generate": "turbo run generate"
  },
  "devDependencies": {
    "turbo": "^2.0.0",
    "typescript": "^5.9.3"
  },
  "packageManager": "pnpm@9.15.0"
}
```

## Consequences

### Positive
- Clean separation of concerns
- Faster builds with caching (2.8s → 0.5s on cache hit)
- Easier to add new packages
- Single CI pipeline for everything
- Atomic commits across packages

### Negative
- More complex initial setup
- Learning curve for contributors
- pnpm less common than npm
