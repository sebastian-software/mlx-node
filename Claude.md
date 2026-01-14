# Claude Context

Node.js bindings for MLX, automatically generated from Python bindings.

## Documentation

| Topic | Document |
|-------|----------|
| Project Overview | [README.md](README.md) |
| Architecture Decisions | [docs/adr/](docs/adr/) |
| Parser Details | [packages/parser/README.md](packages/parser/README.md) |
| Code Generators | [packages/codegen/README.md](packages/codegen/README.md) |
| CLI & Scripts | [packages/cli/README.md](packages/cli/README.md) |
| Native Addon | [packages/mlx-node/README.md](packages/mlx-node/README.md) |

## Language

**All documentation and code comments must be in US English.**

- Documentation: README files, ADRs, inline docs
- Code comments: JSDoc, inline comments, TODO notes
- Commit messages: English
- Variable/function names: English

## Code Standards

### TypeScript

- **Modules**: ESM (`"type": "module"`)
- **Target**: ES2022, NodeNext
- **Strict Mode**: Always enabled
- **No `any`**: Use explicit types
- **Imports**: Workspace packages with `@mlx-node/` prefix

```typescript
// Correct
import { NanobindRegexParser } from '@mlx-node/parser';

// Wrong
import { NanobindRegexParser } from '../parser/src';
```

### File Naming

- TypeScript: `kebab-case.ts`
- Tests: `*.test.ts`
- Scripts: `kebab-case.js` (for direct Node.js execution without build)

### Exports

Each package has a `src/index.ts` that exports all public APIs:

```typescript
// packages/parser/src/index.ts
export { NanobindRegexParser } from './regex-parser.js';
export type { Binding, Function, Class } from './types.js';
```

## Quality Guidelines

### Coverage Requirement

**100% parser coverage is mandatory.** Every nanobind pattern in MLX must be recognized.

```bash
pnpm check-coverage  # Must pass without errors
```

### Tests

- Parser: Unit tests for each pattern
- Codegen: Snapshot tests for generated output
- Native: Integration tests with actual MLX calls

```bash
pnpm test                              # All tests
pnpm --filter @mlx-node/parser test    # Parser only
```

### Before Committing

1. `pnpm build` - TypeScript compiles without errors
2. `pnpm test` - All tests pass
3. `pnpm check-coverage` - 100% coverage
4. `pnpm generate` - If parser/codegen was modified

## Dependency Rules

```
@mlx-node/parser     → no internal dependencies
@mlx-node/codegen    → may only import parser
@mlx-node/cli        → may import parser + codegen
mlx-node             → no runtime dependencies on other packages
```

**Important**: `mlx-node` consumes only *generated* files, no workspace imports.

## Generated Files

Never edit manually:

- `packages/mlx-node/generated/*`
- `**/dist/*`
- `**/*.node`

If changes are needed: Modify parser or codegen and run `pnpm generate`.

## Troubleshooting

### Parser Errors

When new MLX patterns are not recognized:

1. Add pattern to `packages/parser/src/regex-parser.ts`
2. Add test in `packages/parser/test/`
3. Verify with `pnpm check-coverage`

### Build Errors

```bash
pnpm clean && pnpm install && pnpm build
```

### Native Build Errors

```bash
pnpm --filter mlx-node rebuild
```

If MLX is not found: Set `MLX_DIR` environment variable.

## Conventions

### Commits

**Use [Conventional Commits](https://www.conventionalcommits.org/):**

```
<type>(<scope>): <description>

[optional body]

Types: feat, fix, refactor, docs, test, chore
Scopes: parser, codegen, cli, mlx-node, root
```

**Commit early and often:**

- Commit as soon as a coherent unit of work is complete
- Don't accumulate large changesets - commit incrementally
- Each commit should focus on one logical change
- Group related changes together, separate unrelated ones

**Good commits:**
- `docs(parser): add README with pattern reference`
- `feat(codegen): add type mapping for complex numbers`
- `fix(cli): handle missing MLX source directory`

**Bad commits:**
- `update files` (too vague)
- `fix everything` (too broad)
- `WIP` (not a complete unit)

### Branch Names

```
feat/add-xyz
fix/parser-issue
refactor/codegen-cleanup
```

### PR Descriptions

- What was changed?
- Why?
- How was it tested?
