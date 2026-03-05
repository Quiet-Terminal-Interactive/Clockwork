# Package Reference

These are the primary published `qti-clockwork-*` packages.

## Core

- `qti-clockwork-app`: app/runtime assembly and plugin lifecycle
- `qti-clockwork-ecs`: entities/components/resources/query/command buffer
- `qti-clockwork-scheduler`: staged loop and fixed timestep
- `qti-clockwork-events`: typed event channels
- `qti-clockwork-serialization`: world snapshots and migration
- `qti-clockwork-assets`: asset loading cache and hot reload
- `qti-clockwork-audio`: playback engine and buses
- `qti-clockwork-input`: input state and action mapping

## Renderer

- `qti-clockwork-gl`: WebGL2 context/state cache
- `qti-clockwork-shaders`: compile/link and uniform helpers
- `qti-clockwork-materials`: textures/atlases/loaders
- `qti-clockwork-passes`: batching, text, primitives, render graph

## Platform

- `qti-clockwork-tauri-bridge`: filesystem/window/config/telemetry adapters

## Build/Test Script Pattern

Most engine packages expose:

- `build` (`tsup src/index.ts --format esm,cjs --dts --clean`)
- `test` (`vitest run`)
- `typecheck` (`tsc -p tsconfig.json --noEmit`, TS projects)
- `prepack` (`pnpm run build`)
