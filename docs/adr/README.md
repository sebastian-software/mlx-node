# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for mlx-node.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences.

## ADR Index

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](001-python-bindings-as-source.md) | Parse Python Bindings as Source of Truth | Accepted |
| [ADR-002](002-regex-based-parser.md) | Regex-Based Parser over AST/Tree-Sitter | Accepted |
| [ADR-003](003-napi-bindings.md) | N-API over Native Abstractions | Accepted |
| [ADR-004](004-code-generation.md) | Generate Code Instead of Manual Bindings | Accepted |
| [ADR-005](005-pnpm-turborepo-monorepo.md) | Monorepo with pnpm and Turborepo | Accepted |
| [ADR-006](006-fine-grained-packages.md) | Fine-Grained Package Structure | Accepted |
| [ADR-007](007-stub-mode.md) | Stub Mode for Development Without MLX | Accepted |
| [ADR-008](008-coverage-validation.md) | Coverage Validation as Quality Gate | Accepted |
| [ADR-009](009-cpp-header-based-generation.md) | C++ Header-Based Generation | Accepted |

## Template

New ADRs should follow this template:

```markdown
# ADR-NNN: Title

## Status
[Proposed | Accepted | Deprecated | Superseded by ADR-XXX]

## Context
[Describe the problem and the forces at play]

## Decision
[Describe the decision that was made]

## Rationale
[Explain why this decision was chosen over alternatives]

## Consequences
[List the positive and negative consequences of this decision]
```
