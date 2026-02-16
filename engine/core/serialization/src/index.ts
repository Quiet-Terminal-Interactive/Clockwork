import { type ComponentType, World } from '@clockwork/ecs'

export const packageId = '@clockwork/serialization'

export interface ComponentSerializationSchema<T = unknown> {
  version: number
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

/** JSON world snapshot serializer with per-component schema migration. */
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

  constructor(private readonly snapshotVersion = 1) {}

  register<T>(
    type: ComponentType<T>,
    schema: ComponentSerializationSchema<T>
  ): void {
    const normalized = schema as ComponentSerializationSchema<unknown>
    this.schemas.set(type as ComponentType<unknown>, normalized)

    const id = getTypeId(type)
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

        components.push({
          type: getTypeId(type),
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
    const snapshot = JSON.parse(this.decoder.decode(data)) as WorldSnapshot
    const world = new World()

    for (const entityData of snapshot.entities) {
      const entity = world.spawn().build()

      for (const component of entityData.components) {
        const schema = this.byId.get(component.type)
        const type = this.idToType.get(component.type)
        if (!type) {
          continue
        }

        let payload = component.data
        if (schema) {
          const from = component.version
          const to = schema.version
          if (from !== to && schema.migrate) {
            payload = schema.migrate(from, to, payload)
          }
          payload = schema.deserialize(payload)
        }

        world.addComponent(entity, type, payload)
      }
    }

    return world
  }
}

function getTypeId(type: ComponentType<unknown>): string {
  if (typeof type === 'string') {
    return `str:${type}`
  }
  if (typeof type === 'symbol') {
    return `sym:${type.description ?? 'anonymous'}`
  }
  return `ctor:${type.name || 'anonymous'}`
}
