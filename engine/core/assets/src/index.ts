export const packageId = '@clockwork/assets'

export type AssetId = string

export interface AssetSource {
  fetch(url: string): Promise<ArrayBuffer>
  readFile(path: string): Promise<Uint8Array>
  watch?(path: string, callback: () => void): () => void
}

export interface AssetLoader<T> {
  extensions: string[]
  load(path: string, source: AssetSource): Promise<T>
  unload?(asset: T): void
}

interface LoaderContext {
  dependOn(id: AssetId): void
  loadDependency<T>(id: AssetId): Handle<T>
}

interface AssetEntry {
  id: AssetId
  version: number
  asset?: unknown
  error?: unknown
  inFlight?: Promise<void>
  watchStop?: () => void
  dependencies: Set<AssetId>
  dependents: Set<AssetId>
}

export class Handle<T> {
  constructor(
    readonly id: AssetId,
    readonly version: number,
    private readonly resolve: (handle: Handle<T>) => T | undefined
  ) {}

  get(): T | undefined {
    return this.resolve(this)
  }

  isLoaded(): boolean {
    return this.get() !== undefined
  }
}

export interface AtlasAsset {
  texturePath?: string
  texture?: Handle<unknown>
  data: Record<string, unknown>
}

export class AssetCache {
  private readonly loaders = new Map<string, AssetLoader<unknown>>()
  private readonly entries = new Map<AssetId, AssetEntry>()

  constructor(private readonly source: AssetSource) {}

  registerLoader<T>(loader: AssetLoader<T>): void {
    for (const extension of loader.extensions) {
      this.loaders.set(this.normalizeExtension(extension), loader)
    }
  }

  load<T>(id: AssetId): Handle<T> {
    const entry = this.getOrCreateEntry(id)
    if (!entry.asset && !entry.inFlight) {
      this.startLoading(entry)
    }

    return new Handle<T>(id, entry.version, (handle) => this.get(handle))
  }

  get<T>(handle: Handle<T>): T | undefined {
    const entry = this.entries.get(handle.id)
    if (!entry || entry.version !== handle.version || entry.error) {
      return undefined
    }
    return entry.asset as T | undefined
  }

  async waitFor<T>(handle: Handle<T>): Promise<T> {
    const entry = this.entries.get(handle.id)
    if (!entry) {
      throw new Error(`Unknown asset "${handle.id}"`)
    }

    if (entry.inFlight) {
      await entry.inFlight
    }

    const asset = this.get(handle)
    if (asset === undefined) {
      throw new Error(`Asset "${handle.id}" is unavailable for this handle`)
    }
    return asset
  }

  unload(id: AssetId): void {
    const entry = this.entries.get(id)
    if (!entry) {
      return
    }

    entry.inFlight = undefined
    entry.error = undefined
    entry.watchStop?.()
    entry.watchStop = undefined
    this.unlinkDependencies(entry)
    this.disposeAsset(entry)
    this.entries.delete(id)
  }

  async reload(id: AssetId): Promise<void> {
    await this.reloadInternal(id, new Set<AssetId>())
  }

  private async reloadInternal(id: AssetId, visited: Set<AssetId>): Promise<void> {
    if (visited.has(id)) {
      return
    }
    visited.add(id)

    const entry = this.entries.get(id)
    if (!entry) {
      return
    }

    if (entry.inFlight) {
      await entry.inFlight
    }

    this.disposeAsset(entry)
    this.unlinkDependencies(entry)
    entry.asset = undefined
    entry.error = undefined
    entry.version += 1

    this.startLoading(entry)
    if (entry.inFlight) {
      await entry.inFlight
    }

    const dependents = [...entry.dependents]
    for (const dependent of dependents) {
      await this.reloadInternal(dependent, visited)
    }
  }

  private startLoading(entry: AssetEntry): void {
    const loader = this.getLoader(entry.id)
    const ctx: LoaderContext = {
      dependOn: (dependencyId) => {
        const dependency = this.getOrCreateEntry(dependencyId)
        entry.dependencies.add(dependencyId)
        dependency.dependents.add(entry.id)
      },
      loadDependency: <T>(dependencyId: AssetId): Handle<T> => {
        ctx.dependOn(dependencyId)
        return this.load<T>(dependencyId)
      }
    }

    entry.inFlight = (async () => {
      const loaded = await (loader.load as (
        path: string,
        source: AssetSource,
        context?: LoaderContext
      ) => Promise<unknown>)(entry.id, this.source, ctx)
      entry.asset = loaded
      entry.error = undefined
      if (!entry.watchStop && this.source.watch) {
        entry.watchStop = this.source.watch(entry.id, () => {
          void this.reload(entry.id)
        })
      }
    })()
      .catch((error: unknown) => {
        entry.asset = undefined
        entry.error = error
      })
      .finally(() => {
        entry.inFlight = undefined
      })
  }

