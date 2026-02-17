# Runnable Examples: Scheduler

## Ordered Systems

```js
import { Scheduler } from 'qti-clockwork-scheduler'

const calls = []
const mk = (id, order) => ({
  id,
  stage: 'Update',
  order,
  reads: [],
  writes: [],
  execute() {
    calls.push(id)
  }
})

const scheduler = new Scheduler()
scheduler.addSystem('Update', mk('A', 20))
scheduler.addSystem('Update', mk('B', 10))
scheduler.run()
await scheduler.step(1 / 60)
console.log(calls) // ['B', 'A']
```

## Fixed-Step Configuration

```js
const scheduler = new Scheduler({
  time: { fixedDelta: 1 / 120, maxCatchUpSteps: 8 }
})
```

## Determinism Report

```js
import { DeterminismValidator } from 'qti-clockwork-scheduler'

const report = new DeterminismValidator(scheduler).report()
console.log(report.score, report.violations)
```
