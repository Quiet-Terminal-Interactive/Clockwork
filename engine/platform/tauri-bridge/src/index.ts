export const packageId = '@clockwork/tauri-bridge'

/** Cross-platform file API used by engine systems. */
export interface FileSystem {
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array): Promise<void>
  listDir(path: string): Promise<string[]>
  watch(path: string, callback: () => void): () => void
}

/** Runtime window controls exposed to platform-agnostic code. */
export interface Window {
  getSize(): { width: number; height: number }
  setSize(width: number, height: number): void
  setTitle(title: string): void
  isFullscreen(): boolean
  setFullscreen(enabled: boolean): void
  close(): void
}

/** Input event source contract for platform adapters. */
export interface InputSource<TEvent = unknown> {
  subscribe(callback: (event: TEvent) => void): () => void
}

/** High-resolution clock provider. */
export interface TimeSource {
  now(): number
}

/** In-memory file system for tests and headless runtime. */
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

/** Browser-backed file adapter for fetch-based reads. */
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

/** No-op window implementation for tests and headless mode. */
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

/** Browser window adapter around DOM APIs. */
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

/** Monotonic-ish clock with performance fallback to Date. */
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
