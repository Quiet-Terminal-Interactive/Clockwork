# Core Errors

## `Circular plugin dependency detected`

Cause: plugin dependency cycle in `depends` graph.

Fix:

1. Break cycle with lower-level shared plugin.
2. Move shared setup to independent plugin.

## `Plugin "X" depends on missing plugin "Y"`

Cause: missing registration for dependency id.

Fix: ensure dependency plugin is registered before build.

## `Registry key is owned by plugin ...`

Cause: plugin tries to overwrite/remove another plugin's owned key.

Fix: namespace keys or create agreed shared owner plugin.

## `Resource "..." depends on missing ...`

Cause: inserting a resource type with unmet declared dependencies.

Fix: insert dependencies first with required versions.

## `Scheduler.step requires a finite deltaTime >= 0`

Cause: NaN/negative dt input.

Fix: clamp/validate dt at caller boundary.

## `Stage "X" does not allow async systems`

Cause: async system registered in sync stage.

Fix: keep sync stage systems synchronous or move async work to allowed stage.

## `Cannot infer event type for primitive values`

Cause: `events.send(primitive)` without explicit type.

Fix: use `events.send(type, event)` channel form.

## `Asset path ... contains path traversal`

Cause: unsafe asset id.

Fix: ensure relative normalized ids without `..`.

## `Missing migration for component ...`

Cause: deserializing snapshot where schema version changed without `migrate`.

Fix: provide migration function or maintain compatible version.
