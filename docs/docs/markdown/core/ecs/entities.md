# ECS Entities

Entities are represented as:

```js
const entityId = {
  index: 0,
  generation: 0
}
```

## Allocation Model

`EntityManager` uses:

- `generations[]`
- `alive[]`
- `freeIndices[]`

Destroyed indices are reused, generation increments on destroy.

## Safety Model

`isAlive(entity)` validates both index and generation.

Stale entity handles fail safely.

## Iteration

`iterAlive()` yields only living entity IDs.

## Notes

- `aliveCount` tracks current live entities.
- Reuse behavior is covered by tests for generation bump correctness.
