# Platform Errors

## `read_file returned invalid payload`

Cause: bridge returned non-byte-array response.

Fix: validate tauri command contract and serialization.

## `list_dir returned invalid payload`

Cause: non-string items in bridge response.

Fix: enforce `string[]` payload from platform layer.

## `Path must be a non-empty string`

Cause: empty/invalid path passed to filesystem methods.

Fix: validate caller inputs.

## `Config ... contains path traversal`

Cause: unsafe config path in env/file (`..`).

Fix: sanitize config values and keep roots relative/safe.

## `Crash telemetry submission failed`

Cause: crash logger backend unavailable.

Fix:

1. verify telemetry endpoint/command availability
2. keep fallback logger configured
3. monitor escalated error-level telemetry failures
