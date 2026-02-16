import { describe, expect, it } from 'vitest'
import {
  DeterminismValidator,
  Profiler,
  SeededRng,
  type System,
  Scheduler,
  type WorldLike,
  packageId
} from './index'

class TestWorld implements WorldLike {
  readonly resources = {
    get<T>(): T {
      throw new Error('No test resources registered')
    }
  }
  flushCount = 0

  commands() {
    return {
      flush: () => {
        this.flushCount += 1
      }
    }
  }
}

function createSystem(
  id: string,
  execute: System['execute'],
  options?: { stage?: string; order?: number; runIf?: System['runIf'] }
): System {
  const system: System = {
    id,
    stage: options?.stage ?? 'Update',
    order: options?.order ?? 0,
    reads: [],
    writes: [],
    execute
  }

  if (options?.runIf) {
    system.runIf = options.runIf
  }

  return system
}

describe('scheduler package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-scheduler')
  })
})

describe('fixed timestep', () => {
  it('runs fixed update at 60 TPS independent of frame rate', async () => {
    const world = new TestWorld()
    const scheduler = new Scheduler({
      world,
      time: { fixedDelta: 1 / 60, maxCatchUpSteps: 10 }
    })

    let fixedCalls = 0
    scheduler.addSystem(
      'FixedUpdate',
      createSystem('fixed', () => {
        fixedCalls += 1
      })
    )

    scheduler.run()
    await scheduler.step(1 / 30)
    await scheduler.step(1 / 30)

    expect(fixedCalls).toBe(4)
  })

  it('drops excess accumulator after max catch-up steps to avoid runaway', async () => {
    const scheduler = new Scheduler({
      time: { fixedDelta: 0.1, maxCatchUpSteps: 2 }
    })
    let fixedCalls = 0
    scheduler.addSystem(
      'FixedUpdate',
      createSystem('fixed', () => {
        fixedCalls += 1
      })
    )

    scheduler.run()
    await scheduler.step(1)

    expect(fixedCalls).toBe(2)
    expect(scheduler.time.accumulator).toBe(0)
  })
})

describe('system ordering', () => {
  it('executes in order with stable ties', async () => {
    const scheduler = new Scheduler()
    const calls: string[] = []

    scheduler.addSystem(
      'Update',
      createSystem(
        'a',
        () => {
          calls.push('a')
        },
        { order: 20 }
      )
    )

    scheduler.addSystem(
      'Update',
      createSystem(
        'b',
        () => {
          calls.push('b')
        },
        { order: 10 }
      )
    )

    scheduler.addSystem(
      'Update',
      createSystem(
        'c',
        () => {
          calls.push('c')
        },
        { order: 10 }
      )
    )

    scheduler.run()
    await scheduler.step(1 / 60)

    expect(calls).toEqual(['b', 'c', 'a'])
  })
})

describe('async systems', () => {
  it('allows async systems in allowed stages', async () => {
    const scheduler = new Scheduler()
    let ran = false

    scheduler.addSystem(
      'Render',
      createSystem('render-async', async () => {
        await Promise.resolve()
        ran = true
      })
    )

    scheduler.run()
    await scheduler.step(1 / 60)

    expect(ran).toBe(true)
  })

  it('rejects async systems in disallowed stages', async () => {
    const scheduler = new Scheduler()

    scheduler.addSystem(
      'Update',
      createSystem('update-async', async () => {
        await Promise.resolve()
      })
    )

    scheduler.run()
    await expect(scheduler.step(1 / 60)).rejects.toThrow(
      'does not allow async systems'
    )
  })
})

describe('runIf predicate', () => {
  it('skips systems when runIf returns false', async () => {
    const scheduler = new Scheduler()
    let calls = 0

    scheduler.addSystem(
      'Update',
      createSystem(
        'conditional',
        () => {
          calls += 1
        },
        { runIf: () => false }
      )
    )

    scheduler.run()
    await scheduler.step(1 / 60)

    expect(calls).toBe(0)
  })
})

describe('determinism and profiling', () => {
  it('produces stable seeded rng sequences', () => {
    const a = new SeededRng(1234)
    const b = new SeededRng(1234)

    const seqA = [a.next(), a.next(), a.next()]
    const seqB = [b.next(), b.next(), b.next()]
    expect(seqA).toEqual(seqB)
    expect(a.nextFloat()).toBeLessThan(1)
    expect(a.nextFloat()).toBeGreaterThanOrEqual(0)
  })

  it('flags async fixed-update systems in determinism report', () => {
    const scheduler = new Scheduler()
    scheduler.addSystem(
      'FixedUpdate',
      createSystem('bad-fixed', async () => {
        await Promise.resolve()
      })
    )

    const report = new DeterminismValidator(scheduler).report()
    expect(report.violations.length).toBeGreaterThan(0)
    expect(report.score).toBeLessThan(100)
  })

  it('records profiler timings', async () => {
    const profiler = new Profiler()
    profiler.begin('update')
    await Promise.resolve()
    profiler.end('update')

    expect(profiler.getTimings().get('update')?.samples).toBe(1)
    expect(profiler.getAverageRuntime('update')).toBeGreaterThanOrEqual(0)
  })

  it('rejects invalid scheduler time and step parameters', async () => {
    expect(() => new Scheduler({ time: { fixedDelta: 0 } })).toThrow(
      'fixedDelta'
    )
    expect(() => new Scheduler({ time: { maxCatchUpSteps: 0 } })).toThrow(
      'maxCatchUpSteps'
    )

    const scheduler = new Scheduler()
    scheduler.run()
    await expect(scheduler.step(Number.NaN)).rejects.toThrow('finite')
  })
})

