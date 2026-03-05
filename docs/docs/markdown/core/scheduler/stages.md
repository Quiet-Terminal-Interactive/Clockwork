# Scheduler Stages

`qti-clockwork-scheduler` executes systems in named stages.

## Built-in Stages

1. `Boot` (sync)
2. `PreUpdate` (sync)
3. `FixedUpdate` (sync)
4. `Update` (sync)
5. `LateUpdate` (sync)
6. `RenderPrep` (async allowed)
7. `Render` (async allowed)
8. `PostRender` (async allowed)
9. `Shutdown` (async allowed)

## Stage Rules

- Systems sorted by `order`, tie-broken by insertion order.
- `runIf(world)` can skip system execution.
- Async system execution in sync stage throws.
- Command buffer flush runs after stage systems.
