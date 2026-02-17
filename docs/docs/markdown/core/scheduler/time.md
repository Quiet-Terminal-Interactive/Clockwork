# Scheduler Time Model

`TimeResource` drives fixed and variable time behavior.

## Fields

- `fixedDelta`
- `elapsed`
- `frameCount`
- `accumulator`
- `maxCatchUpSteps`

## Fixed-Step Loop

Per `step(dtReal)`:

1. add `dtReal` to `elapsed`
2. add `dtReal` to `accumulator`
3. run `FixedUpdate` while `accumulator >= fixedDelta` and steps < `maxCatchUpSteps`
4. if still behind after max steps, drop remainder (`accumulator = 0`)

## Validation

- `fixedDelta` must be finite and > 0
- `maxCatchUpSteps` must be integer >= 1
- `step(dt)` requires finite `dt >= 0`

## Result

Simulation remains stable under frame-time spikes without runaway catch-up loops.
