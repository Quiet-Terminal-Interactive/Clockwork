# Clockwork Engine Spec

## 0) Goals and Non-Goals

### Goals

* **API-only**: no editor, no in-engine GUI required.
* **Modular everything**: plugins can add systems, components, resources, asset loaders, renderer passes.
* **ECS at the center**: entities are IDs, components are pure data, systems do behavior.
* **Configurable tick loop**: fixed-step simulation + variable render, or fully custom scheduler.
* **WebGL2 rendering backend**: 2D first, extensible to 2.5D, can be adapted to 3D later.
* **Tauri desktop shell**: engine runs inside a webview; platform features via Tauri bridge.
* **Determinism-friendly**: predictable ordering, stable iteration, optional fixed-point / seeded RNG.
* **Testable**: headless mode so logic runs without GPU.
* **Mod-friendly**: component schemas + asset pipeline designed for content packs.

### Non-Goals

* No full 3D engine ambition in v1
* No editor tooling baked in.
* No physics engine rewrite — integrate a library when needed.

---

# 1) Architecture Overview

## 1.1 Layers

**Core (pure TS/JS, platform-agnostic)**

* ECS World + Scheduler
* Plugin Manager
* Asset system (abstract I/O)
* Time + Input abstraction
* Events + Messaging
* Deterministic utilities
* Debug instrumentation hooks (API-only)

**Renderer (WebGL2 module)**

* Render graph / passes
* Materials, shaders, pipelines
* Sprite / text / tile / primitive draw
* Batching + instancing
* GPU resource management
* Optional post-processing chain

**Platform Shell**

* Tauri app (Rust) + front-end (TS)
* File I/O, native dialogs, windowing controls
* Controller/rumble, filesystem access, save data
* Logging integration

---

# 2) ECS Specification

## 2.1 Entities

* `EntityId` is a 32-bit integer.
* Entity lifecycle: `create()`, `destroy()`.
* Reuse IDs via generational index to avoid stale references:

  * `Entity = { index: u32, gen: u32 }` packed to 64-bit in JS via bigint or two ints.

## 2.2 Components

Components are pure data, no methods.

### Component requirements

* Must be serializable (structured clone / AVRON / binary).
* Must declare a schema:

  * name
  * version
  * fields (types, defaults)
  * optional migration path

### Storage

Engine must support multiple storage strategies:

* **Dense SoA** (default): `ComponentStore<T>` with packed arrays.
* **Sparse map** (for rare components).
* **Tag components** (boolean presence only).
* **Chunked archetype mode (optional future)**: allow high-perf.

## 2.3 Resources (Global Singletons)

Global state stored in `Resources` table:

* `Time`, `Input`, `Renderer`, `Assets`, `Rng`, `Config`, `Profiler`
* Plugins can register resources.
* Resources are versioned and can be hot-swapped.

## 2.4 Systems

A system is a function with declared dependencies:

```ts
type System = (ctx: SystemContext) => void | Promise<void>;
```

### System metadata

* `id`, `stage`, `order`
* `reads`: component/resource reads
* `writes`: component/resource writes
* `queries`: component sets with optional filters
* `run_if`: predicate (e.g. only if window focused)

This metadata exists so it is possible to:

* detect conflicts
* schedule in parallel later
* build a debug “why is this system running” trace

## 2.5 Queries

Query API supports:

* `with(A, B)`
* `without(C)`
* `optional(D)`
* `changed(A)` (dirty tracking)
* `added(A)`, `removed(A)` events

Query iteration order is stable and deterministic by default:

* sorted by `EntityId` ascending unless user opts out.

---

# 3) Engine Loop / Scheduler Spec

## 3.1 Timeline model

Engine supports two clocks:

* **Simulation clock** (fixed step)
* **Render clock** (variable, vsync-driven)

Default config:

* `fixedDelta = 1/60`
* `maxCatchUpSteps = 5` (prevents spiral of death)
* `renderInterpolation = true` (lerp transform for smoothness)

## 3.2 Stages

Built-in stages (customizable):

