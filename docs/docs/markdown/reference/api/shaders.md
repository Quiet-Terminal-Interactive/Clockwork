# API Reference: qti-clockwork-shaders

## ShaderCompiler

| Method | Notes |
|---|---|
| `compile` | Compiles and links provided source strings; caches by source pair. |
| `compileWithIncludes` | Resolves named sources, expands `#include`, then compiles. |
| `getError` | Last compile/link error string, if any. |

## Shader

| Method | Notes |
|---|---|
| `use` | Binds program via `useProgram`. |
| `setUniform` | Supports number, boolean, number arrays, `Float32Array`, `Int32Array`. |
| `setUniformBlock` | Looks up uniform block index and binds to UBO binding point. |

## Include Resolver Rules

- Resolver must return source string for each include path.
- Missing include path throws.
- Circular include chains throw with path trace.

## Gotchas

- Unsupported uniform array lengths throw (for both int/float arrays).
- Plain missing uniforms are ignored (`null` location short-circuit).
- createShader/createProgram failures surface as explicit errors.
