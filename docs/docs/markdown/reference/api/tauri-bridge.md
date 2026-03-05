# API Reference: qti-clockwork-tauri-bridge

## Filesystem Adapters

### MemoryFileSystem

| Method | Notes |
|---|---|
| `readFile/writeFile` | In-memory byte IO with copies for safety. |
| `listDir` | Lists one directory segment under prefix. |
| `watch` | Path-keyed callback registration with unsubscribe. |

### BrowserFileSystem

| Method | Notes |
|---|---|
| `readFile` | Fetch-based read to `Uint8Array`. |
| `writeFile` | Optional writer; throws when unavailable. |
| `listDir` | Optional lister; throws when unavailable. |
| `watch` | Optional watcher; no-op unsubscribe fallback. |

### TauriFileSystem

| Method | Notes |
|---|---|
| `readFile` | Calls `read_file`, validates byte payload [0..255]. |
| `writeFile` | Calls `write_file` with numeric byte array. |
| `listDir` | Calls `list_dir`, validates string array payload. |
| `watch` | Polls `watch_ping` every second; warns on transient failures. |

## Window Adapters

- `HeadlessWindow`
- `BrowserWindowAdapter`
- `TauriWindowAdapter`

Key methods: `getSize`, `setSize`, `setTitle`, `isFullscreen`, `setFullscreen`, `close`.

## Logging and Config

### Loggers

- `ConsoleLogger`
- `CompositeLogger`
- `CrashReportingLogger`
- `TauriCrashLogger`

### RuntimeConfigLoader

| Method | Notes |
|---|---|
| `loadFromFile` | Reads JSON, validates runtime config shape and path safety. |
| `loadFromEnv` | Parses prefixed env vars into partial runtime config. |
| `merge` | Merges defaults with provided partial sources (later wins). |

## Gotchas

- Tauri watch is polling-based by default, not native file watcher events.
- Crash telemetry submission failures escalate log level after repeated failures.
- Config path fields reject traversal (`..`) from both file and env sources.
