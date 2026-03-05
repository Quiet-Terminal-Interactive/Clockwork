# Renderer Errors

## `WebGL2 is unavailable in this environment`

Cause: context acquisition failed.

Fix:

1. Ensure browser/device supports WebGL2.
2. Fallback to headless/non-render path.

## `RendererContext has not been initialized`

Cause: context methods called before `init(canvas)`.

Fix: initialize once during boot, gate render path until ready.

## `Shader compile failed: ...`

Cause: GLSL syntax or stage-level compile issue.

Fix: inspect `getError()`, log expanded include source, validate GLSL version.

## `Shader link failed: ...`

Cause: stage interface mismatch or unsupported features.

Fix: verify varying layouts, precision qualifiers, and outputs.

## `Uniform block "X" does not exist`

Cause: binding name mismatch.

Fix: align shader block names and runtime binding names.

## `Texture dimensions ... exceed GPU limit ...`

Cause: requested texture larger than `MAX_TEXTURE_SIZE`.

Fix: resize or split atlas.

## `Render target "..." is produced by multiple passes`

Cause: graph has two pass outputs with same target id.

Fix: unique output targets or explicit merge pass.

## `Render graph contains cyclic dependencies`

Cause: pass dependency cycle.

Fix: break cycle by splitting resource flow.

## `RenderGraph.execute requires compile() before execution`

Cause: execute called on uncompiled graph.

Fix: compile graph after mutations and before frame execution.
