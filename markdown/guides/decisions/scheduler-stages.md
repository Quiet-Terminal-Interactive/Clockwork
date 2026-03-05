# Decision Guide: Scheduler Stage Placement

## `Boot`

Use for one-time initialization dependent on runtime construction.

## `PreUpdate`

Use for input sampling, event ingestion, and pre-sim prep.

## `FixedUpdate`

Use for deterministic simulation:

- gameplay rules
- physics-like updates
- lockstep-critical logic

Keep synchronous.

## `Update`

Use for variable-rate gameplay logic that need not be fixed-step strict.

## `LateUpdate`

Use for ordering-dependent adjustments after main update.

Example: camera follow after player movement.

## `RenderPrep`

Use for render data extraction and buffer preparation. Async allowed.

## `Render`

Use for GPU submission/render execution. Async allowed.

## `PostRender`

Use for cleanup, frame metrics, and deferred post effects. Async allowed.

## `Shutdown`

Use for teardown and final flush.

## Placement Rules

1. Deterministic simulation -> `FixedUpdate`.
2. IO/network/async -> render-allowed async stages or external queue.
3. Order-sensitive reads after writes -> later stage, not higher order in same stage by default.
