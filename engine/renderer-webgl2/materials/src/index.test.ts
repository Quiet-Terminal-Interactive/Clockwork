import { describe, expect, it } from 'vitest'
import {
  Texture,
  TextureAtlas,
  TextureAtlasLoader,
  TextureLoader,
  packageId
} from './index'

function createMockGL(): WebGL2RenderingContext {
  const calls: Record<string, number> = {}
  const bump = (name: string): void => {
    calls[name] = (calls[name] ?? 0) + 1
  }

  const gl = {
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    NEAREST: 0x2600,
    LINEAR: 0x2601,
    TEXTURE_2D: 0x0de1,
    TEXTURE0: 0x84c0,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    UNPACK_ALIGNMENT: 0x0cf5,
    MAX_TEXTURE_SIZE: 0x0d33,

    createTexture: () => ({}),
    getParameter: () => 4096,
    deleteTexture: () => bump('deleteTexture'),
    activeTexture: () => bump('activeTexture'),
    bindTexture: () => bump('bindTexture'),
    pixelStorei: () => bump('pixelStorei'),
    texImage2D: () => bump('texImage2D'),
    texParameteri: () => bump('texParameteri'),
    generateMipmap: () => bump('generateMipmap'),

    _calls: calls
  }

  return gl as unknown as WebGL2RenderingContext
}

const source = {
  async fetch(): Promise<ArrayBuffer> {
    return new Uint8Array([1, 2, 3]).buffer
  },
  async readFile(): Promise<Uint8Array> {
    return new TextEncoder().encode(
      JSON.stringify({
        texture: 'atlas.png',
        regions: { hero: { x: 16, y: 8, w: 32, h: 16 } }
      })
    )
  }
} as const

describe('materials package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-materials')
  })

  it('creates atlas regions with normalized UVs', () => {
    const gl = createMockGL()
    const texture = new Texture(gl, undefined, 128, 64)
    const atlas = TextureAtlas.fromAtlasJson(texture, {
      texture: 'atlas.png',
      regions: {
        hero: { x: 16, y: 8, w: 32, h: 16 }
      }
    })

    expect(atlas.getRegion('hero')).toEqual({
      x: 16,
      y: 8,
      width: 32,
      height: 16,
      u0: 0.125,
      v0: 0.125,
      u1: 0.375,
      v1: 0.375
    })
  })

  it('uploads textures and configures filtering', async () => {
    const gl = createMockGL()
    const loader = new TextureLoader(gl, {
      async decode() {
        return {
          width: 4,
          height: 4,
          pixels: new Uint8Array(4 * 4 * 4)
        }
      }
    })

    const texture = await loader.load('sprite.png', source)
    texture.setFilter('nearest', 'linear')
    texture.generateMipmaps()

    const calls = (gl as unknown as { _calls: Record<string, number> })._calls
    expect(calls.texImage2D).toBeGreaterThanOrEqual(1)
    expect(calls.texParameteri).toBeGreaterThanOrEqual(4)
    expect(calls.generateMipmap).toBe(1)
  })

  it('parses atlas json payload', async () => {
    const loader = new TextureAtlasLoader()
    const result = await loader.load('atlas.json', source)

    expect(result.texture).toBe('atlas.png')
    expect(result.atlas.regions.hero!.w).toBe(32)
  })

  it('rejects texture dimensions above GPU limit', () => {
    const gl = createMockGL()
    expect(() => new Texture(gl, undefined, 8192, 8192)).toThrow('exceed GPU')
  })

  it('rejects malformed atlas json payload', async () => {
    const loader = new TextureAtlasLoader()
    const malformed = {
      async fetch(): Promise<ArrayBuffer> {
        return new Uint8Array().buffer
      },
      async readFile(): Promise<Uint8Array> {
        return new TextEncoder().encode('{"texture":1,"regions":[]}')
      }
    }

    await expect(loader.load('broken.atlas.json', malformed)).rejects.toThrow(
      'invalid'
    )
  })
})