1. `Boot`
2. `PreUpdate`
3. `FixedUpdate` (0..n steps each frame)
4. `Update` (once per frame)
5. `LateUpdate`
6. `RenderPrep`
7. `Render`
8. `PostRender`
9. `Shutdown`

Plugins can add stages and reorder (within constraints).

## 3.3 Tick loop API

Users can:

* use default loop
* override scheduler
* inject custom stages/systems

Engine exposes:

* `engine.step(dtReal)` for manual stepping
* `engine.run()` which binds to `requestAnimationFrame`
* `engine.pause()` / `resume()`

## 3.4 Async systems

Support promise-returning systems with rules:

* `FixedUpdate` stage is sync-only by default (determinism).
* Async allowed in `Update`, `RenderPrep`, asset stages.
* Provide explicit `AsyncStage` if needed.

---

# 4) Plugin System

## 4.1 Plugin interface

A plugin is a module exporting:

```ts
interface Plugin {
  id: string;
  version: string;
  depends?: string[];
  init(app: AppBuilder): void;
  shutdown?(app: App): void;
}
```

## 4.2 Capabilities plugins can register

* components + schema
* resources
* systems + stages
* render passes
* asset loaders
* event types
* serialization handlers
* debug panels (API endpoints only)

## 4.3 Hot reload

* Plugins may be reloadable if they:

  * don’t change schema incompatibly
  * provide migration steps
* Engine can swap systems safely between frames.
* Renderer resources must support recompile/reupload.

---

# 5) Event / Messaging Model

## 5.1 Event Bus

* Typed event channels: `Events<T>`
* Events are stored per-frame and cleared by stage boundaries.
* Events can be:

  * immediate (synchronous dispatch)
  * buffered (frame-late consumption)

Defaults to buffered.

## 5.2 Commands

A `CommandBuffer` queues world mutations:

* create/destroy
* add/remove components
* set resource

Executed at safe sync points (end of stages).

This prevents “mutate while iterating.”

---

# 6) Asset System

## 6.1 Asset IDs and handles

* `AssetId` is stable (string or hashed).
* `Handle<T>` references an asset + version.
* Assets are loaded through loaders based on extension / declared type.

## 6.2 Loaders

Loaders are plugins:

* `TextureLoader`
* `AtlasLoader`
* `ShaderLoader`
* `AudioLoader`
* `FontLoader`
* `AvronLoader`
* `BinaryBlobLoader`

Loaders must support:

* async load
* caching
* hot reload (dev mode)
* dependency tracking (atlas depends on textures)

## 6.3 Storage

Assets live in:

* `AssetCache` (CPU)
* `GpuCache` (GPU-resident resources)

They can evict by policy (LRU, memory budget).

## 6.4 File I/O abstraction

Engine never directly touches filesystem:

* uses `AssetSource` interface

  * `fetch(url)`
  * `readFile(path)` (provided by platform shell)
  * `watch()` (dev mode)

Tauri provides `readFile`, `watch`, saves.

---

# 7) Rendering System (WebGL2)

## 7.1 Core renderer goals

* 2D renderer with:

  * sprites
  * sprite atlas support
  * text (SDF or bitmap font)
  * tilemaps
  * basic shapes (lines/rects/circles)
* Batching:

  * dynamic sprite batches
  * instancing where possible
* Render graph:

  * passes + dependencies
  * optional post stack (blur, bloom, CRT, etc.)

## 7.2 Coordinate conventions

* World units: floats
* Camera is orthographic by default in v1.
* Z used for layering only (or render order key).
* Origin configurable: center or top-left (default top-left for 2D sanity).

## 7.3 Render components

Minimum required components:

**Transform2D**

* position (x,y)
* rotation (radians)
* scale (x,y)
* zIndex

**Sprite**

* texture/atlas handle
* UV rect
* tint RGBA
* pivot
* blend mode

**Camera2D**

* position
* zoom
* viewport
* clear color
* layers mask

Also planned:

* `Light2D`, `ParticleEmitter`, `NineSlice`

## 7.4 Materials & Shaders

* Material is a shader + uniform set + render state.
* Shaders compiled with caching and error reporting hooks.

## 7.5 Text rendering

