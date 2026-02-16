import {
  ConsoleLogger,
  defaultRuntimeConfig,
  type FileSystem,
  type LogLevel,
  type LogMetadata,
  type Logger,
  type RuntimeConfig
} from 'qti-clockwork-app'

export {
  ConsoleLogger,
  defaultRuntimeConfig,
  type FileSystem,
  type LogLevel,
  type LogMetadata,
  type Logger,
  type RuntimeConfig
}

export const packageId = 'qti-clockwork-tauri-bridge'

/** Fan-out logger for composing multiple sinks. */
export class CompositeLogger implements Logger {
  constructor(private readonly sinks: readonly Logger[]) {}

  debug(message: string, metadata?: LogMetadata): void {
    for (const sink of this.sinks) {
      sink.debug(message, metadata)
    }
  }

  info(message: string, metadata?: LogMetadata): void {
    for (const sink of this.sinks) {
      sink.info(message, metadata)
    }
  }

  warn(message: string, metadata?: LogMetadata): void {
    for (const sink of this.sinks) {
      sink.warn(message, metadata)
    }
  }

  error(message: string, metadata?: LogMetadata): void {
    for (const sink of this.sinks) {
      sink.error(message, metadata)
    }
  }
}
export interface Window {
  getSize(): { width: number; height: number }
  setSize(width: number, height: number): void
  setTitle(title: string): void
  isFullscreen(): boolean
  setFullscreen(enabled: boolean): void
  close(): void
}
export interface InputSource<TEvent = unknown> {
  subscribe(callback: (event: TEvent) => void): () => void
}
export interface TimeSource {
  now(): number
}
export class MemoryFileSystem implements FileSystem {
  private readonly files = new Map<string, Uint8Array>()
  private readonly watchers = new Map<string, Set<() => void>>()

  constructor(seed?: Record<string, Uint8Array>) {
    for (const [path, bytes] of Object.entries(seed ?? {})) {
      this.files.set(this.normalize(path), bytes.slice())
    }
  }

  async readFile(path: string): Promise<Uint8Array> {
    const key = this.normalize(path)
    const bytes = this.files.get(key)
    if (!bytes) {
      throw new Error(`File not found: ${path}`)
    }
    return bytes.slice()
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const key = this.normalize(path)
    this.files.set(key, data.slice())
    this.emit(key)
  }

  async listDir(path: string): Promise<string[]> {
    const prefix = this.normalize(path).replace(/\/$/, '')
    const withSlash = prefix.length === 0 ? '' : `${prefix}/`

    const names = new Set<string>()
    for (const key of this.files.keys()) {
      if (!key.startsWith(withSlash)) {
        continue
      }

      const remainder = key.slice(withSlash.length)
      const nextSlash = remainder.indexOf('/')
      names.add(nextSlash === -1 ? remainder : remainder.slice(0, nextSlash))
    }

    return [...names].sort()
  }

  watch(path: string, callback: () => void): () => void {
    const key = this.normalize(path)
    let listeners = this.watchers.get(key)
    if (!listeners) {
      listeners = new Set<() => void>()
      this.watchers.set(key, listeners)
    }

    listeners.add(callback)

    return () => {
      const current = this.watchers.get(key)
      if (!current) {
        return
      }
      current.delete(callback)
      if (current.size === 0) {
        this.watchers.delete(key)
      }
    }
  }

  private normalize(path: string): string {
    return path.replaceAll('\\', '/').replace(/^\.\//, '').replace(/\/+$/, '')
  }

  private emit(path: string): void {
    for (const callback of this.watchers.get(path) ?? []) {
      callback()
    }
  }
}
export class BrowserFileSystem implements FileSystem {
  constructor(
    private readonly baseUrl = '',
    private readonly writer?: (path: string, data: Uint8Array) => Promise<void>,
    private readonly lister?: (path: string) => Promise<string[]>,
    private readonly watcher?: (
      path: string,
      callback: () => void
    ) => () => void
  ) {}

  async readFile(path: string): Promise<Uint8Array> {
    const response = await fetch(this.resolve(path))
    if (!response.ok) {
      throw new Error(`Failed to read file "${path}" (${response.status})`)
    }
    return new Uint8Array(await response.arrayBuffer())
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    if (!this.writer) {
      throw new Error(
        `writeFile is not available for "${path}" on this platform`
      )
    }
    await this.writer(path, data)
  }

