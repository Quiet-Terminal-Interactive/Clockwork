# Architecture Overview

Clockwork is a layered TypeScript/JavaScript engine architecture distributed as modular packages.

## Layers

1. Core runtime (`qti-clockwork-app`, `qti-clockwork-ecs`, `qti-clockwork-scheduler`, etc.)
2. Renderer (`qti-clockwork-gl`, `qti-clockwork-shaders`, `qti-clockwork-materials`, `qti-clockwork-passes`)
3. Platform bridge (`qti-clockwork-tauri-bridge`)
4. Apps (consumer-owned game/app code)

## Core Design Rules

- Runtime logic is package-local and composable.
- Internal APIs are consumed via package names (`qti-clockwork-*`).
- Core packages avoid direct renderer/platform coupling.
- Systems are stage-ordered and deterministic by default.

## Package Groups

### Core

- `qti-clockwork-app`
- `qti-clockwork-ecs`
- `qti-clockwork-scheduler`
- `qti-clockwork-events`
- `qti-clockwork-serialization`
- `qti-clockwork-assets`
- `qti-clockwork-audio`
- `qti-clockwork-input`

### Renderer

- `qti-clockwork-gl`
- `qti-clockwork-shaders`
- `qti-clockwork-materials`
- `qti-clockwork-passes`

### Platform

- `qti-clockwork-tauri-bridge`

## Runtime Assembly Flow

1. Create `AppBuilder`
2. Register plugins
3. Build runtime (`World` + `EventBus` + `Scheduler`)
4. Run frame loop (`run`, `step`, `shutdown`)

## References

- [Runtime Lifecycle](runtime-lifecycle.md)
- [Plugin System](plugin-system.md)
- [Determinism](determinism.md)
- [Runtime Sequences](sequences.md)
