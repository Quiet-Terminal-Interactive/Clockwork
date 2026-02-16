export const packageId = 'qti-clockwork-events'

export type EventConstructor<T> = new (...args: never[]) => T
export type EventType<T> = string | symbol | EventConstructor<T>
export type EventListener<T> = (event: T) => void
/** Immutable snapshot of events collected during a frame for a given type. */
export class Events<T> {
  constructor(private readonly items: readonly T[]) {}

  iter(): IterableIterator<T> {
    return this.items.values()
  }

  isEmpty(): boolean {
    return this.items.length === 0
  }

  len(): number {
    return this.items.length
  }
}
/** Typed publish-subscribe bus supporting buffered and immediate event dispatch. */
export class EventBus {
  private readonly buffers = new Map<EventType<unknown>, unknown[]>()
  private readonly listeners = new Map<
    EventType<unknown>,
    Set<EventListener<unknown>>
  >()

  send<T>(event: T): void
  send<T>(type: EventType<T>, event: T): void
  send<T>(typeOrEvent: EventType<T> | T, maybeEvent?: T): void {
    const { type, event } = this.resolveDispatch(typeOrEvent, maybeEvent)
    const channel = this.getOrCreateChannel(type)
    channel.push(event)
  }

  sendImmediate<T>(event: T): void
  sendImmediate<T>(type: EventType<T>, event: T): void
  sendImmediate<T>(typeOrEvent: EventType<T> | T, maybeEvent?: T): void {
    const { type, event } = this.resolveDispatch(typeOrEvent, maybeEvent)
    const listeners = this.listeners.get(type)
    if (!listeners || listeners.size === 0) {
      return
    }

    for (const listener of listeners) {
      listener(event)
    }
  }

  listen<T>(type: EventType<T>): Events<T> {
    const channel = this.buffers.get(type) ?? []
    return new Events<T>(channel as T[])
  }

  on<T>(type: EventType<T>, listener: EventListener<T>): () => void {
    let listeners = this.listeners.get(type)
    if (!listeners) {
      listeners = new Set<EventListener<unknown>>()
      this.listeners.set(type, listeners)
    }

    listeners.add(listener as EventListener<unknown>)
    return () => {
      const current = this.listeners.get(type)
      if (!current) {
        return
      }

      current.delete(listener as EventListener<unknown>)
      if (current.size === 0) {
        this.listeners.delete(type)
      }
    }
  }

  clear(type?: EventType<unknown>): void {
    if (type !== undefined) {
      this.buffers.delete(type)
      return
    }

    this.buffers.clear()
  }

  private resolveDispatch<T>(
    typeOrEvent: EventType<T> | T,
    maybeEvent?: T
  ): { type: EventType<T>; event: T } {
    if (maybeEvent !== undefined) {
      return { type: typeOrEvent as EventType<T>, event: maybeEvent }
    }

    return {
      type: this.inferType(typeOrEvent as T),
      event: typeOrEvent as T
    }
  }

  private inferType<T>(event: T): EventType<T> {
    if (event === null || event === undefined) {
      throw new Error('Cannot infer event type for null or undefined event')
    }

    if (typeof event !== 'object' && typeof event !== 'function') {
      throw new Error(
        'Cannot infer event type for primitive values. Use send(type, event).'
      )
    }

    const constructor = (event as { constructor?: unknown }).constructor
    if (typeof constructor !== 'function' || constructor === Object) {
      throw new Error(
        'Cannot infer event type for plain objects. Use send(type, event).'
      )
    }

    return constructor as EventConstructor<T>
  }

  private getOrCreateChannel<T>(type: EventType<T>): T[] {
    let channel = this.buffers.get(type)
    if (!channel) {
      channel = []
      this.buffers.set(type, channel)
    }

    return channel as T[]
  }
}

export interface EntityIdLike {
  index: number
  generation: number
}

export interface Vec2Like {
  x: number
  y: number
}
export class CollisionEvent {
  constructor(
    readonly entityA: EntityIdLike,
    readonly entityB: EntityIdLike,
    readonly point: Vec2Like
  ) {}
}
export class DamageEvent {
  constructor(
    readonly target: EntityIdLike,
    readonly amount: number,
    readonly source?: EntityIdLike
  ) {}
}
export class InputEvent {
  constructor(
    readonly key: string,
    readonly action: 'pressed' | 'released'
  ) {}
}

