export const packageId = '@clockwork/ecs'

/** Unique handle to a living entity, invalidated on destroy via generation bump. */
export interface EntityId {
  index: number
  generation: number
}

export type ComponentType<T = unknown> =
  | string
  | symbol
  | (new (...args: unknown[]) => T)

export type ResourceToken<T = unknown> =
  | string
  | symbol
  | (new (...args: unknown[]) => T)

/** Versioned resource descriptor with optional dependency tracking. */
export class ResourceType<_T> {
  private static symbolIds = new Map<symbol, number>()
  private static ctorIds = new WeakMap<object, number>()
  private static nextId = 0

  readonly id: string
  readonly version: number
  readonly dependencies: ReadonlyArray<ResourceType<unknown>>

  constructor(
    id: string,
    options?: {
      version?: number
      dependencies?: ReadonlyArray<ResourceType<unknown>>
    }
  ) {
    this.id = id
    this.version = options?.version ?? 1
    this.dependencies = options?.dependencies ?? []
  }

  static fromToken<T>(token: ResourceToken<T>): ResourceType<T> {
    if (typeof token === 'string') {
      return new ResourceType<T>(`string:${token}`)
    }
    if (typeof token === 'symbol') {
      let symbolId = this.symbolIds.get(token)
      if (symbolId === undefined) {
        symbolId = this.nextId++
        this.symbolIds.set(token, symbolId)
      }
      return new ResourceType<T>(`symbol:${symbolId}`)
    }

    let ctorId = this.ctorIds.get(token)
    if (ctorId === undefined) {
      ctorId = this.nextId++
      this.ctorIds.set(token, ctorId)
    }

    return new ResourceType<T>(`ctor:${ctorId}`)
  }
}

interface StoredResource {
  type: ResourceType<unknown>
  value: unknown
  revision: number
}

/** Type-safe container for named resources with dependency and version checks. */
export class ResourceMap {
  private readonly values = new Map<string, StoredResource>()
  private revision = 0

  insert<T>(type: ResourceType<T>, resource: T): void {
    for (const dependency of type.dependencies) {
      const installed = this.values.get(dependency.id)
      if (!installed) {
        throw new Error(
          `Resource "${type.id}" depends on missing "${dependency.id}"`
        )
      }
      if (installed.type.version < dependency.version) {
        throw new Error(
          `Resource "${type.id}" requires "${dependency.id}" version ${dependency.version}+, found ${installed.type.version}`
        )
      }
    }

    this.revision += 1
    this.values.set(type.id, {
      type,
      value: resource,
      revision: this.revision
    })
  }

  get<T>(type: ResourceType<T>): T {
    const resource = this.tryGet(type)
    if (resource === undefined) {
      throw new Error(
        `Resource "${type.id}" is not registered (required version ${type.version})`
      )
    }

    return resource
  }

  tryGet<T>(type: ResourceType<T>): T | undefined {
    const stored = this.values.get(type.id)
    if (!stored) {
      return undefined
    }

    return stored.value as T
  }

  remove<T>(type: ResourceType<T>): void {
    this.values.delete(type.id)
  }

  has<T>(type: ResourceType<T>): boolean {
    return this.values.has(type.id)
  }

  getInstalledVersion<T>(type: ResourceType<T>): number | undefined {
    return this.values.get(type.id)?.type.version
  }

  getRevision<T>(type: ResourceType<T>): number | undefined {
    return this.values.get(type.id)?.revision
  }
}

export const BuiltinResourceTypes = {
  Time: new ResourceType<{
    delta: number
    elapsed: number
    frameCount: number
  }>('builtin:Time'),
  Input: new ResourceType<{
    keyboard: ReadonlySet<string>
    mouse: { x: number; y: number; buttons: ReadonlySet<number> }
    gamepads: readonly unknown[]
  }>('builtin:Input'),
  Assets: new ResourceType<unknown>('builtin:Assets'),
  Renderer: new ResourceType<unknown>('builtin:Renderer'),
  AudioContext: new ResourceType<unknown>('builtin:AudioContext'),
  Rng: new ResourceType<() => number>('builtin:Rng'),
  Config: new ResourceType<Record<string, unknown>>('builtin:Config'),
  Profiler: new ResourceType<{
    frameMs: number
    updateMs: number
    renderMs: number
  }>('builtin:Profiler')
} as const

export interface FieldDefinition {
  name: string
  type: string
  default?: unknown
}

