# Event Bus

`qti-clockwork-events` provides typed buffered and immediate event channels.

## Core API

- `send(event)` or `send(type, event)`
- `sendImmediate(event)` or `sendImmediate(type, event)`
- `listen(type): Events<T>`
- `on(type, listener): unsubscribe`
- `clear(type?)`

## Buffered vs Immediate

- `send` appends to per-type buffer
- `sendImmediate` invokes listeners instantly and does not buffer

## Type Inference Rules

Implicit type inference only works for non-primitive class-instance events.

For primitives/plain objects use explicit channel:

```js
events.send(DamageSymbol, { target: 1, amount: 5 })
```

## Events Snapshot

`Events<T>` is immutable for a read call and exposes:

- `iter()`
- `isEmpty()`
- `len()`
