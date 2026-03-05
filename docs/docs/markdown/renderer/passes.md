# Render Passes and 2D Utilities

`qti-clockwork-passes` includes transform math, sprite/text batching, primitive geometry, and render graph orchestration.

## Transform Utilities

- `computeWorldTransforms`
- `worldToScreen`
- `screenToWorld`
- `updateCameraFollow`

Includes cycle detection for parent transforms.

## SpriteBatch

`SpriteBatch` queues sprites, sorts by z/texture/blend, and emits packed vertex/index buffers.

Important constraints:

- `begin(camera)` required before draw
- max sprite count bounded by Uint16 index capacity
- missing region names throw

Stats returned:

- sprite count
- draw calls
- vertex count
- index count

## Text

- `Font`
- `layoutText`
- `drawText`

Supports alignment (`left`, `center`, `right`) and optional wrapping.

## PrimitiveBatch

Immediate-mode debug geometry:

- lines
- rectangles (filled/outline)
- circles
- polygons

Collects line and triangle vertices and reports primitive stats.

## RenderGraph

Defines named passes with `inputs` and `outputs`.

`compile()` performs topological ordering and dependency validation.

Failure cases:

- duplicate target producers
- cyclic dependencies
- execute before compile
