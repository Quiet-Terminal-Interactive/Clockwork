# API Reference: qti-clockwork-scheduler

## Scheduler

| Method | Signature | Notes |
|---|---|---|
| `addStage` | `(stage: Stage) => void` | Appends/replaces stage by name in order map. |
| `addSystem` | `(stageName, system, order?) => void` | Unknown stage throws. |
| `removeSystem` | `(systemId) => void` | Removes first matching system found by stage scan. |
| `run` | `() => void` | Enables stepping. |
| `pause` | `() => void` | Pauses stepping without resetting state. |
| `resume` | `() => void` | Resumes only if already running. |
| `step` | `(dtReal) => Promise<void>` | Executes staged frame with fixed-step catch-up. |
| `shutdown` | `() => Promise<void>` | Executes `Shutdown` stage and stops runtime. |
| `getStageOrder` | `() => readonly string[]` | Snapshot stage order. |
| `getSystemsInStage` | `(stageName) => readonly System[]` | Ordered systems for stage. |

## Stage

| Method | Notes |
|---|---|
| `addSystem` | Normalizes stage/order; stable order by (order, insertion). |
| `removeSystem` | Removes by system id. |
| `execute` | Runs systems with runIf check; enforces async policy; flushes commands. |

## TimeResource

Fields: `fixedDelta`, `elapsed`, `frameCount`, `accumulator`, `maxCatchUpSteps`.

Validation:

- `fixedDelta` finite and > 0.
- `maxCatchUpSteps` integer >= 1.

## Determinism and Profiling

| Type | Notes |
|---|---|
| `SeededRng` | Deterministic xorshift32 sequence with `next`, `nextFloat`, `nextRange`. |
| `DeterminismValidator` | Reports warnings/violations; currently flags async fixed-update systems. |
| `Profiler` | `begin/end` timers per label with totals, max, last, averages. |

## Gotchas

- Async systems in non-async stages throw during frame step.
- Large frame spikes are clamped by catch-up limit; leftover accumulator is dropped.
- `step` is no-op if scheduler has not been started with `run`.
