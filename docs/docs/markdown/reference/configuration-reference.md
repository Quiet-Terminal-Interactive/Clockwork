# Configuration Reference

This page describes Clockwork source-repository tooling config.
If you are only consuming published `qti-clockwork-*` packages, you do not need these workspace settings.

## Root Scripts (`package.json`)

- `build`: recursive package builds
- `dev`: runs the internal source-repo shell app (`qti-clockwork-tauri-shell-web`)
- `lint`: ESLint root run
- `format`: Prettier write
- `format:check`: Prettier check
- `test`: Vitest run
- `typecheck`: `tsc -b`

## Workspace (`pnpm-workspace.yaml`)

Includes:

- `engine/core/*`
- `engine/renderer-webgl2/*`
- `engine/platform/*`
- `apps/*/web`

## TypeScript/JavaScript Resolution (`tsconfig.base.json`)

Notable strictness:

- `strict`
- `noUncheckedIndexedAccess`
- `exactOptionalPropertyTypes`
- `isolatedModules`
- `verbatimModuleSyntax`

Internal path aliases map package names to local source entrypoints. JavaScript consumers can mirror this with `jsconfig.json` or bundler aliases.

## Tests (`vitest.config.ts`)

- node environment
- globals enabled
- include patterns for `engine/**` + `apps/**`
- alias map mirrors TypeScript/JavaScript package aliases

## ESLint (`eslint.config.mjs`)

- TypeScript-aware linting via `@typescript-eslint` (JS projects can use ESLint-only subsets)
- Prettier compatibility
- core import restrictions against renderer/platform packages

## Prettier (`.prettierrc.json`)

- `semi: false`
- `singleQuote: true`
- `trailingComma: none`
