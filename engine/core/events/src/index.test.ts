import { describe, expect, it } from 'vitest'
import {
  CollisionEvent,
  EventBus,
  InputEvent,
  packageId,
  type EventType
} from './index'

describe('events package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('@clockwork/events')
  })
})

describe('buffered events', () => {
  it('delivers all buffered events for a typed channel', () => {
    const events = new EventBus()

    for (let i = 0; i < 1000; i += 1) {
      events.send(
        CollisionEvent,
        new CollisionEvent(
          { index: i, generation: 0 },
          { index: i + 1, generation: 0 },
          { x: i, y: i }
        )
      )
    }

    const buffered = events.listen(CollisionEvent)
    expect(buffered.len()).toBe(1000)
    expect([...buffered.iter()][0]).toBeInstanceOf(CollisionEvent)
  })

  it('clears events between stages', () => {
    const events = new EventBus()
    events.send(InputEvent, new InputEvent('Space', 'pressed'))
    expect(events.listen(InputEvent).isEmpty()).toBe(false)

    events.clear()
    expect(events.listen(InputEvent).isEmpty()).toBe(true)
  })
})

describe('immediate events', () => {
  it('triggers listeners instantly and bypasses buffer', () => {
    const events = new EventBus()
    const calls: string[] = []

    const unsubscribe = events.on(InputEvent, (event) => {
      calls.push(`${event.key}:${event.action}`)
    })

    events.sendImmediate(InputEvent, new InputEvent('KeyW', 'pressed'))
    expect(calls).toEqual(['KeyW:pressed'])
    expect(events.listen(InputEvent).len()).toBe(0)

    unsubscribe()
    events.sendImmediate(InputEvent, new InputEvent('KeyW', 'released'))
    expect(calls).toEqual(['KeyW:pressed'])
  })
})

describe('type channels', () => {
  it('supports explicit channels for interface-style events', () => {
    type DamageEvent = { target: number; amount: number }
    const Damage: EventType<DamageEvent> = Symbol('Damage')
    const events = new EventBus()

    events.send(Damage, { target: 7, amount: 25 })
    const first = [...events.listen(Damage).iter()][0]
    expect(first).toEqual({ target: 7, amount: 25 })
  })
})
