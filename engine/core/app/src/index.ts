/** App builder and plugin lifecycle orchestration. */
import { type ComponentSchema, type ResourceToken, World } from '@clockwork/ecs'
import { EventBus } from '@clockwork/events'
import { Scheduler, type System } from '@clockwork/scheduler'

export const packageId = '@clockwork/app'

export type RegistryType<T = unknown> =
  | string
  | symbol
  | (new (...args: unknown[]) => T)

/** Plugin contract for extending app setup and lifecycle. */
export interface Plugin {
  id: string
  version: string
  depends?: string[]
  init(app: AppBuilder): void
  shutdown?(app: App): void
  reload?(): void
}

/** Component schema registry with plugin ownership checks. */
export class ComponentRegistry {
  private readonly schemas = new Map<RegistryType<unknown>, ComponentSchema>()
  private readonly owners = new Map<RegistryType<unknown>, string>()
  private activeOwner: string | undefined

  setActiveOwner(owner?: string): void {
    this.activeOwner = owner
  }

  register(type: RegistryType<unknown>, schema: ComponentSchema): void {
    this.assertWriteAllowed(type)
    this.schemas.set(type, schema)
    if (this.activeOwner && !this.owners.has(type)) {
      this.owners.set(type, this.activeOwner)
    }
  }

  get(type: RegistryType<unknown>): ComponentSchema | undefined {
    return this.schemas.get(type)
  }

  remove(type: RegistryType<unknown>): void {
    this.assertWriteAllowed(type)
    this.schemas.delete(type)
    this.owners.delete(type)
  }

  private assertWriteAllowed(type: RegistryType<unknown>): void {
    const owner = this.owners.get(type)
    if (owner && this.activeOwner && owner !== this.activeOwner) {
      throw new Error(
        `Registry key is owned by plugin "${owner}", not "${this.activeOwner}"`
      )
    }
  }
}

interface SystemEntry {
  stage: string
  order: number | undefined
  system: System
}

/** System registration queue applied to scheduler during build. */
export class SystemRegistry {
  private readonly entries = new Map<string, SystemEntry>()
  private readonly owners = new Map<string, string>()
  private activeOwner: string | undefined

  setActiveOwner(owner?: string): void {
    this.activeOwner = owner
  }

  add(stage: string, system: System, options?: { order?: number }): void {
    this.assertWriteAllowed(system.id)
    this.entries.set(system.id, { stage, order: options?.order, system })
    if (this.activeOwner && !this.owners.has(system.id)) {
      this.owners.set(system.id, this.activeOwner)
    }
  }

  remove(systemId: string): void {
    this.assertWriteAllowed(systemId)
    this.entries.delete(systemId)
    this.owners.delete(systemId)
  }

  installTo(scheduler: Scheduler): void {
    for (const entry of this.entries.values()) {
      scheduler.addSystem(entry.stage, entry.system, entry.order)
    }
  }

  private assertWriteAllowed(systemId: string): void {
    const owner = this.owners.get(systemId)
    if (owner && this.activeOwner && owner !== this.activeOwner) {
      throw new Error(
        `System "${systemId}" is owned by plugin "${owner}", not "${this.activeOwner}"`
      )
    }
  }
}

/** Global resource registration queue applied to world during build. */
export class ResourceRegistry {
  private readonly resources = new Map<RegistryType<unknown>, unknown>()
  private readonly owners = new Map<RegistryType<unknown>, string>()
  private activeOwner: string | undefined

  setActiveOwner(owner?: string): void {
    this.activeOwner = owner
  }

  insert<T>(type: RegistryType<T>, resource: T): void {
    this.assertWriteAllowed(type)
    this.resources.set(type, resource)
    if (this.activeOwner && !this.owners.has(type)) {
      this.owners.set(type, this.activeOwner)
    }
  }

  get<T>(type: RegistryType<T>): T | undefined {
    return this.resources.get(type) as T | undefined
  }

  remove(type: RegistryType<unknown>): void {
    this.assertWriteAllowed(type)
    this.resources.delete(type)
    this.owners.delete(type)
  }

  installTo(world: World): void {
    for (const [type, resource] of this.resources.entries()) {
      world.insertResource(type as ResourceToken<unknown>, resource)
    }
  }

  private assertWriteAllowed(type: RegistryType<unknown>): void {
    const owner = this.owners.get(type)
    if (owner && this.activeOwner && owner !== this.activeOwner) {
      throw new Error(
        `Resource key is owned by plugin "${owner}", not "${this.activeOwner}"`
      )
    }
  }
}

/** Asset loader registration map for engine-facing asset extensions. */
export class AssetRegistry {
  private readonly loaders = new Map<string, unknown>()
  private readonly owners = new Map<string, string>()
  private activeOwner: string | undefined

  setActiveOwner(owner?: string): void {
    this.activeOwner = owner
  }

  register(extension: string, loader: unknown): void {
    this.assertWriteAllowed(extension)
    this.loaders.set(extension, loader)
    if (this.activeOwner && !this.owners.has(extension)) {
      this.owners.set(extension, this.activeOwner)
    }
  }