  async listDir(path: string): Promise<string[]> {
    if (!this.lister) {
      throw new Error(`listDir is not available for "${path}" on this platform`)
    }
    return this.lister(path)
  }

  watch(path: string, callback: () => void): () => void {
    if (!this.watcher) {
      return () => {
        void path
        void callback
      }
    }
    return this.watcher(path, callback)
  }

  private resolve(path: string): string {
    if (this.baseUrl.length === 0) {
      return path
    }

    const base = this.baseUrl.replace(/\/+$/, '')
    const suffix = path.replace(/^\/+/, '')
    return `${base}/${suffix}`
  }
}
export class HeadlessWindow implements Window {
  private width: number
  private height: number
  private title = 'Clockwork'
  private fullscreen = false
  private closed = false

  constructor(size = { width: 1280, height: 720 }) {
    this.width = size.width
    this.height = size.height
  }

  getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height }
  }

  setSize(width: number, height: number): void {
    this.width = Math.max(1, Math.floor(width))
    this.height = Math.max(1, Math.floor(height))
  }

  setTitle(title: string): void {
    this.title = title
  }

  isFullscreen(): boolean {
    return this.fullscreen
  }

  setFullscreen(enabled: boolean): void {
    this.fullscreen = enabled
  }

  close(): void {
    this.closed = true
  }

  isClosed(): boolean {
    return this.closed
  }

  getTitle(): string {
    return this.title
  }
}
export class BrowserWindowAdapter implements Window {
  constructor(private readonly win: globalThis.Window) {}

  getSize(): { width: number; height: number } {
    return { width: this.win.innerWidth, height: this.win.innerHeight }
  }

  setSize(width: number, height: number): void {
    this.win.resizeTo(width, height)
  }

  setTitle(title: string): void {
    this.win.document.title = title
  }

  isFullscreen(): boolean {
    return this.win.document.fullscreenElement !== null
  }

  setFullscreen(enabled: boolean): void {
    if (enabled) {
      void this.win.document.documentElement.requestFullscreen()
      return
    }
    if (this.win.document.fullscreenElement) {
      void this.win.document.exitFullscreen()
    }
  }

  close(): void {
    this.win.close()
  }
}
export class SystemTimeSource implements TimeSource {
  now(): number {
    if (
      typeof performance !== 'undefined' &&
      typeof performance.now === 'function'
    ) {
      return performance.now()
    }
    return Date.now()
  }
}

export interface TauriInvoker {
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>
}
export class TauriFileSystem implements FileSystem {
  private readonly watchIntervalMs = 1000

  constructor(
    private readonly tauri: TauriInvoker,
    private readonly logger: Logger = new CrashReportingLogger(
      new TauriCrashLogger(tauri),
      new ConsoleLogger()
    )
  ) {}

