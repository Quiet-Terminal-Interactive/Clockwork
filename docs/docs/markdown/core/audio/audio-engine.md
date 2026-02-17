# Audio Engine

`qti-clockwork-audio` wraps audio playback with bus routing and instance lifecycle management.

## Main Types

- `AudioEngine`
- `AudioClip`
- `AudioBus`
- `AudioInstance`
- `HeadlessAudioContext`

## Buses

Engine auto-creates buses:

- `master`
- `music`
- `sfx`
- `ui`

Each bus supports independent volume + mute.

## Playback

`play(clip, bus, options)` creates an `AudioInstance`.

Options:

- `volume` (>= 0)
- `pitch` (> 0)
- `loop`

Invalid options throw.

## Lifecycle

- `stop(instance)` stops one instance
- `stopAll()` stops all active instances
- `dispose()` stops all, disconnects buses, and prevents further use

Using engine after dispose throws.

## Headless Context

`HeadlessAudioContext` is a non-browser test/runtime fallback implementing the same interface.
