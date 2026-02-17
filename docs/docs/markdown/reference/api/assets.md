# API Reference: qti-clockwork-assets

## AssetCache

| Method | Signature | Notes |
|---|---|---|
| `registerLoader` | `(loader) => void` | Registers loader for each extension; latest wins for same extension. |
| `load` | `(id) => Handle<T>` | Starts async load if needed, returns versioned handle immediately. |
| `get` | `(handle) => T | undefined` | Returns value only if handle version matches latest and no error exists. |
| `waitFor` | `(handle) => Promise<T>` | Waits load completion and throws on failure/unavailable handle. |
| `unload` | `(id) => void` | Stops watch, unlinks dependencies, disposes asset, removes entry. |
| `reload` | `(id) => Promise<void>` | Version bump, reload, then cascades to dependents. |

## Handle<T>

| Method | Notes |
|---|---|
| `get` | Current handle value if still valid. |
| `isLoaded` | Shortcut for `get() !== undefined`. |

## Built-in Loaders

- `TextureLoader` (`.png`, `.jpg`, `.jpeg`, `.webp`)
- `AtlasLoader` (`.atlas.json`)
- `AudioLoader` (`.mp3`, `.ogg`, `.wav`)
- `FontLoader` (`.ttf`, `.otf`)
- `ShaderLoader` (`.vert`, `.frag`)
- `JsonLoader` (`.json`)
- `BinaryLoader` (`.bin`)

## Gotchas

- Asset IDs must be relative and traversal-free.
- Reload invalidates old handles by version; always reacquire handle for latest asset.
- Watch callback errors are logged; ensure callbacks are robust and idempotent.