export interface ComponentSchema {
  name: string
  version: number
  fields: FieldDefinition[]
  serialize(component: unknown): Uint8Array
  deserialize(data: Uint8Array): unknown
  migrate?(from: number, to: number, data: unknown): unknown
}

interface StoredComponent<T> {
  generation: number
  value: T
  changedAt: number
}
/** Generational entity allocator with free-list recycling. */
export class EntityManager {
  private readonly generations: number[] = []
  private readonly alive: boolean[] = []
  private readonly freeIndices: number[] = []
  aliveCount = 0

  create(): EntityId {
    this.aliveCount += 1
    const index = this.freeIndices.pop()
    if (index === undefined) {
      const newIndex = this.generations.length
      this.generations.push(0)
      this.alive.push(true)
      return { index: newIndex, generation: 0 }
    }

    this.alive[index] = true
    return { index, generation: this.generations[index]! }
  }

  destroy(entity: EntityId): void {
    if (!this.isAlive(entity)) {
      return
    }

    this.aliveCount -= 1
    const { index } = entity
    this.alive[index] = false
    this.generations[index] = (this.generations[index]! + 1) >>> 0
    this.freeIndices.push(index)
  }

  isAlive(entity: EntityId): boolean {
    const { index, generation } = entity
    if (index < 0 || index >= this.generations.length) {
      return false
    }

    return this.alive[index] === true && this.generations[index] === generation
  }

  getGeneration(entity: EntityId): number {
    if (entity.index < 0 || entity.index >= this.generations.length) {
      return 0
    }

    return this.generations[entity.index]!
  }

  *iterAlive(): IterableIterator<EntityId> {
    for (let index = 0; index < this.alive.length; index += 1) {
      if (!this.alive[index]) {
        continue
      }

      yield { index, generation: this.generations[index]! }
    }
  }
}
/** Sparse storage for a single component type, keyed by entity index with generation guard. */
export class ComponentStore<T> {
  private readonly values = new Map<number, StoredComponent<T>>()

  add(entity: EntityId, component: T, changeTick = 0): void {
    this.values.set(entity.index, {
      generation: entity.generation,
      value: component,
      changedAt: changeTick
    })
  }

  remove(entity: EntityId): void {
    const current = this.values.get(entity.index)
    if (!current || current.generation !== entity.generation) {
      return
    }

    this.values.delete(entity.index)
  }

  removeByIndex(index: number): void {
    this.values.delete(index)
  }

  get(entity: EntityId): T | undefined {
    const current = this.values.get(entity.index)
    if (!current || current.generation !== entity.generation) {
      return undefined
    }

    return current.value
  }

  has(entity: EntityId): boolean {
    const current = this.values.get(entity.index)
    return Boolean(current && current.generation === entity.generation)
  }

  getChangedAt(entity: EntityId): number | undefined {
    const current = this.values.get(entity.index)
    if (!current || current.generation !== entity.generation) {
      return undefined
    }

    return current.changedAt
  }

  *iter(): IterableIterator<[EntityId, T]> {
    const keys = [...this.values.keys()].sort((a, b) => a - b)
    for (const index of keys) {
      const stored = this.values.get(index)!
      yield [{ index, generation: stored.generation }, stored.value]
    }
  }

  sortedEntities(): EntityId[] {
    const keys = [...this.values.keys()].sort((a, b) => a - b)
    const result: EntityId[] = new Array(keys.length)
    for (let i = 0; i < keys.length; i += 1) {
      const index = keys[i]!
      const stored = this.values.get(index)!
      result[i] = { index, generation: stored.generation }
    }
    return result
  }
}

export interface QueryResult {
  entity: EntityId
  components: Map<ComponentType<unknown>, unknown>
}
/** Fluent query builder for iterating entities matching component filters. */
export class Query<T extends QueryResult = QueryResult> {
  private readonly withTypes = new Set<ComponentType<unknown>>()
  private readonly withoutTypes = new Set<ComponentType<unknown>>()
  private readonly optionalTypes = new Set<ComponentType<unknown>>()
  private readonly changedTypes = new Set<ComponentType<unknown>>()
  private lastIteratedTick = -1

  constructor(private readonly world: World) {}

  with(...components: ComponentType<unknown>[]): this {
    for (const type of components) {
      this.withTypes.add(type)
    }
    return this
  }

  without(...components: ComponentType<unknown>[]): this {
    for (const type of components) {
      this.withoutTypes.add(type)
    }
    return this
  }

  optional(component: ComponentType<unknown>): this {
    this.optionalTypes.add(component)
    return this
  }

