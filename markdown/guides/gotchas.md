# Guide: Gotchas and Failure Modes

## Runtime / Plugins

- Duplicate plugin ids throw at registration.
- Circular dependencies throw during build.
- Plugin ownership prevents mutating another plugin's registry keys.

## ECS

- Entity indices are recycled; stale generation makes old handles invalid.
- `.changed()` query behavior depends on prior iterations of same query instance.
- Deferred commands do nothing until `flush()`.

## Scheduler

- Async systems only allowed in async-enabled stages.
- Large frame spikes can drop fixed-step remainder after `maxCatchUpSteps`.
- `step()` with invalid dt (`NaN`, negative) throws.

## Events

- Plain object events require explicit channel type; inference fails.
- `sendImmediate` bypasses buffered channels.

## Assets

- Unsafe asset paths (`..`, absolute) are rejected before loading.
- Old handles become invalid after reload version bump.
- Loader errors surface through `waitFor` and are cached per entry.

## Serialization

- Snapshot version mismatch without migration throws.
- Implicit type ids can collide; set explicit `typeId` for stable long-term saves.

## Renderer

- GL context calls before init throw.
- `RenderGraph.execute()` requires successful `compile()` first.
- `SpriteBatch` capacity is bounded by Uint16 index limits.

## Platform / Tauri Bridge

- Tauri file watch is polling by default (latency and missed-spike considerations).
- Crash telemetry failures are intentionally non-fatal and may only warn initially.
- Config path traversal from file/env is rejected.

## Tooling

- Keep alias mappings in `tsconfig.base.json`/`jsconfig.json` and `vitest.config.ts`/`vitest.config.js` in sync.
- ESLint core-layer import restrictions intentionally block core->renderer/platform imports.

## Related Docs

- [Error Catalog](../reference/errors/index.md)
- [Runnable Examples](../reference/examples/index.md)
- [Decision Guides](decisions/ecs-queries.md)
