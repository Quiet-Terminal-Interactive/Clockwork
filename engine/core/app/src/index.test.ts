import { describe, expect, it } from 'vitest'
import {
  AppBuilder,
  createDefaultPluginCatalog,
  EngineInspector,
  HeadlessRendererPlugin,
  ModManager,
  PluginCatalog,
  type Plugin,
  packageId
} from './index'

describe('app package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('@clockwork/app')
  })
})

describe('PluginManager dependency resolution', () => {
  it('loads plugins in dependency order', () => {
    const initOrder: string[] = []
    const builder = new AppBuilder()

    const corePlugin: Plugin = {
      id: 'core',
      version: '1.0.0',
      init() {
        initOrder.push('core')
      }
    }

    const physicsPlugin: Plugin = {
      id: 'physics',
      version: '1.0.0',
      depends: ['core'],
      init() {
        initOrder.push('physics')
      }
    }

    builder.use(physicsPlugin).use(corePlugin).build()
    expect(initOrder).toEqual(['core', 'physics'])
  })

  it('rejects circular dependencies', () => {
    const builder = new AppBuilder()

    const a: Plugin = {
      id: 'a',
      version: '1.0.0',
      depends: ['b'],
      init() {}
    }
    const b: Plugin = {
      id: 'b',
      version: '1.0.0',
      depends: ['a'],
      init() {}
    }

    builder.use(a).use(b)
    expect(() => builder.build()).toThrow('Circular plugin dependency detected')
  })
})

describe('Plugin lifecycle', () => {
  it('hot reload does not crash app when plugin reload throws and logs error', () => {
    const logs: string[] = []
    const builder = new AppBuilder({
      debug() {},
      info() {},
      warn() {},
      error(message) {
        logs.push(message)
      }
    })
    const plugin: Plugin = {
      id: 'reloadable',
      version: '1.0.0',
      init() {},
      reload() {
        throw new Error('boom')
      }
    }

    const app = builder.use(plugin).build()
    expect(() => app.plugins.reload('reloadable')).not.toThrow()
    expect(logs.some((message) => message.includes('reload failed'))).toBe(true)
  })
})

describe('Plugin isolation', () => {
  it('prevents one plugin from overwriting another plugin resource key', () => {
    const shared = Symbol('shared-resource')
    const builder = new AppBuilder()

    const ownerA: Plugin = {
      id: 'owner-a',
      version: '1.0.0',
      init(app) {
        app.resources.insert(shared, { source: 'a' })
      }
    }

    const ownerB: Plugin = {
      id: 'owner-b',
      version: '1.0.0',
      init(app) {
        app.resources.insert(shared, { source: 'b' })
      }
    }

    builder.use(ownerA).use(ownerB)
    expect(() => builder.build()).toThrow('owned by plugin "owner-a"')
  })
})

describe('headless and inspection', () => {
  it('builds with headless renderer plugin', () => {
    const app = new AppBuilder().use(HeadlessRendererPlugin).build()
    expect(app.world.getResource('renderer')).toBeDefined()
  })

  it('exposes engine inspector metrics', () => {
    const app = new AppBuilder().build()
    const inspector = new EngineInspector(app)
    expect(inspector.world.getEntityCount()).toBe(0)
    expect(inspector.systems.getStageOrder().length).toBeGreaterThan(0)
  })
})

describe('plugin catalog and mods', () => {
  it('creates plugins from catalog factories', () => {
    const catalog = new PluginCatalog()
    catalog.register('sample', () => ({
      id: 'sample',
      version: '1.0.0',
      init() {}
    }))
    expect(catalog.create('sample').id).toBe('sample')
  })

  it('provides default plugin catalog entries', () => {
    const catalog = createDefaultPluginCatalog()
    expect(catalog.list()).toEqual(
      expect.arrayContaining([
        'physics',
        'ui',
        'particle',
        'tilemap',
        'networking'
      ])
    )
  })

  it('loads and tracks mods from manifest', async () => {
    const files = new Map<string, Uint8Array>([
      [
        'mods/demo/mod.json',
        new TextEncoder().encode(
          JSON.stringify({ id: 'demo', version: '1.0.0', assets: ['a.png'] })
        )
      ]
    ])

    const fs = {
      async readFile(path: string): Promise<Uint8Array> {
        const bytes = files.get(path)
        if (!bytes) {
          throw new Error('missing')
        }
        return bytes
      },
      async writeFile() {},
      async listDir(): Promise<string[]> {
        return ['demo']
      },
      watch(): () => void {
        return () => {}
      }
    }

    const manager = new ModManager(fs, new AppBuilder())
    const mod = await manager.loadMod('mods/demo')
    expect(mod.id).toBe('demo')
    expect(manager.getLoadedMods()).toHaveLength(1)
  })

  it('can reload a mod without duplicate plugin registration errors', async () => {
    const files = new Map<string, Uint8Array>([
      [
        'mods/demo/mod.json',
        new TextEncoder().encode(
          JSON.stringify({ id: 'demo', version: '1.0.0', assets: [] })
        )
      ]
    ])

    const fs = {
      async readFile(path: string): Promise<Uint8Array> {
        const bytes = files.get(path)
        if (!bytes) {
          throw new Error('missing')
        }
        return bytes
      },
      async writeFile() {},
      async listDir(): Promise<string[]> {
        return ['demo']
      },
      watch(): () => void {
        return () => {}
      }
    }

    const manager = new ModManager(fs, new AppBuilder())
    await manager.loadMod('mods/demo')
    await expect(
      manager.reloadMod('demo', 'mods/demo')
    ).resolves.toBeUndefined()
    expect(manager.getLoadedMods()).toHaveLength(1)
  })

  it('rejects malformed mod manifest payloads', async () => {
    const fs = {
      async readFile(): Promise<Uint8Array> {
        return new TextEncoder().encode(
          JSON.stringify({ id: '', version: 1, assets: [42] })
        )
      },
      async writeFile() {},
      async listDir(): Promise<string[]> {
        return []
      },
      watch(): () => void {
        return () => {}
      }
    }

    const manager = new ModManager(fs, new AppBuilder())
    await expect(manager.loadMod('mods/bad')).rejects.toThrow('manifest')
  })

  it('rejects mod manifest asset traversal paths', async () => {
    const fs = {
      async readFile(): Promise<Uint8Array> {
        return new TextEncoder().encode(
          JSON.stringify({
            id: 'demo',
            version: '1.0.0',
            assets: ['../escape.png']
          })
        )
      },
      async writeFile() {},
      async listDir(): Promise<string[]> {
        return []
      },
      watch(): () => void {
        return () => {}
      }
    }

    const manager = new ModManager(fs, new AppBuilder())
    await expect(manager.loadMod('mods/bad')).rejects.toThrow('unsafe asset')
  })
})
