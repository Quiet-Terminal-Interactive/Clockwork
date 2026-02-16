import type { AssetLoader, AssetSource } from '@clockwork/assets'
import type { GLState } from '@clockwork/gl'

export const packageId = '@clockwork/materials'

export type FilterMode = 'nearest' | 'linear'

export interface AtlasRegion {
  x: number
  y: number
  width: number
  height: number
  u0: number
  v0: number
  u1: number
  v1: number
}

export interface AtlasJsonRegion {
  x: number
  y: number
  w: number
  h: number
}

export interface AtlasJson {
  texture: string
  regions: Record<string, AtlasJsonRegion>
}

export interface TextureUploadSource {
  width: number
  height: number
  pixels: TexImageSource | ArrayBufferView
}

/** GPU texture wrapper with filter and mip control. */
export class Texture {
  readonly glTexture: WebGLTexture

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly state: GLState | undefined,
    readonly width: number,
    readonly height: number,
    source?: TextureUploadSource
  ) {
    const texture = gl.createTexture()
    if (!texture) {
      throw new Error('Failed to create texture')
    }

    this.glTexture = texture
    this.bind(0)
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

    if (source) {
      this.upload(source)
    } else {
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        width,
        height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        null
      )
    }

    this.setFilter('linear', 'linear')
  }

  bind(slot: number): void {
    if (this.state) {
      this.state.bindTexture(slot, this.glTexture)
      return
    }

    this.gl.activeTexture(this.gl.TEXTURE0 + slot)
    this.gl.bindTexture(this.gl.TEXTURE_2D, this.glTexture)
  }

  setFilter(min: FilterMode, mag: FilterMode): void {
    this.bind(0)
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MIN_FILTER,
      this.resolveFilter(min)
    )
    this.gl.texParameteri(
      this.gl.TEXTURE_2D,
      this.gl.TEXTURE_MAG_FILTER,
      this.resolveFilter(mag)
    )
  }

  generateMipmaps(): void {
    this.bind(0)
    this.gl.generateMipmap(this.gl.TEXTURE_2D)
  }

  upload(source: TextureUploadSource): void {
    this.bind(0)

    if (ArrayBuffer.isView(source.pixels)) {
      this.gl.texImage2D(
        this.gl.TEXTURE_2D,
        0,
        this.gl.RGBA,
        source.width,
        source.height,
        0,
        this.gl.RGBA,
        this.gl.UNSIGNED_BYTE,
        source.pixels as ArrayBufferView
      )
      return
    }

    this.gl.texImage2D(
      this.gl.TEXTURE_2D,
      0,
      this.gl.RGBA,
      this.gl.RGBA,
      this.gl.UNSIGNED_BYTE,
      source.pixels
    )
  }

  destroy(): void {
    this.gl.deleteTexture(this.glTexture)
  }

  private resolveFilter(filter: FilterMode): number {
    return filter === 'nearest' ? this.gl.NEAREST : this.gl.LINEAR
  }
}

/** Named atlas regions mapped to a single texture. */
export class TextureAtlas {
  readonly regions = new Map<string, AtlasRegion>()

  constructor(
    readonly texture: Texture,
    regions: ReadonlyMap<string, AtlasRegion> | Record<string, AtlasRegion>
  ) {
    if (regions instanceof Map) {
      for (const [name, region] of regions) {
        this.regions.set(name, region)
      }
      return
    }

    for (const [name, region] of Object.entries(regions)) {
      this.regions.set(name, region)
    }
  }

  getRegion(name: string): AtlasRegion | undefined {
    return this.regions.get(name)
  }

  static fromAtlasJson(texture: Texture, atlas: AtlasJson): TextureAtlas {
    const regions = new Map<string, AtlasRegion>()

    for (const [name, region] of Object.entries(atlas.regions)) {
      regions.set(name, {
        x: region.x,
        y: region.y,
        width: region.w,
        height: region.h,
        u0: region.x / texture.width,
        v0: region.y / texture.height,
        u1: (region.x + region.w) / texture.width,
        v1: (region.y + region.h) / texture.height
      })
    }

    return new TextureAtlas(texture, regions)
  }
}

export interface TextureDecoder {
  decode(buffer: ArrayBuffer): Promise<TextureUploadSource>
}

/** Asset loader that decodes bytes and uploads textures to GPU. */
export class TextureLoader implements AssetLoader<Texture> {
  readonly extensions = ['.png', '.jpg', '.jpeg', '.webp']

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly decoder: TextureDecoder,
    private readonly state?: GLState,
    private readonly defaultFilter: { min: FilterMode; mag: FilterMode } = {
      min: 'linear',
      mag: 'linear'
    }
  ) {}

  async load(path: string, source: AssetSource): Promise<Texture> {
    const bytes = await source.fetch(path)
    const decoded = await this.decoder.decode(bytes)
    const texture = new Texture(
      this.gl,
      this.state,
      decoded.width,
      decoded.height,
      decoded
    )
    texture.setFilter(this.defaultFilter.min, this.defaultFilter.mag)
    return texture
  }

  unload(texture: Texture): void {
    texture.destroy()
  }
}

export interface AtlasDefinition {
  texture: string
  atlas: AtlasJson
}

/** Atlas loader that converts JSON region boxes into normalized UVs. */
export class TextureAtlasLoader {
  private readonly decoder = new TextDecoder()

  async load(path: string, source: AssetSource): Promise<AtlasDefinition> {
    const bytes = await source.readFile(path)
    const atlas = JSON.parse(this.decoder.decode(bytes)) as AtlasJson
    return { texture: atlas.texture, atlas }
  }
}