  async readFile(path: string): Promise<Uint8Array> {
    assertNonEmptyPath(path)
    try {
      const bytes = await this.tauri.invoke<unknown>('read_file', { path })
      return toByteArray(bytes, path)
    } catch (error) {
      this.logger.error('read_file failed', {
        path,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    assertNonEmptyPath(path)
    try {
      await this.tauri.invoke('write_file', { path, data: [...data] })
    } catch (error) {
      this.logger.error('write_file failed', {
        path,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  async listDir(path: string): Promise<string[]> {
    assertNonEmptyPath(path)
    try {
      const entries = await this.tauri.invoke<unknown>('list_dir', { path })
      if (
        !Array.isArray(entries) ||
        entries.some((item) => typeof item !== 'string')
      ) {
        throw new Error(`list_dir returned invalid payload for "${path}"`)
      }
      return entries
    } catch (error) {
      this.logger.error('list_dir failed', {
        path,
        error: error instanceof Error ? error.message : String(error)
      })
      throw error
    }
  }

  watch(path: string, callback: () => void): () => void {
    assertNonEmptyPath(path)
    let active = true

    // Native watch APIs are inconsistent across targets, so polling is the cross-platform fallback.
    const tick = async (): Promise<void> => {
      if (!active) {
        return
      }
      try {
        const changed = await this.tauri.invoke<unknown>('watch_ping', { path })
        if (changed === true) {
          callback()
        }
      } catch (error) {
        // Bridge hiccups are expected - keep polling unless explicitly unsubscribed.
        this.logger.warn('watch_ping failed', {
          path,
          error: error instanceof Error ? error.message : String(error)
        })
      } finally {
        if (active) {
          setTimeout(() => void tick(), this.watchIntervalMs)
        }
      }
    }

    void tick()

    return () => {
      active = false
    }
  }
}

export interface TauriWindowApi {
  setSize(width: number, height: number): Promise<void> | void
  setTitle(title: string): Promise<void> | void
  isFullscreen(): Promise<boolean> | boolean
  setFullscreen(enabled: boolean): Promise<void> | void
  close(): Promise<void> | void
  innerSize():
    | Promise<{ width: number; height: number }>
    | { width: number; height: number }
}
export class TauriWindowAdapter implements Window {
  private size = { width: 1280, height: 720 }
  private fullscreen = false

  constructor(private readonly api: TauriWindowApi) {}

  getSize(): { width: number; height: number } {
    return this.size
  }

  setSize(width: number, height: number): void {
    this.size = { width, height }
    void this.api.setSize(width, height)
  }

  setTitle(title: string): void {
    void this.api.setTitle(title)
  }

  isFullscreen(): boolean {
    return this.fullscreen
  }

  setFullscreen(enabled: boolean): void {
    this.fullscreen = enabled
    void this.api.setFullscreen(enabled)
  }

  close(): void {
    void this.api.close()
  }

  async refreshSize(): Promise<void> {
    const size = await this.api.innerSize()
    this.size = {
      width: Math.max(1, Math.floor(size.width)),
      height: Math.max(1, Math.floor(size.height))
    }
  }

  async refreshFullscreen(): Promise<void> {
    this.fullscreen = await this.api.isFullscreen()
  }
}

function assertNonEmptyPath(path: string): void {
  if (typeof path !== 'string' || path.trim().length === 0) {
    throw new Error('Path must be a non-empty string')
  }
}

function toByteArray(bytes: unknown, path: string): Uint8Array {
  if (!Array.isArray(bytes)) {
    throw new Error(`read_file returned invalid payload for "${path}"`)
  }

  const out = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i += 1) {
    const value = bytes[i]
    if (!Number.isInteger(value) || value < 0 || value > 255) {
      throw new Error(`read_file returned invalid byte payload for "${path}"`)
    }
    out[i] = value
  }
  return out
}

export interface PathProvider {
  appDataDir(): Promise<string>
}

export class TauriPathProvider implements PathProvider {
  constructor(private readonly tauri: TauriInvoker) {}

  async appDataDir(): Promise<string> {
    return this.tauri.invoke<string>('app_data_dir')
  }
}

export interface CrashLogger {
  log(error: unknown, metadata?: Record<string, unknown>): Promise<void>
}

export class TauriCrashLogger implements CrashLogger {
  constructor(private readonly tauri: TauriInvoker) {}

  async log(error: unknown, metadata?: Record<string, unknown>): Promise<void> {
    await this.tauri.invoke('log_crash', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      metadata
    })
  }
}

/** Logger sink that forwards error-level events to crash telemetry. */
export class CrashReportingLogger implements Logger {
  private consecutiveFailures = 0
  private static readonly MAX_SILENT_FAILURES = 3

  constructor(
    private readonly crashLogger: CrashLogger,
    private readonly fallback: Logger = new ConsoleLogger()
  ) {}

  debug(message: string, metadata?: LogMetadata): void {
    this.fallback.debug(message, metadata)
  }

  info(message: string, metadata?: LogMetadata): void {
    this.fallback.info(message, metadata)
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.fallback.warn(message, metadata)
  }

  error(message: string, metadata?: LogMetadata): void {
    this.fallback.error(message, metadata)
    // Crash telemetry should not crash the app while trying to report a crash.
    void this.crashLogger
      .log(message, metadata)
      .then(() => {
        this.consecutiveFailures = 0
      })
      .catch((error) => {
        this.consecutiveFailures += 1
        const level =
          this.consecutiveFailures >= CrashReportingLogger.MAX_SILENT_FAILURES
            ? 'error'
            : 'warn'
        this.fallback[level]('Crash telemetry submission failed', {
          error: error instanceof Error ? error.message : String(error),
          consecutiveFailures: this.consecutiveFailures
        })
      })
  }
}

export interface ConfigEnvironment {
  readonly [key: string]: string | undefined
}

/** Environment + file driven runtime config parser. */
export class RuntimeConfigLoader {
  private readonly decoder = new TextDecoder()

  constructor(
    private readonly fs: FileSystem,
    private readonly env: ConfigEnvironment = getProcessEnv()
  ) {}

  async loadFromFile(path: string): Promise<Partial<RuntimeConfig>> {
    const bytes = await this.fs.readFile(path)
    const parsed = parseJsonRecord(this.decoder.decode(bytes), path)
    return parseRuntimeConfig(parsed, path)
  }

  loadFromEnv(prefix = 'CLOCKWORK_'): Partial<RuntimeConfig> {
    const toKey = (key: string): string => `${prefix}${key}`
    const out: Partial<RuntimeConfig> = {}

    const modRoot = this.env[toKey('MOD_ROOT')]
    if (modRoot !== undefined) {
      assertSafeConfigPath(modRoot, 'MOD_ROOT', 'environment')
      out.modRoot = modRoot
    }

    const assetRoot = this.env[toKey('ASSET_ROOT')]
    if (assetRoot !== undefined) {
      assertSafeConfigPath(assetRoot, 'ASSET_ROOT', 'environment')
      out.assetRoot = assetRoot
    }

    const logLevel = this.env[toKey('LOG_LEVEL')]
    if (isLogLevel(logLevel)) {
      out.logLevel = logLevel
    }

    const crash = this.env[toKey('ENABLE_CRASH_REPORTING')]
    if (crash !== undefined) {
      out.enableCrashReporting = crash === '1' || crash.toLowerCase() === 'true'
    }

    return out
  }

  merge(...sources: Array<Partial<RuntimeConfig> | undefined>): RuntimeConfig {
    return Object.freeze(
      Object.assign(
        {},
        defaultRuntimeConfig,
        ...sources.filter(
          (source): source is Partial<RuntimeConfig> => source !== undefined
        )
      )
    )
  }
}

function parseJsonRecord(raw: string, path: string): Record<string, unknown> {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Failed to parse config file "${path}": ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Config file "${path}" must be a JSON object`)
  }
  return parsed as Record<string, unknown>
}

function assertSafeConfigPath(
  value: string,
  field: string,
  source: string
): void {
  const normalized = value.replaceAll('\\', '/')
  if (normalized.split('/').some((segment) => segment === '..')) {
    throw new Error(
      `Config ${source} "${field}" contains path traversal ("${value}")`
    )
  }
}

function parseRuntimeConfig(
  parsed: Record<string, unknown>,
  path: string
): Partial<RuntimeConfig> {
  const out: Partial<RuntimeConfig> = {}

  const modRoot = parsed.modRoot
  if (modRoot !== undefined) {
    if (typeof modRoot !== 'string' || modRoot.trim().length === 0) {
      throw new Error(`Config "${path}" has invalid "modRoot"`)
    }
    assertSafeConfigPath(modRoot, 'modRoot', `"${path}"`)
    out.modRoot = modRoot
  }

  const assetRoot = parsed.assetRoot
  if (assetRoot !== undefined) {
    if (typeof assetRoot !== 'string' || assetRoot.trim().length === 0) {
      throw new Error(`Config "${path}" has invalid "assetRoot"`)
    }
    assertSafeConfigPath(assetRoot, 'assetRoot', `"${path}"`)
    out.assetRoot = assetRoot
  }

  const logLevel = parsed.logLevel
  if (logLevel !== undefined) {
    if (!isLogLevel(logLevel)) {
      throw new Error(`Config "${path}" has invalid "logLevel"`)
    }
    out.logLevel = logLevel
  }

  const enableCrashReporting = parsed.enableCrashReporting
  if (enableCrashReporting !== undefined) {
    if (typeof enableCrashReporting !== 'boolean') {
      throw new Error(`Config "${path}" has invalid "enableCrashReporting"`)
    }
    out.enableCrashReporting = enableCrashReporting
  }

  return out
}

function isLogLevel(value: unknown): value is LogLevel {
  return (
    value === 'debug' ||
    value === 'info' ||
    value === 'warn' ||
    value === 'error'
  )
}

function getProcessEnv(): ConfigEnvironment {
  const processLike = (globalThis as { process?: { env?: ConfigEnvironment } })
    .process
  if (!processLike?.env) {
    return {}
  }
  return processLike.env
}