Text is rendered through SDF.

---

# 8) Input System

## 8.1 Input abstraction

Support:

* keyboard
* mouse
* wheel
* touch (future)
* gamepad

Input snapshots each frame:

* `isDown`, `wasPressed`, `wasReleased`
* pointer position in screen + world coords

Support action mapping:

* `ActionMap` defines actions -> bindings
* allow user rebinding

---

# 9) Audio System

* WebAudio backend
* `AudioClip` assets
* `AudioSource` component:

  * play/stop/pause
  * loop
  * spatial (optional later)
* Mixer buses:

  * master/music/sfx/ui
* Volume + mute controls

---

# 10) Serialization & Save Data

## 10.1 World serialization modes

* **Snapshot**: full world state for save/load
* **Replay**: inputs + seeded RNG for deterministic replays (best-effort)

## 10.2 Component serialization

Each component schema provides:

* `serialize(component) -> bytes/avron`
* `deserialize(data) -> component`
* `migrate(versionFrom -> versionTo)`

## 10.3 Save system

Platform provides storage:

* Tauri: app data dir
* Web: IndexedDB (if used later)

---

# 11) Determinism Features

* Fixed update step
* Stable system order
* Stable query order
* Seeded RNG resource
* Optional fixed-point math module (for “true determinism” mode)

Engine should expose a “determinism score” debug report:

* warns if non-deterministic systems run in FixedUpdate
* warns if time-based randomness is used
* warns if iteration order is unstable

---

# 12) Debug + Instrumentation (API-only)

No GUI, but expose introspection APIs:

* `engine.inspect.world()`:

  * entity count
  * component counts
  * archetype-ish stats
* `engine.inspect.systems()`:

  * stage order
  * last run time
  * average runtime
* `engine.inspect.assets()`:

  * loaded assets
  * GPU memory estimate
* Profiler hooks:

  * per-system timings
  * render timings
  * GC hints (where possible)

Expose a simple local HTTP debug endpoint in dev mode (Tauri/Rust side) alongside JS API.

---

# 13) Error Handling & Logging

* Structured logger:

  * levels: trace/debug/info/warn/error
  * tags (system/plugin/renderer)
  * supports platform sinks:

    * console
    * file (Tauri)
    * in-memory ring buffer for crash reports

Renderer errors:

* shader compile errors should include:

  * line numbers
  * full expanded source (with includes resolved)
  * material name

---

# 14) Project Layout

```
/engine
  /core
    ecs/
    scheduler/
    assets/
    input/
    audio/
    events/
    serialization/
  /renderer-webgl2
    gl/
    passes/
    shaders/
    materials/
  /platform
    tauri-bridge/
  index.ts

/apps
  /tauri-shell
    src-tauri/
    web/
```

---

# 15) Public API

## 15.1 Bootstrapping

```ts
const app = createApp()
  .use(CorePlugin)
  .use(WebGL2RendererPlugin)
  .use(AudioPlugin)
  .use(AssetPlugin)
  .use(MyGamePlugin)
  .build();

app.run();
```

## 15.2 Registering components

```ts
app.components.register(Transform2D, schema);
```

## 15.3 Adding systems

```ts
app.systems.add("FixedUpdate", myMovementSystem, { order: 50 });
```

## 15.4 Spawning entities

```ts
const e = world.spawn()
  .add(Transform2D, { x:0, y:0 })
  .add(Sprite, { texture: texHandle })
  .id();
```

---

# 16) Tauri Integration Notes

* WebGL runs inside the webview — good.
* Native filesystem access via Tauri commands:

  * `readFile(path)`
  * `writeFile(path)`
  * `listDir(path)`
  * `watchDir(path)` (dev)
* Save data uses Tauri app config dir.
* Crash logs can be persisted via Rust side sink.

---

# 17) Hard Rules

1. **Core never imports platform.** Platform imports core.
2. **Components are data only.** Behavior lives in systems.
3. **Systems don’t mutate world directly during iteration.** Use command buffer.
4. **Renderer is a plugin.** You can run headless without it.
5. **Everything versioned.** Components, assets, plugins.