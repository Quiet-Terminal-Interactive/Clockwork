# ECS Resources

Resources are global typed runtime state managed by `ResourceMap`.

## ResourceType

```js
new ResourceType(id, { version, dependencies })
```

Features:

- version metadata
- dependency requirements on other resource types

## ResourceMap API

- `insert(type, value)`
- `get(type)`
- `tryGet(type)`
- `remove(type)`
- `has(type)`
- `getInstalledVersion(type)`
- `getRevision(type)`

## Dependency Enforcement

Insert validates required dependencies and minimum dependency versions.

## Token Conversion

`World.insertResource/getResource` accept tokens (`string`, `symbol`, ctor) and convert via `ResourceType.fromToken`.

## Builtin Resource Types

`BuiltinResourceTypes` includes:

- `Time`
- `Input`
- `Assets`
- `Renderer`
- `AudioContext`
- `Rng`
- `Config`
- `Profiler`
