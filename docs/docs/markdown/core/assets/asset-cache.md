# Asset Cache

`qti-clockwork-assets` provides async asset loading, caching, dependency tracking, and reload semantics.

## Main Types

- `AssetCache`
- `Handle<T>`
- `AssetLoader<T>`
- `AssetSource`

## Cache Behavior

- `load(id)` returns `Handle<T>` immediately
- `waitFor(handle)` awaits completion and validates handle version
- `reload(id)` increments version and reloads dependents recursively
- `unload(id)` disposes asset and invalidates handles

## Handle Versioning

Handles include `id` + `version`.

After reload:

- old handles become invalid (`get() => undefined`)
- new handles point to latest version

## Dependency Tracking

Loaders can declare dependencies through loader context:

- `dependOn(id)`
- `loadDependency(id)`

Dependent assets auto-reload when dependencies reload.

## Built-in Loaders

- `TextureLoader` (`.png`, `.jpg`, `.jpeg`, `.webp`)
- `AtlasLoader` (`.atlas.json`)
- `AudioLoader` (`.mp3`, `.ogg`, `.wav`)
- `FontLoader` (`.ttf`, `.otf`)
- `ShaderLoader` (`.vert`, `.frag`)
- `JsonLoader` (`.json`)
- `BinaryLoader` (`.bin`)

## Path Safety

Asset IDs must be relative and traversal-free. Unsafe paths throw before load.
