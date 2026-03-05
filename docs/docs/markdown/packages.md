# Packages Overview

This page focuses on packages you install in your own project.

## Core Runtime Packages

### `qti-clockwork-app`

- App runtime assembly (`AppBuilder`, `App`)
- Plugin manager with dependency ordering
- Ownership-safe component/system/resource/asset registries
- Runtime inspectors and mod manager primitives
- Deep dive: [Plugin System](architecture/plugin-system.md), [Runtime Lifecycle](architecture/runtime-lifecycle.md)

### `qti-clockwork-ecs`

- Entity manager with generation safety
- Sparse component stores
- Query API (`with`, `without`, `optional`, `changed`)
- Resource map and command buffer
- Deep dive: [ECS Overview](core/ecs/overview.md), [Queries](core/ecs/queries.md)

### `qti-clockwork-scheduler`

- Staged game loop execution
- Fixed-step accumulation
- Optional async render stages
- Profiler and determinism validation helpers
- Deep dive: [Scheduler Stages](core/scheduler/stages.md), [Determinism](architecture/determinism.md)

### `qti-clockwork-events`

- Typed event channels
- Buffered (`send`) and immediate (`sendImmediate`) dispatch
- Listener registration and cleanup
- Deep dive: [Event Bus](core/events/event-bus.md)

### `qti-clockwork-serialization`

- Versioned component schema registration
- World snapshot serialize/deserialize
- Optional migration support between component versions
- Deep dive: [World Serializer](core/serialization/world-serializer.md)

### `qti-clockwork-assets`

- Loader registry by extension
- Async load/wait/reload/unload lifecycle
- Dependency tracking between assets
- Hot-reload hooks when source watches are available
- Deep dive: [Asset Cache](core/assets/asset-cache.md)

### `qti-clockwork-audio` / `qti-clockwork-input`

- Optional support packages for audio and input flows
- Structured for modular engine-level integration
- Deep dive: [Audio Engine](core/audio/audio-engine.md), [Input Manager](core/input/input-manager.md)

### `qti-clockwork-math`

- Deterministic Q16.16 scalar math (`Fixed`)
- Fixed-point 2D vector helpers (`Vec2`)
- Axis-aligned bounding box helpers (`AABB`)
- Deep dive: [Math Package](math.md)

### `qti-clockwork-physics`

- Deterministic 2D rigid-body simulation plugin (`PhysicsPlugin`)
- Physics components (`RigidBody`, `Collider`, `PhysicsMaterial`, `StructuralBody`)
- Collision lifecycle events and constraint solver pipeline
- Structural stress and fracture helpers for destructible bodies
- Deep dive: [Physics Package](physics.md)

### `qti-neon-client`

- Neon networking client protocol helpers and packet framing
- Typed packet registry for game payload serialization
- Transport abstraction (`MockTransport`, `TauriUdpTransport`)
- Client state machine with reconnect and reliability retry flow
- Deep dive: [Neon Package](neon.md)

### `qti-clockwork-particles`

- Deterministic simulation particles with builtin material reactions
- Visual particle emitters and preset burst workflows
- Physics coupling for buoyancy, pressure, and structural erosion
- Render graph pass integration and optional GPU backend path
- Deep dive: [Particles Package](particles.md)

### `qti-clockwork-lighting`

- Deferred 2D lighting pipeline with point/spot/ambient light components
- CPU shadow atlas generation from occluder segments
- Light accumulation, composite, and post-process pass chain
- Bloom, vignette, and colour LUT configuration support
- Deep dive: [Lighting Package](lighting.md)

## Renderer Packages

- `qti-clockwork-gl`
- `qti-clockwork-shaders`
- `qti-clockwork-materials`
- `qti-clockwork-passes`

These packages isolate rendering concerns from gameplay/runtime core code.

Deep dives:

- [GL](renderer/gl.md)
- [Shaders](renderer/shaders.md)
- [Materials](renderer/materials.md)
- [Passes](renderer/passes.md)

## Platform Package

### `qti-clockwork-tauri-bridge`

Bridge layer intended for Tauri/platform integration boundaries.

Deep dive: [Tauri Bridge](platform/tauri-bridge.md)
