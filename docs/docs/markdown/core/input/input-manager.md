# Input Manager

`qti-clockwork-input` tracks frame-scoped keyboard, mouse, and gamepad state.

## InputManager Capabilities

- key/button down/pressed/released tracking
- mouse position tracking
- gamepad button + axis tracking
- immutable snapshot export

## Frame Semantics

`endFrame()` clears transient sets:

- pressed
- released

Persistent state (`down`) remains.

## Camera Conversion

`getMousePositionWorld(camera)` maps screen-space mouse to world-space through provided camera adapter.

## ActionMap

`ActionMap` maps named actions to one or more bindings.

Binding types:

- key
- mouse button
- gamepad button
- gamepad axis (with deadzone)

Action value is max of active bindings.

Axis deadzone defaults to `0.15`, clamped to `[0, 0.99]`.