  changed(component: ComponentType<unknown>): this {
    this.changedTypes.add(component)
    return this
  }

  *iter(): IterableIterator<T> {
    const candidates = this.collectCandidates()
    for (const entity of candidates) {
      if (!this.matches(entity)) {
        continue
      }

      const components = new Map<ComponentType<unknown>, unknown>()

      for (const type of this.withTypes) {
        components.set(type, this.world.getComponent(entity, type))
      }

      for (const type of this.optionalTypes) {
        components.set(type, this.world.getComponent(entity, type))
      }

      yield { entity, components } as T
    }

    this.lastIteratedTick = this.world.currentTick
  }

  private collectCandidates(): EntityId[] {
    const withTypes = [...this.withTypes]
    if (withTypes.length === 0) {
      return [...this.world.entities.iterAlive()]
    }

    const seedStore = this.world.getStore(withTypes[0]!)
    if (!seedStore) {
      return []
    }

    return seedStore.sortedEntities()
  }

  private matches(entity: EntityId): boolean {
    if (!this.world.entities.isAlive(entity)) {
      return false
    }

    for (const type of this.withTypes) {
      if (!this.world.hasComponent(entity, type)) {
        return false
      }
    }

    for (const type of this.withoutTypes) {
      if (this.world.hasComponent(entity, type)) {
        return false
      }
    }

    for (const type of this.changedTypes) {
      const changedAt = this.world.getComponentChangedAt(entity, type)
      if (changedAt === undefined || changedAt <= this.lastIteratedTick) {
        return false
      }
    }

    return true
  }
}

interface DeferredEntity {
  resolved?: EntityId
  initialComponents: Array<{ type: ComponentType<unknown>; component: unknown }>
}

type CommandOperation =
  | { kind: 'spawn'; deferred: DeferredEntity }
  | { kind: 'destroy'; entity: EntityId | DeferredEntity }
  | {
      kind: 'add'
      entity: EntityId | DeferredEntity
      type: ComponentType<unknown>
      component: unknown
    }
  | {
      kind: 'remove'
      entity: EntityId | DeferredEntity
      type: ComponentType<unknown>
    }
/** Fluent builder for attaching components to a newly spawned entity. */
export class EntityBuilder {
  constructor(
    private readonly world: World,
    private readonly entity: EntityId
  ) {}

  with<TComponent>(
    type: ComponentType<TComponent>,
    component: TComponent
  ): this {
    this.world.addComponent(this.entity, type, component)
    return this
  }

  build(): EntityId {
    return this.entity
  }
}
export class DeferredEntityBuilder {
  constructor(private readonly deferred: DeferredEntity) {}

  with<TComponent>(
    type: ComponentType<TComponent>,
    component: TComponent
  ): this {
    this.deferred.initialComponents.push({ type, component })
    return this
  }
}
/** Deferred mutation queue that batches spawn/destroy/component operations until flush. */
export class CommandBuffer {
  private readonly operations: CommandOperation[] = []

  constructor(private readonly world: World) {}

  spawn(): DeferredEntityBuilder {
    const deferred: DeferredEntity = { initialComponents: [] }
    this.operations.push({ kind: 'spawn', deferred })
    return new DeferredEntityBuilder(deferred)
  }

  destroy(entity: EntityId): void {
    this.operations.push({ kind: 'destroy', entity })
  }

  addComponent<TComponent>(
    entity: EntityId,
    type: ComponentType<TComponent>,
    component: TComponent
  ): void {
    this.operations.push({ kind: 'add', entity, type, component })
  }

  removeComponent(entity: EntityId, type: ComponentType<unknown>): void {
    this.operations.push({ kind: 'remove', entity, type })
  }

  flush(): void {
    for (const operation of this.operations) {
      switch (operation.kind) {
        case 'spawn': {
          const entity = this.world.spawnEntity()
          operation.deferred.resolved = entity
          for (const entry of operation.deferred.initialComponents) {
            this.world.addComponent(entity, entry.type, entry.component)
          }
          break
        }
        case 'destroy': {
          const entity = this.resolveEntity(operation.entity)
          if (entity) {
            this.world.destroy(entity)
          }
          break
        }
        case 'add': {
          const entity = this.resolveEntity(operation.entity)
          if (entity) {
            this.world.addComponent(entity, operation.type, operation.component)
          }
          break
        }
        case 'remove': {
          const entity = this.resolveEntity(operation.entity)
          if (entity) {
            this.world.removeComponent(entity, operation.type)
          }
          break
        }
      }
    }

    this.operations.length = 0
  }

