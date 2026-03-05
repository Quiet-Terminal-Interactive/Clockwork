# API Reference: qti-clockwork-passes

## Transform Utilities

| Function | Notes |
|---|---|
| `computeWorldTransforms` | Solves parent-child transforms with cycle detection. |
| `updateCameraFollow` | Exponential smoothing toward target by speed and dt. |
| `worldToScreen/screenToWorld` | Bidirectional camera projection; zoom must be finite and non-zero. |

## SpriteBatch

| Method | Notes |
|---|---|
| `begin(camera)` | Clears queued commands and activates camera context. |
| `draw` | Queue sprite draw command with transform. |
| `drawWithRegionResolver` | Draw with explicit region name resolver. |
| `flush` | Sorts by z/texture/blend and emits batch stats. |
| `end` | Flush + reset camera/queue. |

## Text

| API | Notes |
|---|---|
| `Font` | Glyph map + atlas texture + line metrics. |
| `layoutText` | Produces wrapped/aligned glyph placement data. |
| `drawText` | Emits glyph sprites into `SpriteBatch`. |

## PrimitiveBatch

| Method | Notes |
|---|---|
| `drawLine` | Thin line or thick quad line as triangles. |
| `drawRect` | Filled or outline rectangle. |
| `drawCircle` | Segment-based circle approximation. |
| `drawPolygon` | Outline poly or convex fan fill. |
| `flush` | Returns current primitive stats. |
| `clear` | Clears internal vertex collections. |

## RenderGraph

| Method | Notes |
|---|---|
| `addPass/removePass` | Pass graph mutation. |
| `defineRenderTarget/getRenderTarget` | Named target registry. |
| `compile` | Topological sort over input/output dependencies. |
| `execute` | Runs compiled pass order. |
| `getExecutionOrder` | Pass name order snapshot. |

## Gotchas

- `execute` requires prior `compile` when passes exist.
- Duplicate render target producers are invalid.
- Cyclic pass dependencies are rejected.
- `SpriteBatch` max sprite count is constrained by Uint16 index limits.
