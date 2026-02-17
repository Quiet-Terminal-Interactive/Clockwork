# ECS Components

Components are stored per component type in `ComponentStore<T>`.

## Storage

`ComponentStore<T>` internally maps `entity.index` to:

- generation
- component value
- changed tick

## Operations

- `add(entity, component, tick)`
- `remove(entity)`
- `get(entity)`
- `has(entity)`
- `iter()`
- `sortedEntities()`

## Change Tracking

Every write updates world `changeTick` and component `changedAt`.

Used by query `.changed(type)` filters.

## Type Keys

Component keys may be:

- `string`
- `symbol`
- constructor function