  private resolveEntity(
    entity: EntityId | DeferredEntity
  ): EntityId | undefined {
    if ('initialComponents' in entity) {
      return entity.resolved
    }

    return entity
  }
}
/** Central ECS container owning all entities, component stores, and resources. */
export class World {
  readonly entities = new EntityManager()
  readonly components = new Map<
    ComponentType<unknown>,
    ComponentStore<unknown>
  >()
  readonly resources = new ResourceMap()

  private changeTick = 0

  get currentTick(): number {
    return this.changeTick
  }

  spawn(): EntityBuilder {
    return new EntityBuilder(this, this.spawnEntity())
  }

  spawnEntity(): EntityId {
    this.changeTick += 1
    return this.entities.create()
  }

  destroy(entity: EntityId): void {
    if (!this.entities.isAlive(entity)) {
      return
    }

    for (const store of this.components.values()) {
      store.removeByIndex(entity.index)
    }

    this.entities.destroy(entity)
    this.changeTick += 1
  }

  commands(): CommandBuffer {
    return new CommandBuffer(this)
  }

  query<T extends QueryResult = QueryResult>(): Query<T> {
    return new Query<T>(this)
  }

  getStore<TComponent>(
    type: ComponentType<TComponent>
  ): ComponentStore<TComponent> | undefined {
    return this.components.get(type) as ComponentStore<TComponent> | undefined
  }

  addComponent<TComponent>(
    entity: EntityId,
    type: ComponentType<TComponent>,
    component: TComponent
  ): void {
    if (!this.entities.isAlive(entity)) {
      return
    }

    const store = this.ensureStore(type)
    this.changeTick += 1
    store.add(entity, component, this.changeTick)
  }

  removeComponent(entity: EntityId, type: ComponentType<unknown>): void {
    if (!this.entities.isAlive(entity)) {
      return
    }

    const store = this.components.get(type)
    if (!store) {
      return
    }

    store.remove(entity)
    this.changeTick += 1
  }

  getComponent<TComponent>(
    entity: EntityId,
    type: ComponentType<TComponent>
  ): TComponent | undefined {
    return this.getStore(type)?.get(entity)
  }

  hasComponent(entity: EntityId, type: ComponentType<unknown>): boolean {
    return this.components.get(type)?.has(entity) ?? false
  }

  getComponentChangedAt(
    entity: EntityId,
    type: ComponentType<unknown>
  ): number | undefined {
    return this.components.get(type)?.getChangedAt(entity)
  }

  insertResource<T>(type: ResourceToken<T>, resource: T): void {
    this.resources.insert(ResourceType.fromToken(type), resource)
  }

  getResource<T>(type: ResourceToken<T>): T {
    return this.resources.get(ResourceType.fromToken(type))
  }

  tryGetResource<T>(type: ResourceToken<T>): T | undefined {
    return this.resources.tryGet(ResourceType.fromToken(type))
  }

  removeResource<T>(type: ResourceToken<T>): void {
    this.resources.remove(ResourceType.fromToken(type))
  }

  hasResource<T>(type: ResourceToken<T>): boolean {
    return this.resources.has(ResourceType.fromToken(type))
  }

  private ensureStore<TComponent>(
    type: ComponentType<TComponent>
  ): ComponentStore<TComponent> {
    let store = this.components.get(type) as
      | ComponentStore<TComponent>
      | undefined
    if (!store) {
      store = new ComponentStore<TComponent>()
      this.components.set(type, store as ComponentStore<unknown>)
    }

    return store
  }
}
/** Reusable object pool to reduce GC pressure in hot paths. */
export class ObjectPool<T> {
  private readonly free: T[] = []

  constructor(
    private readonly factory: () => T,
    private readonly reset?: (item: T) => void
  ) {}

  acquire(): T {
    return this.free.pop() ?? this.factory()
  }

  release(item: T): void {
    this.reset?.(item)
    this.free.push(item)
  }

  size(): number {
    return this.free.length
  }
}

export interface WorldStats {
  entityCount: number
  componentStoreCount: number
  componentInstanceCount: number
}

export function collectWorldStats(world: World): WorldStats {
  const entityCount = world.entities.aliveCount
  let componentInstanceCount = 0

  for (const store of world.components.values()) {
    componentInstanceCount += [...store.iter()].length
  }

  return {
    entityCount,
    componentStoreCount: world.components.size,
    componentInstanceCount
  }
}
