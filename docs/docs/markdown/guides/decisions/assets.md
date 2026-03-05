# Decision Guide: Asset Loading Strategy

## When to `load` + `waitFor`

Use for required startup assets.

Pattern:

1. `handle = cache.load(id)`
2. `await cache.waitFor(handle)`
3. fail fast if missing

## When to Use Lazy `load` + `get`

Use for optional assets or progressive loading.

Pattern:

- request handle now
- check `get()` each frame
- render fallback until available

## When to `reload`

Use for live-edit pipelines and hot-reload workflows.

Important: old handles invalidate after version bump.

## When to `unload`

Use for scene transitions or memory pressure.

Ensure no consumers depend on stale handles.

## Dependency Recommendations

1. Atlas/metadata loaders should declare texture dependencies.
2. Keep asset ids normalized and relative.
3. Use extension-specific loaders; avoid catch-all parsing.

## Error Handling

- Wrap `waitFor` in try/catch.
- Log and surface failing asset ids.
- Provide fallback assets for non-critical paths.
