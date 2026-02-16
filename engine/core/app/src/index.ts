import { type ComponentSchema, type ResourceToken, World } from '@clockwork/ecs'
import { EventBus } from '@clockwork/events'
import { Profiler, Scheduler, type System } from '@clockwork/scheduler'

export const packageId = '@clockwork/app'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogMetadata {
  readonly [key: string]: unknown
}

/** Structured logging contract shared across runtime modules. */
export interface Logger {
  debug(message: string, metadata?: LogMetadata): void
  info(message: string, metadata?: LogMetadata): void
  warn(message: string, metadata?: LogMetadata): void
  error(message: string, metadata?: LogMetadata): void
}

/** Console-backed logger with level filtering. */
export class ConsoleLogger implements Logger {
  private static readonly order: Record<LogLevel, number> = {
    debug: 10,
    info: 20,
    warn: 30,
    error: 40
  }

  constructor(
    private readonly minLevel: LogLevel = 'info',
    private readonly sink: Pick<
      Console,
      'debug' | 'info' | 'warn' | 'error'
    > = console
  ) {}

  debug(message: string, metadata?: LogMetadata): void {
    this.write('debug', message, metadata)
  }

  info(message: string, metadata?: LogMetadata): void {
    this.write('info', message, metadata)
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.write('warn', message, metadata)
  }

  error(message: string, metadata?: LogMetadata): void {
    this.write('error', message, metadata)
  }

  private write(
    level: LogLevel,
    message: string,
    metadata: LogMetadata | undefined
  ): void {
    if (ConsoleLogger.order[level] < ConsoleLogger.order[this.minLevel]) {
      return
    }

    const payload = metadata ? [message, metadata] : [message]
    this.sink[level](...payload)
  }
}

export interface FileSystem {
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array): Promise<void>
  listDir(path: string): Promise<string[]>
  watch(path: string, callback: () => void): () => void
}

export interface RuntimeConfig {
  modRoot: string
  assetRoot: string
  logLevel: LogLevel
  enableCrashReporting: boolean
}

export const defaultRuntimeConfig: RuntimeConfig = {
  modRoot: 'mods',
  assetRoot: 'assets',
  logLevel: 'info',
  enableCrashReporting: false
}

export type RegistryType<T = unknown> =
  | string
  | symbol
  | (new (...args: unknown[]) => T)
export interface Plugin {
  id: string
  version: string
  depends?: string[]
  init(app: AppBuilder): void
  shutdown?(app: App): void
  reload?(): void
}
/** Plugin-scoped component schema store with ownership enforcement. */
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
/** Dependency-ordered plugin lifecycle manager with isolated reload support. */
export class PluginManager {
  private readonly plugins = new Map<string, Plugin>()
  private initializedIds: string[] = []
  private app?: App

