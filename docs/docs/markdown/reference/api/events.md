# API Reference: qti-clockwork-events

## EventBus

| Method | Signature | Notes |
|---|---|---|
| `send` | `(event)` or `(type, event)` | Buffered channel enqueue. |
| `sendImmediate` | `(event)` or `(type, event)` | Immediate listener dispatch, no buffering. |
| `listen` | `(type) => Events<T>` | Read-only snapshot of current buffer for channel. |
| `on` | `(type, listener) => unsubscribe` | Registers listener set by channel. |
| `clear` | `(type?) => void` | Clears one channel or all buffers. |

## Events<T>

| Method | Notes |
|---|---|
| `iter` | Iterator over buffered events. |
| `isEmpty` | Channel has no buffered events. |
| `len` | Buffered event count. |

## Built-in Event Classes

- `CollisionEvent`
- `DamageEvent`
- `InputEvent`

## Gotchas

- Event type inference fails for primitives and plain objects; use explicit channel type.
- `sendImmediate` does not populate `listen(type)` buffers.
- Clear buffered channels between stage/frame boundaries when required by gameplay logic.
