/** Entity Component System primitives and world implementation. */
export declare const packageId = "@clockwork/ecs";
export interface EntityId {
    index: number;
    generation: number;
}
export type ComponentType<T = unknown> = string | symbol | (new (...args: unknown[]) => T);
export type ResourceToken<T = unknown> = string | symbol | (new (...args: unknown[]) => T);
export declare class ResourceType<_T> {
    private static symbolIds;
    private static ctorIds;
    private static nextId;
    readonly id: string;
    readonly version: number;
    readonly dependencies: ReadonlyArray<ResourceType<unknown>>;
    constructor(id: string, options?: {
        version?: number;
        dependencies?: ReadonlyArray<ResourceType<unknown>>;
    });
    static fromToken<T>(token: ResourceToken<T>): ResourceType<T>;
}
export declare class ResourceMap {
    private readonly values;
    private revision;
    insert<T>(type: ResourceType<T>, resource: T): void;
    get<T>(type: ResourceType<T>): T;
    tryGet<T>(type: ResourceType<T>): T | undefined;
    remove<T>(type: ResourceType<T>): void;
    has<T>(type: ResourceType<T>): boolean;
    getInstalledVersion<T>(type: ResourceType<T>): number | undefined;
    getRevision<T>(type: ResourceType<T>): number | undefined;
}
export declare const BuiltinResourceTypes: {
    readonly Time: ResourceType<{
        delta: number;
        elapsed: number;
        frameCount: number;
    }>;
    readonly Input: ResourceType<{
        keyboard: ReadonlySet<string>;
        mouse: {
            x: number;
            y: number;
            buttons: ReadonlySet<number>;
        };
        gamepads: readonly unknown[];
    }>;
    readonly Assets: ResourceType<unknown>;
    readonly Renderer: ResourceType<unknown>;
    readonly AudioContext: ResourceType<unknown>;
    readonly Rng: ResourceType<() => number>;
    readonly Config: ResourceType<Record<string, unknown>>;
    readonly Profiler: ResourceType<{
        frameMs: number;
        updateMs: number;
        renderMs: number;
    }>;
};
export interface FieldDefinition {
    name: string;
    type: string;
    default?: unknown;
}
export interface ComponentSchema {
    name: string;
    version: number;
    fields: FieldDefinition[];
    serialize(component: unknown): Uint8Array;
    deserialize(data: Uint8Array): unknown;
    migrate?(from: number, to: number, data: unknown): unknown;
}
/** Tracks entity lifecycle using reusable indices and generation checks. */
export declare class EntityManager {
    private readonly generations;
    private readonly alive;
    private readonly freeIndices;
    create(): EntityId;
    destroy(entity: EntityId): void;
    isAlive(entity: EntityId): boolean;
    getGeneration(entity: EntityId): number;
    iterAlive(): IterableIterator<EntityId>;
}
/** Stores components keyed by entity index while validating generation freshness. */
export declare class ComponentStore<T> {
    private readonly values;
    add(entity: EntityId, component: T, changeTick?: number): void;
    remove(entity: EntityId): void;
    removeByIndex(index: number): void;
    get(entity: EntityId): T | undefined;
    has(entity: EntityId): boolean;
    getChangedAt(entity: EntityId): number | undefined;
    iter(): IterableIterator<[EntityId, T]>;
}
export interface QueryResult {
    entity: EntityId;
    components: Map<ComponentType<unknown>, unknown>;
}
/** Declarative component filter over a world with deterministic entity order. */
export declare class Query<T extends QueryResult = QueryResult> {
    private readonly world;
    private readonly withTypes;
    private readonly withoutTypes;
    private readonly optionalTypes;
    private readonly changedTypes;
    private lastIteratedTick;
    constructor(world: World);
    with(...components: ComponentType<unknown>[]): this;
    without(...components: ComponentType<unknown>[]): this;
    optional(component: ComponentType<unknown>): this;
    changed(component: ComponentType<unknown>): this;
    iter(): IterableIterator<T>;
    private collectCandidates;
    private matches;
}
interface DeferredEntity {
    resolved?: EntityId;
    initialComponents: Array<{
        type: ComponentType<unknown>;
        component: unknown;
    }>;
}
/** Fluent immediate entity creation helper. */
export declare class EntityBuilder {
    private readonly world;
    private readonly entity;
    constructor(world: World, entity: EntityId);
    with<TComponent>(type: ComponentType<TComponent>, component: TComponent): this;
    build(): EntityId;
}
/** Fluent deferred entity creation helper used by CommandBuffer. */
export declare class DeferredEntityBuilder {
    private readonly deferred;
    constructor(deferred: DeferredEntity);
    with<TComponent>(type: ComponentType<TComponent>, component: TComponent): this;
}
/** Queues structural world changes and applies them at a controlled sync point. */
export declare class CommandBuffer {
    private readonly world;
    private readonly operations;
    constructor(world: World);
    spawn(): DeferredEntityBuilder;
    destroy(entity: EntityId): void;
    addComponent<TComponent>(entity: EntityId, type: ComponentType<TComponent>, component: TComponent): void;
    removeComponent(entity: EntityId, type: ComponentType<unknown>): void;
    flush(): void;
    private resolveEntity;
}
/** ECS world containing entities, component stores, and global resources. */
export declare class World {
    readonly entities: EntityManager;
    readonly components: Map<ComponentType<unknown>, ComponentStore<unknown>>;
    readonly resources: ResourceMap;
    private changeTick;
    get currentTick(): number;
    spawn(): EntityBuilder;
    spawnEntity(): EntityId;
    destroy(entity: EntityId): void;
    commands(): CommandBuffer;
    query<T extends QueryResult = QueryResult>(): Query<T>;
    getStore<TComponent>(type: ComponentType<TComponent>): ComponentStore<TComponent> | undefined;
    addComponent<TComponent>(entity: EntityId, type: ComponentType<TComponent>, component: TComponent): void;
    removeComponent(entity: EntityId, type: ComponentType<unknown>): void;
    getComponent<TComponent>(entity: EntityId, type: ComponentType<TComponent>): TComponent | undefined;
    hasComponent(entity: EntityId, type: ComponentType<unknown>): boolean;
    getComponentChangedAt(entity: EntityId, type: ComponentType<unknown>): number | undefined;
    insertResource<T>(type: ResourceToken<T>, resource: T): void;
    getResource<T>(type: ResourceToken<T>): T;
    tryGetResource<T>(type: ResourceToken<T>): T | undefined;
    removeResource<T>(type: ResourceToken<T>): void;
    hasResource<T>(type: ResourceToken<T>): boolean;
    private ensureStore;
}
/** Generic object pool for reducing hot-path allocations. */
export declare class ObjectPool<T> {
    private readonly factory;
    private readonly reset?;
    private readonly free;
    constructor(factory: () => T, reset?: ((item: T) => void) | undefined);
    acquire(): T;
    release(item: T): void;
    size(): number;
}
export interface WorldStats {
    entityCount: number;
    componentStoreCount: number;
    componentInstanceCount: number;
}
export declare function collectWorldStats(world: World): WorldStats;
export {};
//# sourceMappingURL=index.d.ts.map