# Shaders

`qti-clockwork-shaders` provides compilation/linking, source include expansion, and uniform helpers.

## ShaderCompiler

Main APIs:

- `compile(vertSrc, fragSrc)`
- `compileWithIncludes(vertPath, fragPath)`
- `getError()`

Supports external include resolver and compiled shader cache.

## Include Expansion

`#include "file.glsl"` is recursively expanded.

Circular includes are detected and rejected.

## Shader

Wrapper over linked WebGL program with:

- cached uniform location lookup
- scalar and array uniform setters
- uniform block binding

Unsupported uniform shapes throw with explicit error.

## Error Surfaces

Compiler reports:

- stage compile failures
- link failures
- missing source includes
- createShader/createProgram failure
