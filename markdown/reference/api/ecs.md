# API Reference: qti-clockwork-ecs

## World

| Method | Signature | Notes |
|---|---|---|
| `spawn` | `() => EntityBuilder` | Creates entity builder around new entity id. |
| `spawnEntity` | `() => EntityId` | Creates entity id directly and increments change tick. |
| `destroy` | `(entity: EntityId) => void` | Removes all components for entity index and bumps generation. |
| `commands` | `() => CommandBuffer` | Returns deferred mutation buffer. |
| `query` | `() => Query` | Creates fluent query object. |
| `addComponent` | `(entity, type, component) => void` | No-op if entity is dead. |
| `removeComponent` | `(entity, type) => void` | No-op when store/entity missing. |
| `getComponent` | `(entity, type) => T | undefined` | Generation-safe lookup. |
| `hasComponent` | `(entity, type) => boolean` | Store + generation check. |
| `insertResource` | `(token, resource) => void` | Converts token to `ResourceType` then inserts. |
| `getResource` | `(token) => T` | Throws when missing. |
| `tryGetResource` | `(token) => T | undefined` | Optional resource lookup. |

## Query

| Method | Notes |
|---|---|
| `with` | Required components. |
| `without` | Excluded components. |
| `optional` | Included in result map if present. |
| `changed` | Filters by change tick since previous iteration on same query instance. |
| `iter` | Deterministic entity order from seed store; updates internal last-iterated tick. |

## CommandBuffer

| Method | Notes |
|---|---|
| `spawn` | Creates deferred entity builder; components attached at flush. |
| `destroy` | Queues destroy operation. |
| `addComponent/removeComponent` | Queues component ops. |
| `flush` | Applies queued operations in order, then clears queue. |

## ResourceMap

| Method | Notes |
|---|---|
| `insert` | Validates declared dependencies + version constraints. |
| `get/tryGet` | Required/optional retrieval. |
| `getInstalledVersion` | Returns installed resource version by id. |
| `getRevision` | Returns write revision counter for resource key. |

## ObjectPool

| Method | Notes |
|---|---|
| `acquire` | Reuses pooled item or creates via factory. |
| `release` | Optional reset then stores for reuse. |
| `size` | Number of free pooled items. |

## Gotchas

- Destroyed entity indices are reused; always respect generation checks.
- `changed` filtering is stateful per query instance.
- Query candidate set seeds from first `with` component; pick specific first filters for efficiency.
