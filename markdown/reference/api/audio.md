# API Reference: qti-clockwork-audio

## AudioEngine

| Method | Signature | Notes |
|---|---|---|
| `decodeClip` | `(data: ArrayBuffer) => Promise<AudioClip>` | Uses context decoder. |
| `play` | `(clip, bus?, options?) => AudioInstance` | Validates volume/pitch/duration; autovivifies bus name. |
| `stop` | `(instance) => void` | Stops and removes active instance. |
| `stopAll` | `() => void` | Stops every active instance. |
| `setBusVolume` | `(bus, volume) => void` | Creates bus if missing. |
| `setBusMuted` | `(bus, muted) => void` | Creates bus if missing. |
| `setMasterVolume` | `(volume) => void` | Adjusts master bus gain. |
| `getActiveInstances` | `() => readonly AudioInstance[]` | Snapshot list. |
| `dispose` | `() => void` | Stops all and disconnects all buses; future operations throw. |

## AudioInstance

| Method | Notes |
|---|---|
| `stop` | Idempotent stop with backend-error-tolerant cleanup path. |

## HeadlessAudioContext

Provides non-WebAudio fallback with deterministic-ish test behavior.

## Gotchas

- Disposed engine refuses playback/volume APIs.
- Pitch must be > 0; volume must be finite and >= 0.
- `source.onended` removes instance from active map; external code should not rely on stale active handles.
