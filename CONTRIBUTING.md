# Contributing to Clockwork

## Before You Start

- Use Node.js 22.
- Enable `corepack`.
- Install dependencies from repo root:

```bash
corepack pnpm install
```

## Development Workflow

1. Create a branch from `main`.
2. Make focused changes with tests.
3. Run quality checks locally.
4. Open a pull request with clear context.

## Required Checks

Run these commands from repo root before opening a PR:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
```

If formatting is needed:

```bash
corepack pnpm format
```

## Project Rules

- Keep core and platform boundaries clean:
  - Core packages must not import platform packages.
- Components are data-only; behavior belongs in systems.
- Prefer deterministic behavior in scheduling/query logic.
- Add or update tests for behavior changes.

## Pull Request Guidelines

- Explain what changed and why.
- Link related issues (if any).
- Call out API, behavior, or architecture impact.
- Include follow-up work if something is intentionally deferred.

## Commit Guidance

- Keep commits small and coherent.
- Use clear commit messages (imperative style).
- Avoid mixing refactors with functional changes unless necessary.

## Package-Level Commands

Run commands against a single workspace package:

```bash
corepack pnpm --filter @clockwork/ecs test
corepack pnpm --filter @clockwork/app build
corepack pnpm --filter @clockwork/tauri-shell-web dev
```

## Reporting Issues

- Use issue reports for bugs and feature requests.
- Provide reproduction steps, expected behavior, and actual behavior.
- Include environment details (OS, Node version, package/version context).

## Conduct and Security

- Community behavior expectations: `CODE_OF_CONDUCT.md`
- Security reporting process: `SECURITY.md`
