# Runtime Lifecycle

Clockwork runtime lifecycle is managed by `qti-clockwork-app`.

## AppBuilder Phase

`AppBuilder` is a pre-runtime composition API.

It gathers:

- component schemas
- systems and stage placement
- resources
- asset loaders/registrations
- plugins

## Build Phase

`build()` performs:

1. plugin dependency resolution
2. plugin `init` execution in dependency order
3. `World` creation
4. `EventBus` creation
5. `Scheduler` creation
6. resource + system installation
7. `App` creation and plugin manager attach

## Run Phase

`app.run()` marks scheduler active.

`app.step(dt)` executes stage pipeline if running:

1. `Boot` (once)
2. `PreUpdate`
3. `FixedUpdate` (sub-step loop)
4. `Update`
5. `LateUpdate`
6. `RenderPrep`
7. `Render`
8. `PostRender`

`app.shutdown()` runs scheduler `Shutdown` stage, then plugin shutdown in reverse initialization order.

## Key Guarantees

- Boot runs once per runtime instance.
- Command buffers flush after each stage execution.
- Async systems are rejected in sync-only stages.
- Plugin shutdown order is reverse dependency-safe order.
