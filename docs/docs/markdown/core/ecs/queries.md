# ECS Queries

`World.query()` returns a fluent `Query`.

## Filters

- `.with(type...)`
- `.without(type...)`
- `.optional(type)`
- `.changed(type)`

## Deterministic Iteration

When `with` is present, candidates are seeded by first `with` store and yielded in sorted entity index order.

## Changed Semantics

`.changed(type)` compares component `changedAt` to query's previous iteration tick.

Behavior:

1. first iteration includes matching changed components
2. second iteration excludes unchanged components
3. subsequent writes re-include entities

## Result Shape

Each item includes:

- `entity`
- `components` map keyed by requested types
