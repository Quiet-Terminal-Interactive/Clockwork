import { describe, expect, it } from 'vitest'
import {
  ObjectPool,
  type EntityId,
  ResourceMap,
  ResourceType,
  World,
  collectWorldStats,
  packageId
} from './index'

describe('ecs package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('@clockwork/ecs')
  })
})

describe('EntityManager via World', () => {
  it('reuses indices with incremented generation', () => {
    const world = new World()

    const first = world.spawn().build()
    world.destroy(first)

    const second = world.spawn().build()

    expect(second.index).toBe(first.index)
    expect(second.generation).toBe(first.generation + 1)
    expect(world.entities.isAlive(first)).toBe(false)
    expect(world.entities.isAlive(second)).toBe(true)
  })
})

describe('Component operations', () => {
  const Position = Symbol('Position')
  const Velocity = Symbol('Velocity')

  it('adds, gets, and removes components', () => {
    const world = new World()
    const entity = world.spawn().build()

    world.addComponent(entity, Position, { x: 1, y: 2 })
    world.addComponent(entity, Velocity, { x: 3, y: 4 })

    expect(world.getComponent(entity, Position)).toEqual({ x: 1, y: 2 })
    expect(world.hasComponent(entity, Velocity)).toBe(true)

    world.removeComponent(entity, Velocity)
    expect(world.hasComponent(entity, Velocity)).toBe(false)
  })
})

describe('Query', () => {
  const Position = Symbol('Position')
  const Velocity = Symbol('Velocity')
  const Health = Symbol('Health')

  function ids(results: Iterable<{ entity: EntityId }>): number[] {
    return [...results].map((item) => item.entity.index)
  }

  it('supports with, without, optional, and deterministic order', () => {
    const world = new World()

    const e3 = world.spawn().with(Position, { x: 3, y: 0 }).build()
    const e1 = world.spawn().with(Position, { x: 1, y: 0 }).build()
    const e2 = world
      .spawn()
      .with(Position, { x: 2, y: 0 })
      .with(Velocity, { x: 0, y: 1 })
      .build()

    world.addComponent(e3, Health, 100)

    const results = [
      ...world.query().with(Position).without(Velocity).optional(Health).iter()
    ]

    expect(results).toHaveLength(2)
    expect(ids(results)).toEqual([e3.index, e1.index].sort((a, b) => a - b))

    const maybeHealth = results
      .find((r) => r.entity.index === e3.index)
      ?.components.get(Health)
    expect(maybeHealth).toBe(100)
    expect(
      results.find((r) => r.entity.index === e1.index)?.components.get(Health)
    ).toBeUndefined()

    expect(results.some((r) => r.entity.index === e2.index)).toBe(false)
  })

  it('tracks changed components between iterations on the same query', () => {
    const world = new World()
    const entity = world.spawn().build()

    world.addComponent(entity, Position, { x: 0, y: 0 })

    const query = world.query().with(Position).changed(Position)
    expect([...query.iter()]).toHaveLength(1)
    expect([...query.iter()]).toHaveLength(0)

    world.addComponent(entity, Position, { x: 5, y: 6 })
    expect([...query.iter()]).toHaveLength(1)
  })
})

describe('CommandBuffer', () => {
  const Position = Symbol('Position')

  it('defers mutations until flush', () => {
    const world = new World()
    const entity = world.spawn().build()

    const commands = world.commands()
    commands.addComponent(entity, Position, { x: 10, y: 20 })

    expect(world.hasComponent(entity, Position)).toBe(false)

    commands.flush()

    expect(world.getComponent(entity, Position)).toEqual({ x: 10, y: 20 })
  })

  it('spawns entities with initial components', () => {
    const world = new World()
    const commands = world.commands()

    commands.spawn().with(Position, { x: 7, y: 8 })
    commands.flush()

    const results = [...world.query().with(Position).iter()]
    expect(results).toHaveLength(1)
    const first = results[0]
    expect(first).toBeDefined()
    expect(first!.components.get(Position)).toEqual({ x: 7, y: 8 })
  })
})

describe('Scale sanity', () => {
  const Position = Symbol('Position')

  it('handles large entity counts deterministically', () => {
    const world = new World()
    const total = 100_000

    for (let i = 0; i < total; i += 1) {
      const entity = world.spawn().build()
      world.addComponent(entity, Position, { x: i, y: i })
    }

    const results = [...world.query().with(Position).iter()]

    expect(results).toHaveLength(total)
    const isSorted = results.every(
      (r, i) => i === 0 || results[i - 1]!.entity.index < r.entity.index
    )
    expect(isSorted).toBe(true)
  })
})

describe('ResourceMap', () => {
  it('inserts and retrieves resources with type keys', () => {
    const resources = new ResourceMap()
    const Time = new ResourceType<{ delta: number }>('time')

    resources.insert(Time, { delta: 1 / 60 })

    expect(resources.has(Time)).toBe(true)
    expect(resources.get(Time)).toEqual({ delta: 1 / 60 })
  })

  it('throws on missing required resource', () => {
    const resources = new ResourceMap()
    const Input = new ResourceType<{ keys: string[] }>('input')

    expect(() => resources.get(Input)).toThrow('not registered')
    expect(resources.tryGet(Input)).toBeUndefined()
  })

  it('supports resource dependency validation', () => {
    const resources = new ResourceMap()
    const Time = new ResourceType<{ delta: number }>('time', { version: 2 })
    const Physics = new ResourceType<{ gravity: number }>('physics', {
      dependencies: [new ResourceType('time', { version: 2 })]
    })

    expect(() => resources.insert(Physics, { gravity: 9.8 })).toThrow(
      'depends on missing'
    )

    resources.insert(Time, { delta: 1 / 120 })
    resources.insert(Physics, { gravity: 9.8 })
    expect(resources.get(Physics).gravity).toBe(9.8)
  })

  it('keeps lookups stable across resource version swaps', () => {
    const resources = new ResourceMap()
    const V1 = new ResourceType<{ value: number }>('config', { version: 1 })
    const V2 = new ResourceType<{ value: number; mode: string }>('config', {
      version: 2
    })

    resources.insert(V1, { value: 1 })
    resources.insert(V2, { value: 2, mode: 'enhanced' })

    expect(resources.get(V1).value).toBe(2)
    expect(resources.get(V2).mode).toBe('enhanced')
    expect(resources.getInstalledVersion(V1)).toBe(2)
  })
})

describe('performance helpers', () => {
  it('reuses items through object pool', () => {
    const pool = new ObjectPool(
      () => ({ value: 0 }),
      (item) => {
        item.value = 0
      }
    )

    const item = pool.acquire()
    item.value = 42
    pool.release(item)

    const reused = pool.acquire()
    expect(reused.value).toBe(0)
  })

  it('collects world stats', () => {
    const world = new World()
    const Position = Symbol('Position')
    world.addComponent(world.spawn().build(), Position, { x: 1, y: 2 })

    const stats = collectWorldStats(world)
    expect(stats.entityCount).toBe(1)
    expect(stats.componentInstanceCount).toBe(1)
  })
})
