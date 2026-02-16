# Clockwork

Clockwork is a TypeScript-first, modular game engine workspace focused on ECS-driven runtime systems and a WebGL2 renderer stack.

## Current Scope

Implemented in this repository:
- Core runtime packages: ECS, scheduler, events, serialization, assets, audio, app/plugin runtime
- WebGL2 renderer packages: `@clockwork/gl`, `@clockwork/shaders`, `@clockwork/materials`, `@clockwork/passes`
- Platform integration package: `@clockwork/tauri-bridge`
- Web shell app: `@clockwork/tauri-shell-web`

Planned but not fully implemented yet:
- Fixed-point determinism math module
- Full physics plugin
- Full particle simulation plugin

## Monorepo Layout

```text
engine/
  core/
    app/
    assets/
    audio/
    ecs/
    events/
    input/
    scheduler/
    serialization/
  renderer-webgl2/
    gl/
    materials/
    passes/
    shaders/
  platform/
    tauri-bridge/
apps/
  tauri-shell/
    web/
  examples/
```

## Prerequisites

- Node.js 22
- `corepack` enabled
- `pnpm` 10.x (workspace is pinned to `pnpm@10.6.3`)

## Quick Start

```bash
corepack enable
corepack pnpm install
corepack pnpm dev
```

The dev command runs the web shell in `apps/tauri-shell/web`.

## Common Commands

Run from repository root:

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
corepack pnpm build
corepack pnpm format
corepack pnpm format:check
```

Run one package:

```bash
corepack pnpm --filter @clockwork/ecs test
corepack pnpm --filter @clockwork/ecs build
corepack pnpm --filter @clockwork/tauri-shell-web dev
```

## Minimal API Example

```ts
import { AppBuilder, HeadlessRendererPlugin } from '@clockwork/app'

const app = new AppBuilder().use(HeadlessRendererPlugin).build()
app.run()
await app.step(1 / 60)
await app.shutdown()
```

## CI

GitHub Actions runs:
- lint
- typecheck
- test
- build

Workflow file: `.github/workflows/ci.yml`

## Docs

- `CONTRIBUTING.md`: contribution workflow
- `CODE_OF_CONDUCT.md`: community expectations
- `SECURITY.md`: vulnerability reporting process