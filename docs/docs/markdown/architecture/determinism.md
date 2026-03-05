# Determinism

Clockwork includes explicit determinism tooling in scheduler/runtime design.

## Deterministic Building Blocks

- fixed-step update loop (`FixedUpdate`)
- stable system ordering by `order` then insertion order
- deterministic entity iteration order (sorted indices)
- deterministic PRNG (`SeededRng` xorshift32)

## Determinism Validator

`DeterminismValidator` inspects scheduler state.

Current hard violation:

- async systems in `FixedUpdate`

Report output:

- `score` (0-100)
- `warnings`
- `violations`

## Practical Guidance

1. Keep simulation logic in `FixedUpdate`.
2. Do not use async work in deterministic simulation stages.
3. Use seeded RNG for gameplay-critical randomness.
4. Avoid non-deterministic iteration sources in core simulation.
