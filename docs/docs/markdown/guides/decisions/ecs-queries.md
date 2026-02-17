# Decision Guide: ECS Query Patterns

## Use `.with(...)` for Required Components

Use when every result must include component data.

Example: movement system requires `Position` and `Velocity`.

## Use `.optional(...)` for Conditional Logic

Use when behavior depends on extra data but should not exclude entity.

Example: optional `Health` modifies damage feedback.

## Use `.without(...)` to Exclude States

Use when state components are blockers.

Example: exclude `Disabled` or `Dead` entities.

## Use `.changed(...)` for Incremental Work

Use for expensive updates that only need touched components.

Example: rebuild spatial index only when `Transform` changes.

## Performance Notes

1. Reuse query instances when using `.changed()`.
2. Pick selective first `with` component for candidate seeding.
3. Early-return in systems before heavy work.