  get<T>(extension: string): T | undefined {
    return this.loaders.get(extension) as T | undefined
  }

  remove(extension: string): void {
    this.assertWriteAllowed(extension)
    this.loaders.delete(extension)
    this.owners.delete(extension)
  }

  private assertWriteAllowed(extension: string): void {
    const owner = this.owners.get(extension)
    if (owner && this.activeOwner && owner !== this.activeOwner) {
      throw new Error(
        `Asset loader "${extension}" is owned by plugin "${owner}", not "${this.activeOwner}"`
      )
    }
  }
}

/** Plugin registry with dependency resolution and lifecycle hooks. */
export class PluginManager {
  private readonly plugins = new Map<string, Plugin>()
  private initializedIds: string[] = []
  private app?: App

  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`)
    }

    this.plugins.set(plugin.id, plugin)
  }

  unregister(pluginId: string): void {
    if (!this.plugins.has(pluginId)) {
      return
    }

    for (const plugin of this.plugins.values()) {
      if (plugin.depends?.includes(pluginId)) {
        throw new Error(
          `Cannot unregister "${pluginId}" while "${plugin.id}" depends on it`
        )
      }
    }

    const plugin = this.plugins.get(pluginId)
    if (plugin && this.app && this.initializedIds.includes(pluginId)) {
      plugin.shutdown?.(this.app)
      this.initializedIds = this.initializedIds.filter((id) => id !== pluginId)
    }

    this.plugins.delete(pluginId)
  }

  reload(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin || !plugin.reload) {
      return
    }

    try {
      plugin.reload()
    } catch {
      // Phase 20 will give us richer diagnostics. Today we just keep the app alive.
    }
  }

  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId)
  }

  initialize(builder: AppBuilder): void {
    const ordered = this.resolveDependencies()
    this.initializedIds = []

    for (const plugin of ordered) {
      builder.setActivePlugin(plugin.id)
      try {
        plugin.init(builder)
      } finally {
        builder.setActivePlugin(undefined)
      }
      this.initializedIds.push(plugin.id)
    }
  }

  shutdownAll(app: App): void {
    this.app = app
    const reverseOrder = [...this.initializedIds].reverse()
    for (const pluginId of reverseOrder) {
      this.plugins.get(pluginId)?.shutdown?.(app)
    }
    this.initializedIds = []
  }

  attachApp(app: App): void {
    this.app = app
  }

  private resolveDependencies(): Plugin[] {
    const visiting = new Set<string>()
    const visited = new Set<string>()
    const ordered: Plugin[] = []

    const visit = (pluginId: string): void => {
      if (visited.has(pluginId)) {
        return
      }
      if (visiting.has(pluginId)) {
        throw new Error(`Circular plugin dependency detected at "${pluginId}"`)
      }

      const plugin = this.plugins.get(pluginId)
      if (!plugin) {
        throw new Error(`Unknown plugin "${pluginId}"`)
      }

      visiting.add(pluginId)
      for (const dependency of plugin.depends ?? []) {
        if (!this.plugins.has(dependency)) {
          throw new Error(
            `Plugin "${plugin.id}" depends on missing plugin "${dependency}"`
          )
        }
        visit(dependency)
      }
      visiting.delete(pluginId)
      visited.add(pluginId)
      ordered.push(plugin)
    }

    for (const pluginId of this.plugins.keys()) {
      visit(pluginId)
    }

    return ordered
  }
}

/** Runtime app with world, scheduler, and plugin manager. */
export class App {
  constructor(
    readonly world: World,
    readonly scheduler: Scheduler,
    readonly plugins: PluginManager
  ) {}

  run(): void {
    this.scheduler.run()
  }

  async step(dt: number): Promise<void> {
    await this.scheduler.step(dt)
  }

  async shutdown(): Promise<void> {
    await this.scheduler.shutdown()
    this.plugins.shutdownAll(this)
  }
}

/** App assembly entry point that plugins extend at build time. */
export class AppBuilder {
  readonly components = new ComponentRegistry()
  readonly systems = new SystemRegistry()
  readonly resources = new ResourceRegistry()
  readonly assets = new AssetRegistry()

  private readonly pluginManager = new PluginManager()

  use(plugin: Plugin): this {
    this.pluginManager.register(plugin)
    return this
  }

  build(): App {
    this.pluginManager.initialize(this)

    const world = new World()
    const events = new EventBus()
    const scheduler = new Scheduler({ world, events })

    this.resources.installTo(world)
    this.systems.installTo(scheduler)

    const app = new App(world, scheduler, this.pluginManager)
    this.pluginManager.attachApp(app)
    return app
  }

  setActivePlugin(pluginId: string | undefined): void {
    this.components.setActiveOwner(pluginId)
    this.systems.setActiveOwner(pluginId)
    this.resources.setActiveOwner(pluginId)
    this.assets.setActiveOwner(pluginId)
  }
}
