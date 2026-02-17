# ECS Overview

`qti-clockwork-ecs` provides entities, components, queries, resources, and deferred commands.

## Primary Types

- `World`
- `EntityManager`
- `ComponentStore<T>`
- `Query`
- `CommandBuffer`
- `ResourceMap` / `ResourceType`

## World Capabilities

- spawn/destroy entities
- add/remove/get components
- query entities by component filters
- insert/get/remove typed resources
- deferred mutation through command buffers

## Core Properties

- generation-based entity safety
- sparse component storage
- sorted entity iteration for determinism
- component change ticks for `changed` queries

## Related Docs

- [Entities](entities.md)
- [Components](components.md)
- [Queries](queries.md)
- [Resources](resources.md)
- [Command Buffer](commands.md)
