# API Reference: qti-clockwork-input

## InputManager

| Method | Notes |
|---|---|
| `beginFrame` | Currently no-op hook point. |
| `endFrame` | Clears transient pressed/released states. |
| `setKeyState` | Tracks key down/press/release transitions. |
| `setMouseButtonState` | Tracks mouse button transitions. |
| `setMousePosition` | Updates cursor position. |
| `setGamepadButtonState` | Tracks gamepad button transitions. |
| `setGamepadAxisState` | Stores axis value; non-finite coerced to `0`. |
| `isKeyDown/wasKeyPressed/wasKeyReleased` | Keyboard state queries. |
| `getMousePosition/getMousePositionWorld` | Screen + camera-projected world cursor. |
| `isMouseButtonDown` | Mouse button state query. |
| `getGamepadAxis/isGamepadButtonDown` | Gamepad state queries. |
| `snapshot` | Immutable state snapshot (arrays/maps). |

## ActionMap

| Method | Notes |
|---|---|
| `bind` | Adds binding to action. |
| `unbind` | Removes all action bindings. |
| `rebind` | Replaces action bindings with one or many bindings. |
| `isActionPressed` | True when evaluated action value > 0. |
| `getActionValue` | Max value over bound controls with axis deadzone normalization. |

## Gotchas

- Transient pressed/released state is frame-scoped and cleared by `endFrame`.
- Axis deadzone defaults to `0.15`; values <= deadzone map to 0.
- `snapshot` clones collections, so frequent calls may allocate heavily.
