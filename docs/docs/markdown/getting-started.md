# Getting Started with Clockwork

## What You'll Learn

This guide explains the Clockwork runtime model and how to use packages in your project.

You will learn:

- How packages are grouped and when to install each
- How `AppBuilder`, `World`, and `Scheduler` fit together
- How plugins register systems/resources/components
- Where to begin when adding engine features in your game/app

---

## Prerequisites

Before continuing:

1. Complete [Installation](installation.md)
2. Have a TypeScript or JavaScript project ready
3. Be familiar with JavaScript basics (TypeScript optional)

---

## Package Groups

Clockwork is split into three package families:

1. **Core runtime** (`qti-clockwork-app`, `qti-clockwork-ecs`, `qti-clockwork-scheduler`, etc.)
2. **Renderer** (`qti-clockwork-gl`, `qti-clockwork-shaders`, `qti-clockwork-materials`, `qti-clockwork-passes`)
3. **Platform bridge** (`qti-clockwork-tauri-bridge`)

---

## Runtime Flow

The runtime lifecycle is:

1. Build app with `AppBuilder`
2. Register plugins (`builder.use(plugin)`)
3. Build runtime (`builder.build()`)
4. Start loop (`app.run()`)
5. Tick frames (`await app.step(dt)`)
6. Shutdown (`await app.shutdown()`)

The scheduler processes stages in order:

- `Boot`
- `PreUpdate`
- `FixedUpdate`
- `Update`
- `LateUpdate`
- `RenderPrep`
- `Render`
- `PostRender`
- `Shutdown`

---

## ECS Fundamentals

`qti-clockwork-ecs` provides:

- **Entities:** generation-safe entity handles
- **Components:** sparse stores keyed by component type
- **Queries:** `with/without/optional/changed` filters
- **CommandBuffer:** deferred spawn/destroy/component mutation
- **Resources:** typed global runtime state via resource tokens

Minimal world usage:

```js
import { World } from 'qti-clockwork-ecs'

const world = new World()
const e = world.spawn().build()
world.addComponent(e, 'position', { x: 0, y: 0 })
```

---

## Plugin Model

`qti-clockwork-app` provides plugin orchestration:

- Dependency-ordered plugin initialization
- Ownership-aware registries for components/systems/resources/assets
- Plugin shutdown in reverse init order
- Isolated plugin reload error handling

Plugin shape:

```js
const plugin = {
  id: 'example',
  version: '1.0.0',
  depends: [],
  init(app) {},
  shutdown(app) {},
  reload() {}
}
```

---

## Development Workflow

Use this baseline loop:

1. Add/update your game/app systems/plugins
2. Run your tests (`npm test`)
3. Run typecheck (`npm run typecheck`)
4. Run lint (`npm run lint`)

---

## Where to Go Next

- [Packages Overview](packages.md) for package-by-package responsibilities
- [Runtime and Plugin APIs](runtime.md) for detailed runtime concepts
- [Testing](testing.md) for project-level validation guidance
- [FAQ](faq.md) for common setup and architecture questions
- [Architecture Overview](architecture/overview.md) for full system design
- [ECS Deep Dives](core/ecs/overview.md) for entities/components/query internals
- [Renderer Deep Dives](renderer/passes.md) for batching, text, and render graph flow
