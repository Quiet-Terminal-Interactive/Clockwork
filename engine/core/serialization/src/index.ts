import { type ComponentType, World } from '@clockwork/ecs'

export const packageId = '@clockwork/serialization'

export interface ComponentSerializationSchema<T = unknown> {
  version: number
  typeId?: string
  serialize(component: T): unknown
  deserialize(data: unknown): T
  migrate?(fromVersion: number, toVersion: number, data: unknown): unknown
}

export interface SerializedComponent {
  type: string
  version: number
  data: unknown
}

export interface SerializedEntity {
  components: SerializedComponent[]
}

export interface WorldSnapshot {
  version: number
  entities: SerializedEntity[]
}

export interface Serializer {
  serialize(world: World): Uint8Array
  deserialize(data: Uint8Array): World
}
/** JSON-based world serializer with versioned component schemas and migration support. */
export class WorldSerializer implements Serializer {
  private readonly schemas = new Map<
    ComponentType<unknown>,
    ComponentSerializationSchema<unknown>
  >()
  private readonly byId = new Map<
    string,
    ComponentSerializationSchema<unknown>
  >()
  private readonly idToType = new Map<string, ComponentType<unknown>>()
  private readonly encoder = new TextEncoder()
  private readonly decoder = new TextDecoder()
  private readonly autoIds = new WeakMap<object, string>()
  private nextAutoId = 1

  constructor(private readonly snapshotVersion = 1) {}

  register<T>(
    type: ComponentType<T>,
    schema: ComponentSerializationSchema<T>
  ): void {
    if (!Number.isInteger(schema.version) || schema.version < 1) {
      throw new Error('Component schema version must be an integer >= 1')
    }

    const normalized = schema as ComponentSerializationSchema<unknown>
    this.schemas.set(type as ComponentType<unknown>, normalized)

    const id = this.getTypeId(type as ComponentType<unknown>, normalized.typeId)
    const existingType = this.idToType.get(id)
    if (existingType && existingType !== (type as ComponentType<unknown>)) {
      throw new Error(`Component type id collision for "${id}"`)
    }

    this.byId.set(id, normalized)
    this.idToType.set(id, type as ComponentType<unknown>)
  }

  serialize(world: World): Uint8Array {
    const entities: SerializedEntity[] = []

    for (const entity of world.entities.iterAlive()) {
      const components: SerializedComponent[] = []

      for (const [type, store] of world.components.entries()) {
        const value = store.get(entity)
        if (value === undefined) {
          continue
        }

        const schema = this.schemas.get(type)
        const version = schema?.version ?? 1
        const data = schema ? schema.serialize(value) : value
        const typeId = this.getTypeId(type, schema?.typeId)

        components.push({
          type: typeId,
          version,
          data
        })
      }

      entities.push({ components })
    }

    const snapshot: WorldSnapshot = {
      version: this.snapshotVersion,
      entities
    }

    return this.encoder.encode(JSON.stringify(snapshot))
  }

  deserialize(data: Uint8Array): World {
    let parsed: unknown
    try {
      parsed = JSON.parse(this.decoder.decode(data))
    } catch (error) {
      throw new Error(
        `Failed to parse world snapshot: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    assertWorldSnapshot(parsed)
    const snapshot = parsed
    const world = new World()

    for (const entityData of snapshot.entities) {
      const entity = world.spawn().build()

      for (const component of entityData.components) {
        assertSerializedComponent(component)

        const schema = this.byId.get(component.type)
        const type = this.idToType.get(component.type)
        if (!type) {
          continue
        }

        let payload = component.data
        if (schema) {
          const from = component.version
          const to = schema.version
          if (from !== to) {
            if (!schema.migrate) {
              throw new Error(
                `Missing migration for component "${component.type}" from version ${from} to ${to}`
              )
            }
            payload = schema.migrate(from, to, payload)
          }
          payload = schema.deserialize(payload)
        }

        world.addComponent(entity, type, payload)
      }
    }

    return world
  }

  private getTypeId(type: ComponentType<unknown>, explicitId?: string): string {
    if (explicitId !== undefined) {
      const normalized = explicitId.trim()
      if (normalized.length === 0) {
        throw new Error('Component schema typeId cannot be empty')
      }
      return normalized
    }

    if (typeof type === 'string') {
      return `str:${type}`
    }

    if (typeof type === 'symbol') {
      const globalId = Symbol.keyFor(type)
      if (globalId) {
        return `sym-global:${globalId}`
      }
      const desc = type.description
      if (desc) {
        return `sym-local:${desc}`
      }
    }

    const asObject = type as unknown as object
    const existing = this.autoIds.get(asObject)
    if (existing) {
      return existing
    }

    const auto = `auto:${this.nextAutoId}`
    this.nextAutoId += 1
    this.autoIds.set(asObject, auto)
    return auto
  }
}

function assertWorldSnapshot(value: unknown): asserts value is WorldSnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid world snapshot payload')
  }

  const snapshot = value as {
    version?: unknown
    entities?: unknown
  }

  if (!Number.isInteger(snapshot.version) || (snapshot.version as number) < 1) {
    throw new Error('World snapshot "version" must be an integer >= 1')
  }

  if (!Array.isArray(snapshot.entities)) {
    throw new Error('World snapshot "entities" must be an array')
  }

  for (const entity of snapshot.entities) {
    if (!entity || typeof entity !== 'object') {
      throw new Error('World snapshot entity entry must be an object')
    }
    const components = (entity as { components?: unknown }).components
    if (!Array.isArray(components)) {
      throw new Error('World snapshot entity "components" must be an array')
    }
  }
}

function assertSerializedComponent(
  value: unknown
): asserts value is SerializedComponent {
  if (!value || typeof value !== 'object') {
    throw new Error('Invalid component payload in snapshot')
  }

  const item = value as {
    type?: unknown
    version?: unknown
  }

  if (typeof item.type !== 'string' || item.type.length === 0) {
    throw new Error('Serialized component is missing a valid "type"')
  }
  if (!Number.isInteger(item.version) || (item.version as number) < 1) {
    throw new Error(`Serialized component "${item.type}" has invalid "version"`)
  }
}
