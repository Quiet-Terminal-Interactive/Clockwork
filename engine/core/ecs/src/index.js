/** Entity Component System primitives and world implementation. */
export const packageId = '@clockwork/ecs';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export class ResourceType {
    static symbolIds = new Map();
    static ctorIds = new WeakMap();
    static nextId = 0;
    id;
    version;
    dependencies;
    constructor(id, options) {
        this.id = id;
        this.version = options?.version ?? 1;
        this.dependencies = options?.dependencies ?? [];
    }
    static fromToken(token) {
        if (typeof token === 'string') {
            return new ResourceType(`string:${token}`);
        }
        if (typeof token === 'symbol') {
            let symbolId = this.symbolIds.get(token);
            if (symbolId === undefined) {
                symbolId = this.nextId++;
                this.symbolIds.set(token, symbolId);
            }
            return new ResourceType(`symbol:${symbolId}`);
        }
        let ctorId = this.ctorIds.get(token);
        if (ctorId === undefined) {
            ctorId = this.nextId++;
            this.ctorIds.set(token, ctorId);
        }
        return new ResourceType(`ctor:${ctorId}`);
    }
}
export class ResourceMap {
    values = new Map();
    revision = 0;
    insert(type, resource) {
        for (const dependency of type.dependencies) {
            const installed = this.values.get(dependency.id);
            if (!installed) {
                throw new Error(`Resource "${type.id}" depends on missing "${dependency.id}"`);
            }
            if (installed.type.version < dependency.version) {
                throw new Error(`Resource "${type.id}" requires "${dependency.id}" version ${dependency.version}+, found ${installed.type.version}`);
            }
        }
        this.revision += 1;
        this.values.set(type.id, {
            type,
            value: resource,
            revision: this.revision
        });
    }
    get(type) {
        const resource = this.tryGet(type);
        if (resource === undefined) {
            throw new Error(`Resource "${type.id}" is not registered (required version ${type.version})`);
        }
        return resource;
    }
    tryGet(type) {
        const stored = this.values.get(type.id);
        if (!stored) {
            return undefined;
        }
        return stored.value;
    }
    remove(type) {
        this.values.delete(type.id);
    }
    has(type) {
        return this.values.has(type.id);
    }
    getInstalledVersion(type) {
        return this.values.get(type.id)?.type.version;
    }
    getRevision(type) {
        return this.values.get(type.id)?.revision;
    }
}
export const BuiltinResourceTypes = {
    Time: new ResourceType('builtin:Time'),
    Input: new ResourceType('builtin:Input'),
    Assets: new ResourceType('builtin:Assets'),
    Renderer: new ResourceType('builtin:Renderer'),
    AudioContext: new ResourceType('builtin:AudioContext'),
    Rng: new ResourceType('builtin:Rng'),
    Config: new ResourceType('builtin:Config'),
    Profiler: new ResourceType('builtin:Profiler')
};
/** Tracks entity lifecycle using reusable indices and generation checks. */
export class EntityManager {
    generations = [];
    alive = [];
    freeIndices = [];
    create() {
        const index = this.freeIndices.pop();
        if (index === undefined) {
            const newIndex = this.generations.length;
            this.generations.push(0);
            this.alive.push(true);
            return { index: newIndex, generation: 0 };
        }
        this.alive[index] = true;
        return { index, generation: this.generations[index] };
    }
    destroy(entity) {
        if (!this.isAlive(entity)) {
            return;
        }
        const { index } = entity;
        this.alive[index] = false;
        this.generations[index] = (this.generations[index] + 1) >>> 0;
        this.freeIndices.push(index);
    }
    isAlive(entity) {
        const { index, generation } = entity;
        if (index < 0 || index >= this.generations.length) {
            return false;
        }
        return this.alive[index] === true && this.generations[index] === generation;
    }
    getGeneration(entity) {
        if (entity.index < 0 || entity.index >= this.generations.length) {
            return 0;
        }
        return this.generations[entity.index];
    }
    *iterAlive() {
        for (let index = 0; index < this.alive.length; index += 1) {
            if (!this.alive[index]) {
                continue;
            }
            yield { index, generation: this.generations[index] };
        }
    }
}
/** Stores components keyed by entity index while validating generation freshness. */
export class ComponentStore {
    values = new Map();
    add(entity, component, changeTick = 0) {
        this.values.set(entity.index, {
            generation: entity.generation,
            value: component,
            changedAt: changeTick
        });
    }
    remove(entity) {
        const current = this.values.get(entity.index);
        if (!current || current.generation !== entity.generation) {
            return;
        }
        this.values.delete(entity.index);
    }
    removeByIndex(index) {
        this.values.delete(index);
    }
    get(entity) {
        const current = this.values.get(entity.index);
        if (!current || current.generation !== entity.generation) {
            return undefined;
        }
        return current.value;
    }
    has(entity) {
        const current = this.values.get(entity.index);
        return Boolean(current && current.generation === entity.generation);
    }
    getChangedAt(entity) {
        const current = this.values.get(entity.index);
        if (!current || current.generation !== entity.generation) {
            return undefined;
        }
        return current.changedAt;
    }
    *iter() {
        const keys = [...this.values.keys()].sort((a, b) => a - b);
        for (const index of keys) {
            const stored = this.values.get(index);
            yield [{ index, generation: stored.generation }, stored.value];
        }
    }
}
/** Declarative component filter over a world with deterministic entity order. */
export class Query {
    world;
    withTypes = new Set();
    withoutTypes = new Set();
    optionalTypes = new Set();
    changedTypes = new Set();
    lastIteratedTick = -1;
    constructor(world) {
        this.world = world;
    }
    with(...components) {
        for (const type of components) {
            this.withTypes.add(type);
        }
        return this;
    }
    without(...components) {
        for (const type of components) {
            this.withoutTypes.add(type);
        }
        return this;
    }
    optional(component) {
        this.optionalTypes.add(component);
        return this;
    }
    changed(component) {
        this.changedTypes.add(component);
        return this;
    }
    *iter() {
        const candidates = this.collectCandidates();
        for (const entity of candidates) {
            if (!this.matches(entity)) {
                continue;
            }
            const components = new Map();
            for (const type of this.withTypes) {
                components.set(type, this.world.getComponent(entity, type));
            }
            for (const type of this.optionalTypes) {
                components.set(type, this.world.getComponent(entity, type));
            }
            yield { entity, components };
        }
        this.lastIteratedTick = this.world.currentTick;
    }
    collectCandidates() {
        const withTypes = [...this.withTypes];
        if (withTypes.length === 0) {
            return [...this.world.entities.iterAlive()];
        }
        const seedStore = this.world.getStore(withTypes[0]);
        if (!seedStore) {
            return [];
        }
        return [...seedStore.iter()].map(([entity]) => entity);
    }
    matches(entity) {
        if (!this.world.entities.isAlive(entity)) {
            return false;
        }
        for (const type of this.withTypes) {
            if (!this.world.hasComponent(entity, type)) {
                return false;
            }
        }
        for (const type of this.withoutTypes) {
            if (this.world.hasComponent(entity, type)) {
                return false;
            }
        }
        for (const type of this.changedTypes) {
            const changedAt = this.world.getComponentChangedAt(entity, type);
            if (changedAt === undefined || changedAt <= this.lastIteratedTick) {
                return false;
            }
        }
        return true;
    }
}
/** Fluent immediate entity creation helper. */
export class EntityBuilder {
    world;
    entity;
    constructor(world, entity) {
        this.world = world;
        this.entity = entity;
    }
    with(type, component) {
        this.world.addComponent(this.entity, type, component);
        return this;
    }
    build() {
        return this.entity;
    }
}
/** Fluent deferred entity creation helper used by CommandBuffer. */
export class DeferredEntityBuilder {
    deferred;
    constructor(deferred) {
        this.deferred = deferred;
    }
    with(type, component) {
        this.deferred.initialComponents.push({ type, component });
        return this;
    }
}
/** Queues structural world changes and applies them at a controlled sync point. */
export class CommandBuffer {
    world;
    operations = [];
    constructor(world) {
        this.world = world;
    }
    spawn() {
        const deferred = { initialComponents: [] };
        this.operations.push({ kind: 'spawn', deferred });
        return new DeferredEntityBuilder(deferred);
    }
    destroy(entity) {
        this.operations.push({ kind: 'destroy', entity });
    }
    addComponent(entity, type, component) {
        this.operations.push({ kind: 'add', entity, type, component });
    }
    removeComponent(entity, type) {
        this.operations.push({ kind: 'remove', entity, type });
    }
    flush() {
        for (const operation of this.operations) {
            switch (operation.kind) {
                case 'spawn': {
                    const entity = this.world.spawnEntity();
                    operation.deferred.resolved = entity;
                    for (const entry of operation.deferred.initialComponents) {
                        this.world.addComponent(entity, entry.type, entry.component);
                    }
                    break;
                }
                case 'destroy': {
                    const entity = this.resolveEntity(operation.entity);
                    if (entity) {
                        this.world.destroy(entity);
                    }
                    break;
                }
                case 'add': {
                    const entity = this.resolveEntity(operation.entity);
                    if (entity) {
                        this.world.addComponent(entity, operation.type, operation.component);
                    }
                    break;
                }
                case 'remove': {
                    const entity = this.resolveEntity(operation.entity);
                    if (entity) {
                        this.world.removeComponent(entity, operation.type);
                    }
                    break;
                }
            }
        }
        this.operations.length = 0;
    }
    resolveEntity(entity) {
        if ('initialComponents' in entity) {
            return entity.resolved;
        }
        return entity;
    }
}
/** ECS world containing entities, component stores, and global resources. */
export class World {
    entities = new EntityManager();
    components = new Map();
    resources = new ResourceMap();
    changeTick = 0;
    get currentTick() {
        return this.changeTick;
    }
    spawn() {
        return new EntityBuilder(this, this.spawnEntity());
    }
    spawnEntity() {
        this.changeTick += 1;
        return this.entities.create();
    }
    destroy(entity) {
        if (!this.entities.isAlive(entity)) {
            return;
        }
        for (const store of this.components.values()) {
            store.removeByIndex(entity.index);
        }
        this.entities.destroy(entity);
        this.changeTick += 1;
    }
    commands() {
        return new CommandBuffer(this);
    }
    query() {
        return new Query(this);
    }
    getStore(type) {
        return this.components.get(type);
    }
    addComponent(entity, type, component) {
        if (!this.entities.isAlive(entity)) {
            return;
        }
        const store = this.ensureStore(type);
        this.changeTick += 1;
        store.add(entity, component, this.changeTick);
    }
    removeComponent(entity, type) {
        if (!this.entities.isAlive(entity)) {
            return;
        }
        const store = this.components.get(type);
        if (!store) {
            return;
        }
        store.remove(entity);
        this.changeTick += 1;
    }
    getComponent(entity, type) {
        return this.getStore(type)?.get(entity);
    }
    hasComponent(entity, type) {
        return this.components.get(type)?.has(entity) ?? false;
    }
    getComponentChangedAt(entity, type) {
        return this.components.get(type)?.getChangedAt(entity);
    }
    insertResource(type, resource) {
        this.resources.insert(ResourceType.fromToken(type), resource);
    }
    getResource(type) {
        return this.resources.get(ResourceType.fromToken(type));
    }
    tryGetResource(type) {
        return this.resources.tryGet(ResourceType.fromToken(type));
    }
    removeResource(type) {
        this.resources.remove(ResourceType.fromToken(type));
    }
    hasResource(type) {
        return this.resources.has(ResourceType.fromToken(type));
    }
    ensureStore(type) {
        let store = this.components.get(type);
        if (!store) {
            store = new ComponentStore();
            this.components.set(type, store);
        }
        return store;
    }
}
/** Generic object pool for reducing hot-path allocations. */
export class ObjectPool {
    factory;
    reset;
    free = [];
    constructor(factory, reset) {
        this.factory = factory;
        this.reset = reset;
    }
    acquire() {
        return this.free.pop() ?? this.factory();
    }
    release(item) {
        this.reset?.(item);
        this.free.push(item);
    }
    size() {
        return this.free.length;
    }
}
export function collectWorldStats(world) {
    let entityCount = 0;
    let componentInstanceCount = 0;
    for (const _entity of world.entities.iterAlive()) {
        entityCount += 1;
    }
    for (const store of world.components.values()) {
        componentInstanceCount += [...store.iter()].length;
    }
    return {
        entityCount,
        componentStoreCount: world.components.size,
        componentInstanceCount
    };
}
//# sourceMappingURL=index.js.map