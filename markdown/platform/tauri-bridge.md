# Tauri Bridge

`qti-clockwork-tauri-bridge` provides platform adapters for filesystem, windowing, time, config, and crash telemetry.

## Re-exported Runtime Types

From `qti-clockwork-app`:

- `ConsoleLogger`
- `defaultRuntimeConfig`
- `FileSystem`
- `Logger`
- runtime config types

## Filesystem Adapters

### MemoryFileSystem

In-memory implementation for tests and offline tooling.

### BrowserFileSystem

Fetch-based reads with optional writer/lister/watcher hooks.

### TauriFileSystem

Backed by `tauri.invoke` commands:

- `read_file`
- `write_file`
- `list_dir`
- `watch_ping` (polling watch)

Includes payload validation and structured error logging.

## Window Adapters

- `HeadlessWindow`
- `BrowserWindowAdapter`
- `TauriWindowAdapter`

## Logging and Telemetry

- `CompositeLogger`
- `TauriCrashLogger`
- `CrashReportingLogger`

`CrashReportingLogger` forwards all logs to fallback sink and submits error logs to crash telemetry asynchronously.

Repeated telemetry failures escalate from warn to error.

## RuntimeConfigLoader

Merges defaults + file + env configuration.

Recognized env keys (default prefix `CLOCKWORK_`):

- `MOD_ROOT`
- `ASSET_ROOT`
- `LOG_LEVEL`
- `ENABLE_CRASH_REPORTING`

Path traversal in config values is rejected.
