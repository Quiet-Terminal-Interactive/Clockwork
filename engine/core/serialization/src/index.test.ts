import { describe, expect, it } from 'vitest'
import { World } from 'qti-clockwork-ecs'
import { WorldSerializer, packageId } from './index'

const Position = Symbol('Position')

describe('serialization package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-serialization')
  })

  it('serializes and deserializes world entities', () => {
    const world = new World()
    const entity = world.spawn().build()
    world.addComponent(entity, Position, { x: 1, y: 2 })

    const serializer = new WorldSerializer()
    serializer.register(Position, {
      version: 1,
      serialize(value) {
        return value
      },
      deserialize(data) {
        return data as { x: number; y: number }
      }
    })

    const bytes = serializer.serialize(world)
    const restored = serializer.deserialize(bytes)

    const [first] = [...restored.query().with(Position).iter()]
    expect(first?.components.get(Position)).toEqual({ x: 1, y: 2 })
  })

  it('applies migration during deserialization', () => {
    const world = new World()
    const entity = world.spawn().build()
    world.addComponent(entity, Position, { x: 3 })

    const writer = new WorldSerializer()
    writer.register(Position, {
      version: 1,
      serialize(value) {
        return value
      },
      deserialize(data) {
        return data as { x: number }
      }
    })

    const bytes = writer.serialize(world)

    const reader = new WorldSerializer()
    reader.register(Position, {
      version: 2,
      serialize(value) {
        return value
      },
      deserialize(data) {
        return data as { x: number; y: number }
      },
      migrate(_from, _to, data) {
        const item = data as { x: number; y?: number }
        return { x: item.x, y: item.y ?? 0 }
      }
    })

    const restored = reader.deserialize(bytes)
    const [first] = [...restored.query().with(Position).iter()]
    expect(first?.components.get(Position)).toEqual({ x: 3, y: 0 })
  })

  it('rejects malformed snapshot payloads', () => {
    const serializer = new WorldSerializer()
    const bytes = new TextEncoder().encode('{"version":1,"entities":"bad"}')
    expect(() => serializer.deserialize(bytes)).toThrow('entities')
  })

  it('throws when migration is required but not provided', () => {
    const world = new World()
    const entity = world.spawn().build()
    world.addComponent(entity, Position, { x: 7 })

    const writer = new WorldSerializer()
    writer.register(Position, {
      version: 1,
      serialize(value) {
        return value
      },
      deserialize(data) {
        return data as { x: number }
      }
    })

    const bytes = writer.serialize(world)

    const reader = new WorldSerializer()
    reader.register(Position, {
      version: 2,
      serialize(value) {
        return value
      },
      deserialize(data) {
        return data as { x: number; y: number }
      }
    })

    expect(() => reader.deserialize(bytes)).toThrow('Missing migration')
  })

  it('detects type id collisions unless explicit typeId is provided', () => {
    const serializer = new WorldSerializer()
    const a = Symbol('duplicate')
    const b = Symbol('duplicate')

    serializer.register(a, {
      version: 1,
      serialize(value) {
        return value
      },
      deserialize(data) {
        return data as unknown
      }
    })

    expect(() =>
      serializer.register(b, {
        version: 1,
        serialize(value) {
          return value
        },
        deserialize(data) {
          return data as unknown
        }
      })
    ).toThrow('collision')

    const safeSerializer = new WorldSerializer()
    safeSerializer.register(a, {
      version: 1,
      typeId: 'component:a',
      serialize(value) {
        return value
      },
      deserialize(data) {
        return data as unknown
      }
    })
    expect(() =>
      safeSerializer.register(b, {
        version: 1,
        typeId: 'component:b',
        serialize(value) {
          return value
        },
        deserialize(data) {
          return data as unknown
        }
      })
    ).not.toThrow()
  })
})

