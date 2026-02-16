import { describe, expect, it } from 'vitest'
import {
  AssetCache,
  AtlasLoader,
  BinaryLoader,
  JsonLoader,
  TextureLoader,
  packageId,
  type AssetSource
} from './index'

class MemoryAssetSource implements AssetSource {
  private readonly watchers = new Map<string, Set<() => void>>()

  constructor(private readonly files: Record<string, Uint8Array>) {}

  async fetch(url: string): Promise<ArrayBuffer> {
    const data = await this.readFile(url)
    return data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength
    ) as ArrayBuffer
  }

  async readFile(path: string): Promise<Uint8Array> {
    const value = this.files[path]
    if (!value) {
      throw new Error(`Missing file "${path}"`)
    }
    return value
  }

  watch(path: string, callback: () => void): () => void {
    let set = this.watchers.get(path)
    if (!set) {
      set = new Set<() => void>()
      this.watchers.set(path, set)
    }
    set.add(callback)
    return () => {
      set.delete(callback)
      if (set.size === 0) {
        this.watchers.delete(path)
      }
    }
  }

  write(path: string, value: Uint8Array): void {
    this.files[path] = value
  }

  trigger(path: string): void {
    for (const callback of this.watchers.get(path) ?? []) {
      callback()
    }
  }
}

function bytes(value: string): Uint8Array {
  return new TextEncoder().encode(value)
}

describe('assets package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('@clockwork/assets')
  })
})

describe('concurrent loading', () => {
  it('loads 100 assets concurrently', async () => {
    const files: Record<string, Uint8Array> = {}
    for (let i = 0; i < 100; i += 1) {
      files[`blob-${i}.bin`] = Uint8Array.of(i)
    }

    const source = new MemoryAssetSource(files)
    const cache = new AssetCache(source)
    cache.registerLoader(new BinaryLoader())

    const handles = Array.from({ length: 100 }, (_, i) =>
      cache.load<Uint8Array>(`blob-${i}.bin`)
    )
    const values = await Promise.all(
      handles.map((handle) => cache.waitFor(handle))
    )

    expect(values).toHaveLength(100)
    expect(values[42]![0]).toBe(42)
  })
})

describe('handle validity', () => {
  it('invalidates older handles after reload version bump', async () => {
    const source = new MemoryAssetSource({
      'settings.json': bytes('{"v":1}')
    })
    const cache = new AssetCache(source)
    cache.registerLoader(new JsonLoader())

    const first = cache.load<{ v: number }>('settings.json')
    await cache.waitFor(first)

    source.write('settings.json', bytes('{"v":2}'))
    await cache.reload('settings.json')

    const second = cache.load<{ v: number }>('settings.json')
    await cache.waitFor(second)

    expect(first.version).toBe(1)
    expect(second.version).toBe(2)
    expect(first.get()).toBeUndefined()
    expect(second.get()).toEqual({ v: 2 })
  })
})

describe('dependency tracking and hot reload', () => {
  it('reloads dependent atlas when texture changes', async () => {
    const source = new MemoryAssetSource({
      'sprites/atlas.atlas.json': bytes(
        JSON.stringify({ texture: 'player.png', frameCount: 1 })
      ),
      'sprites/player.png': Uint8Array.of(1, 2, 3)
    })
    const cache = new AssetCache(source)
    cache.registerLoader(new TextureLoader())
    cache.registerLoader(new AtlasLoader())

    const atlasHandleV1 = cache.load<{
      texturePath?: string
      data: { frameCount: number }
    }>('sprites/atlas.atlas.json')
    await cache.waitFor(atlasHandleV1)

    source.write('sprites/player.png', Uint8Array.of(9, 9, 9))
    source.trigger('sprites/player.png')
    await new Promise((resolve) => setTimeout(resolve, 0))

    const atlasHandleV2 = cache.load<{
      texturePath?: string
      data: { frameCount: number }
    }>('sprites/atlas.atlas.json')
    await cache.waitFor(atlasHandleV2)

    expect(atlasHandleV2.version).toBe(2)
    expect(atlasHandleV1.get()).toBeUndefined()
    expect(atlasHandleV2.get()?.texturePath).toBe('sprites/player.png')
  })

  it('rejects atlas texture traversal paths', async () => {
    const source = new MemoryAssetSource({
      'sprites/atlas.atlas.json': bytes(
        JSON.stringify({ texture: '../../x.png' })
      )
    })
    const cache = new AssetCache(source)
    cache.registerLoader(new AtlasLoader())

    const handle = cache.load('sprites/atlas.atlas.json')
    await expect(cache.waitFor(handle)).rejects.toThrow('traversal')
  })
})

describe('unload behavior', () => {
  it('unloads asset and keeps stale handles invalid', async () => {
    const source = new MemoryAssetSource({
      'config.json': bytes('{"ok":true}')
    })
    const cache = new AssetCache(source)
    cache.registerLoader(new JsonLoader())

    const handle = cache.load<{ ok: boolean }>('config.json')
    await cache.waitFor(handle)
    expect(handle.isLoaded()).toBe(true)

    cache.unload('config.json')
    expect(handle.get()).toBeUndefined()

    const reloaded = cache.load<{ ok: boolean }>('config.json')
    await cache.waitFor(reloaded)
    expect(reloaded.version).toBe(1)
    expect(reloaded.get()).toEqual({ ok: true })
  })

  it('propagates loader errors through waitFor', async () => {
    const source = new MemoryAssetSource({})
    const cache = new AssetCache(source)
    cache.registerLoader(new JsonLoader())

    const handle = cache.load<unknown>('missing.json')
    await expect(cache.waitFor(handle)).rejects.toThrow('failed to load')
  })

  it('disposes stale in-flight load results when unloaded mid-load', async () => {
    const source = new MemoryAssetSource({ 'slow.bin': Uint8Array.of(1) })
    const cache = new AssetCache(source)

    let resolveLoad: (() => void) | undefined
    let unloadCalls = 0
    cache.registerLoader({
      extensions: ['.bin'],
      async load() {
        await new Promise<void>((resolve) => {
          resolveLoad = resolve
        })
        return { ok: true }
      },
      unload() {
        unloadCalls += 1
      }
    })

    const handle = cache.load<{ ok: boolean }>('slow.bin')
    await new Promise((resolve) => setTimeout(resolve, 0))
    cache.unload('slow.bin')
    resolveLoad?.()
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(handle.get()).toBeUndefined()
    expect(unloadCalls).toBeLessThanOrEqual(1)
  })

  it('rejects unsafe asset id traversal before loading', () => {
    const cache = new AssetCache(new MemoryAssetSource({}))
    cache.registerLoader(new JsonLoader())
    expect(() => cache.load('../secrets.json')).toThrow('traversal')
  })
})