  constructor(private readonly logger: Logger = new ConsoleLogger()) {}

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
    } catch (error) {
      // Reload failures stay isolated so one bad mod does not sink the whole runtime.
      this.logger.error(`Plugin "${pluginId}" reload failed`, {
        error: error instanceof Error ? error.message : String(error)
      })
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
/** Assembled runtime owning the world, scheduler, and plugin graph. */
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
/** Fluent configuration surface for registering plugins, systems, and resources before build. */
export class AppBuilder {
  readonly components = new ComponentRegistry()
  readonly systems = new SystemRegistry()
  readonly resources = new ResourceRegistry()
  readonly assets = new AssetRegistry()

  private readonly pluginManager: PluginManager

  constructor(logger: Logger = new ConsoleLogger()) {
    this.pluginManager = new PluginManager(logger)
  }

  use(plugin: Plugin): this {
    this.pluginManager.register(plugin)
    return this
  }

  remove(pluginId: string): this {
    this.pluginManager.unregister(pluginId)
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

export interface Renderer {
  init(): void
  render(): void
  shutdown(): void
}
export class HeadlessRenderer implements Renderer {
  init(): void {}
  render(): void {}
  shutdown(): void {}
}

export const HeadlessRendererPlugin: Plugin = {
  id: 'headless-renderer',
  version: '1.0.0',
  init(app) {
    app.resources.insert('renderer', new HeadlessRenderer())
  }
}

export interface RuntimeStats {
  avgMs: number
  samples: number
  maxMs: number
  lastMs: number
}
export class WorldInspector {
  constructor(private readonly world: World) {}

  getEntityCount(): number {
    return this.world.entities.aliveCount
  }

  getComponentCounts(): Map<string, number> {
    const counts = new Map<string, number>()
    for (const [type, store] of this.world.components.entries()) {
      counts.set(normalizeTypeName(type), [...store.iter()].length)
    }
    return counts
  }

  dumpEntities(): Array<{
    entity: { index: number; generation: number }
    components: Record<string, unknown>
  }> {
    const result: Array<{
      entity: { index: number; generation: number }
      components: Record<string, unknown>
    }> = []

    for (const entity of this.world.entities.iterAlive()) {
      const components: Record<string, unknown> = {}
      for (const [type, store] of this.world.components.entries()) {
        const value = store.get(entity)
        if (value !== undefined) {
          components[normalizeTypeName(type)] = value
        }
      }
      result.push({ entity, components })
    }

    return result
  }
}
export class SystemInspector {
  constructor(
    private readonly scheduler: Scheduler,
    private readonly profiler: Profiler
  ) {}

  getStageOrder(): string[] {
    return [...this.scheduler.getStageOrder()]
  }

  getSystemRuntime(systemId: string): RuntimeStats | undefined {
    const timing = this.profiler.getTimings().get(systemId)
    if (!timing) {
      return undefined
    }
    return {
      avgMs: timing.totalMs / timing.samples,
      samples: timing.samples,
      maxMs: timing.maxMs,
      lastMs: timing.lastMs
    }
  }

  getAverageRuntime(systemId: string): number {
    return this.profiler.getAverageRuntime(systemId)
  }
}
export class AssetInspector {
  private readonly tracked = new Map<string, { bytes: number; refs: number }>()

  track(id: string, bytes: number): void {
    const current = this.tracked.get(id) ?? { bytes: 0, refs: 0 }
    current.bytes = bytes
    current.refs += 1
    this.tracked.set(id, current)
  }

  untrack(id: string): void {
    const current = this.tracked.get(id)
    if (!current) {
      return
    }
    current.refs -= 1
    if (current.refs <= 0) {
      this.tracked.delete(id)
    }
  }

  getMemoryUsage(): number {
    let total = 0
    for (const item of this.tracked.values()) {
      total += item.bytes
    }
    return total
  }

  dump(): Record<string, { bytes: number; refs: number }> {
    return Object.fromEntries(this.tracked)
  }
}
export class EngineInspector {
  readonly world: WorldInspector
  readonly systems: SystemInspector
  readonly assets: AssetInspector
  readonly profiler: Profiler

  constructor(
    app: App,
    profiler = new Profiler(),
    assets = new AssetInspector()
  ) {
    this.profiler = profiler
    this.assets = assets
    this.world = new WorldInspector(app.world)
    this.systems = new SystemInspector(app.scheduler, profiler)
  }
}

export type PluginFactory = () => Plugin

export class PluginCatalog {
  private readonly factories = new Map<string, PluginFactory>()

  register(name: string, factory: PluginFactory): void {
    this.factories.set(name, factory)
  }

  create(name: string): Plugin {
    const factory = this.factories.get(name)
    if (!factory) {
      throw new Error(`Unknown plugin factory "${name}"`)
    }
    return factory()
  }

  list(): string[] {
    return [...this.factories.keys()].sort()
  }
}

function createStubPlugin(id: string): Plugin {
  return {
    id,
    version: '0.1.0',
    init() {}
  }
}

export const PhysicsPlugin = (): Plugin => createStubPlugin('physics')
export const UIPlugin = (): Plugin => createStubPlugin('ui')
export const ParticlePlugin = (): Plugin => createStubPlugin('particle')
export const TilemapPlugin = (): Plugin => createStubPlugin('tilemap')
export const NetworkingPlugin = (): Plugin => createStubPlugin('networking')

export function createDefaultPluginCatalog(): PluginCatalog {
  const catalog = new PluginCatalog()
  catalog.register('physics', PhysicsPlugin)
  catalog.register('ui', UIPlugin)
  catalog.register('particle', ParticlePlugin)
  catalog.register('tilemap', TilemapPlugin)
  catalog.register('networking', NetworkingPlugin)
  return catalog
}

export interface ModManifest {
  id: string
  version: string
  entry?: string
  assets?: string[]
}

export interface Mod {
  id: string
  version: string
  assets: string[]
  init(app: AppBuilder): void
}
/** Discovers, loads, hot-reloads, and unloads user mods from the file system. */
export class ModManager {
  private readonly mods = new Map<string, Mod>()
  private readonly watchers = new Map<string, () => void>()
  private readonly decoder = new TextDecoder()
  private readonly logger: Logger
  private readonly runtimeConfig: RuntimeConfig

  constructor(
    private readonly fs: FileSystem,
    private readonly builder: AppBuilder,
    options?: { logger?: Logger; runtimeConfig?: Partial<RuntimeConfig> }
  ) {
    this.logger = options?.logger ?? new ConsoleLogger()
    this.runtimeConfig = {
      ...defaultRuntimeConfig,
      ...options?.runtimeConfig
    }
  }

  async discoverMods(path = this.runtimeConfig.modRoot): Promise<string[]> {
    return this.fs.listDir(path)
  }

  async loadMod(path: string): Promise<Mod> {
    const bytes = await this.fs.readFile(`${path}/mod.json`)
    const manifest = parseModManifest(this.decoder.decode(bytes), path)

    const mod: Mod = {
      id: manifest.id,
      version: manifest.version,
      assets: manifest.assets ?? [],
      init: () => {}
    }

    this.mods.set(mod.id, mod)
    this.builder.use({
      id: `mod:${mod.id}`,
      version: mod.version,
      init: (app) => mod.init(app)
    })
    return mod
  }

  unloadMod(modId: string): void {
    this.mods.delete(modId)
    this.builder.remove(`mod:${modId}`)
    this.watchers.get(modId)?.()
    this.watchers.delete(modId)
  }

  async reloadMod(modId: string, path: string): Promise<void> {
    this.unloadMod(modId)
    await this.loadMod(path)
  }

  watchMod(modId: string, path: string, onReload: () => void): void {
    this.watchers.get(modId)?.()
    const stop = this.fs.watch(path, () => {
      try {
        onReload()
      } catch (error) {
        this.logger.error(`Mod "${modId}" reload callback failed`, {
          path,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    })
    this.watchers.set(modId, stop)
  }

  getLoadedMods(): Mod[] {
    return [...this.mods.values()]
  }
}

function parseModManifest(raw: string, path: string): ModManifest {
  const manifestPath = `${path}/mod.json`
  const parsed = parseJsonObject(raw, manifestPath)

  const id = asNonEmptyString(parsed.id)
  if (!id) {
    throw new Error(
      `Mod manifest at "${path}/mod.json" must include string "id"`
    )
  }

  const version = asNonEmptyString(parsed.version)
  if (!version) {
    throw new Error(
      `Mod manifest at "${path}/mod.json" must include string "version"`
    )
  }

  if (parsed.entry !== undefined && typeof parsed.entry !== 'string') {
    throw new Error(
      `Mod manifest at "${path}/mod.json" has invalid optional "entry"`
    )
  }

  const assets = parseManifestAssets(parsed.assets, manifestPath)
  if (assets === null) {
    throw new Error(
      `Mod manifest at "${path}/mod.json" has invalid optional "assets"`
    )
  }

  const result: ModManifest = {
    id,
    version
  }
  if (parsed.entry !== undefined) {
    result.entry = parsed.entry
  }
  if (assets) {
    result.assets = assets
  }
  return result
}

function parseJsonObject(raw: string, path: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Failed to parse mod manifest at "${path}": ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid mod manifest at "${path}"`)
  }
  return parsed as Record<string, unknown>
}

function parseManifestAssets(
  value: unknown,
  manifestPath: string
): string[] | null | undefined {
  if (value === undefined) {
    return undefined
  }
  if (!Array.isArray(value)) {
    return null
  }

  const result: string[] = []
  for (const item of value) {
    if (typeof item !== 'string' || item.trim().length === 0) {
      return null
    }
    result.push(assertSafeRelativePath(item, manifestPath))
  }
  return result
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined
  }
  if (value.trim().length === 0) {
    return undefined
  }
  return value
}

function assertSafeRelativePath(path: string, manifestPath: string): string {
  const normalized = path.replaceAll('\\', '/')
  if (
    normalized.startsWith('/') ||
    /^[A-Za-z]:/.test(normalized) ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    throw new Error(
      `Mod manifest at "${manifestPath}" contains unsafe asset path "${path}"`
    )
  }
  return normalized
}

function normalizeTypeName(type: RegistryType<unknown>): string {
  if (typeof type === 'string') {
    return type
  }
  if (typeof type === 'symbol') {
    return type.description ?? 'symbol'
  }
  return type.name || 'anonymous'
}
