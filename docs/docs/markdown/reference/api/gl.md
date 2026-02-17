# API Reference: qti-clockwork-gl

## RendererContext

| Method | Notes |
|---|---|
| `init` | Acquires WebGL2 context from canvas; throws if unavailable. |
| `setViewport` | Calls `gl.viewport`. |
| `setClearColor` | Calls `gl.clearColor`. |
| `clear` | Clears with provided mask or color+depth default. |
| `drawTriangles` | Calls `gl.drawArrays(TRIANGLES, first, count)`. |
| `getError` | Returns `gl.getError()`. |
| `shutdown` | Unbinds VAO/program; safe when called multiple times. |

## GLState

| Method | Notes |
|---|---|
| `setBlendMode` | Caches + applies blend state (`opaque`/`alpha`/`additive`). |
| `setDepthTest` | Caches + toggles depth test enable state. |
| `setCullFace` | Caches + toggles cull state. |
| `bindTexture` | Slot-specific texture cache to skip redundant binds. |
| `bindVAO` | VAO cache. |
| `useProgram` | Program cache. |

## Gotchas

- Calling context methods before `init` throws.
- State cache only tracks changes done through `GLState`; direct GL calls can desync expectations.
