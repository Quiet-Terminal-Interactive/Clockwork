# Renderer GL

`qti-clockwork-gl` contains low-level WebGL2 context and state wrappers.

## RendererContext

Responsibilities:

- initialize WebGL2 context from canvas
- viewport setup
- clear color / clear calls
- triangle draw helper
- graceful shutdown

It throws when called before initialization.

## GLState

State cache to avoid redundant GL calls:

- blend mode (`opaque`, `alpha`, `additive`)
- depth test toggle
- cull face toggle
- texture binding per slot
- VAO binding
- program binding

This reduces driver overhead in high-frequency render loops.
