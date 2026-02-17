# Scheduler Systems

Systems run through `Scheduler.addSystem(stage, system, order?)`.

## System Contract

```js
const system = {
  id: 'example.system',
  stage: 'Update',
  order: 100,
  reads: [],
  writes: [],
  runIf(world) {
    return true
  },
  execute(ctx) {}
}
```

## Context

`execute(ctx)` receives:

- `world`
- `deltaTime`
- `commands`
- `events`
- `resources`

## Lifecycle Control

- `run()` starts stepping behavior
- `pause()`/`resume()` gate stepping
- `shutdown()` runs shutdown stage and stops scheduler

## Utility Types

- `Profiler` for runtime timings
- `SeededRng` for deterministic randomness
- `DeterminismValidator` for risk checks
