# ECS Command Buffer

`CommandBuffer` batches world mutations for deferred application.

## Buffered Operations

- spawn entity (with initial components)
- destroy entity
- add component
- remove component

## Usage

```js
const commands = world.commands()
commands.spawn().with(Position, { x: 1, y: 2 })
commands.flush()
```

## Deferred Entity Resolution

Spawn operations create deferred entities that resolve to real `EntityId` during `flush()`.

## Why Use It

- avoids mutable-iteration hazards during system execution
- centralizes write timing
- aligns with stage-level flush in scheduler