  private getLoader(id: AssetId): AssetLoader<unknown> {
    let match: AssetLoader<unknown> | undefined
    let longest = -1

    for (const [extension, loader] of this.loaders.entries()) {
      if (id.toLowerCase().endsWith(extension) && extension.length > longest) {
        match = loader
        longest = extension.length
      }
    }

    if (!match) {
      throw new Error(`No asset loader registered for "${id}"`)
    }
    return match
  }

  private getOrCreateEntry(id: AssetId): AssetEntry {
    let entry = this.entries.get(id)
    if (!entry) {
      entry = {
        id,
        version: 1,
        dependencies: new Set<AssetId>(),
        dependents: new Set<AssetId>()
      }
      this.entries.set(id, entry)
    }
    return entry
  }

  private unlinkDependencies(entry: AssetEntry): void {
    for (const dependencyId of entry.dependencies) {
      const dependency = this.entries.get(dependencyId)
      dependency?.dependents.delete(entry.id)
    }
    entry.dependencies.clear()
  }

  private disposeAsset(entry: AssetEntry): void {
    if (entry.asset === undefined) {
      return
    }

    const loader = this.getLoader(entry.id)
    if (loader.unload) {
      loader.unload(entry.asset)
    }
    entry.asset = undefined
  }

  private normalizeExtension(extension: string): string {
    const trimmed = extension.trim().toLowerCase()
    if (!trimmed.startsWith('.')) {
      return `.${trimmed}`
    }
    return trimmed
  }
}

export class TextureLoader implements AssetLoader<Uint8Array> {
  readonly extensions = ['.png', '.jpg', '.jpeg', '.webp']

  async load(path: string, source: AssetSource): Promise<Uint8Array> {
    return source.readFile(path)
  }
}

export class AtlasLoader implements AssetLoader<AtlasAsset> {
  readonly extensions = ['.atlas.json']
  private readonly decoder = new TextDecoder()

  async load(
    path: string,
    source: AssetSource,
    context?: LoaderContext
  ): Promise<AtlasAsset> {
    const bytes = await source.readFile(path)
    const data = JSON.parse(this.decoder.decode(bytes)) as Record<string, unknown>
    const texturePath = this.extractTexturePath(data, path)
    if (!texturePath || !context) {
      return { data, texturePath }
    }

    const texture = context.loadDependency(texturePath)
    return { data, texturePath, texture }
  }

  private extractTexturePath(
    data: Record<string, unknown>,
    atlasPath: string
  ): string | undefined {
    const direct = data.texture
    if (typeof direct === 'string') {
      return this.resolveSibling(atlasPath, direct)
    }

    const meta = data.meta
    if (meta && typeof meta === 'object') {
      const image = (meta as { image?: unknown }).image
      if (typeof image === 'string') {
        return this.resolveSibling(atlasPath, image)
      }
    }

    const normalized = atlasPath.replaceAll('\\', '/')
    const sibling = normalized.replace(/\.atlas\.json$/i, '.png')
    return sibling
  }

  private resolveSibling(path: string, sibling: string): string {
    const normalized = path.replaceAll('\\', '/')
    const separator = normalized.lastIndexOf('/')
    if (separator === -1) {
      return sibling
    }
    return `${normalized.slice(0, separator + 1)}${sibling}`
  }
}

export class AudioLoader implements AssetLoader<Uint8Array> {
  readonly extensions = ['.mp3', '.ogg', '.wav']

  async load(path: string, source: AssetSource): Promise<Uint8Array> {
    return source.readFile(path)
  }
}

export class FontLoader implements AssetLoader<Uint8Array> {
  readonly extensions = ['.ttf', '.otf']

  async load(path: string, source: AssetSource): Promise<Uint8Array> {
    return source.readFile(path)
  }
}

export class ShaderLoader implements AssetLoader<string> {
  readonly extensions = ['.vert', '.frag']
  private readonly decoder = new TextDecoder()

  async load(path: string, source: AssetSource): Promise<string> {
    const bytes = await source.readFile(path)
    return this.decoder.decode(bytes)
  }
}

export class JsonLoader implements AssetLoader<unknown> {
  readonly extensions = ['.json']
  private readonly decoder = new TextDecoder()

  async load(path: string, source: AssetSource): Promise<unknown> {
    const bytes = await source.readFile(path)
    return JSON.parse(this.decoder.decode(bytes))
  }
}

export class BinaryLoader implements AssetLoader<Uint8Array> {
  readonly extensions = ['.bin']

  async load(path: string, source: AssetSource): Promise<Uint8Array> {
    return source.readFile(path)
  }
}
