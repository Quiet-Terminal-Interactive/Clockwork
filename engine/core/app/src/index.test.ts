import { describe, expect, it } from 'vitest'
import { AppBuilder, type Plugin, packageId } from './index'

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
  it('hot reload does not crash app when plugin reload throws', () => {
    const builder = new AppBuilder()
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
