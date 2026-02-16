import type { AssetLoader, AssetSource } from 'qti-clockwork-assets'
import type { GLState } from 'qti-clockwork-gl'

export const packageId = 'qti-clockwork-materials'

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

/** GPU texture wrapper with upload and filtering helpers. */
export class Texture {
  readonly glTexture: WebGLTexture
  private readonly maxTextureSize: number

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

    this.maxTextureSize = this.resolveMaxTextureSize()
    this.assertValidDimensions(width, height)
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
    this.assertValidDimensions(source.width, source.height)
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

  private resolveMaxTextureSize(): number {
    const value = this.gl.getParameter(this.gl.MAX_TEXTURE_SIZE)
    return typeof value === 'number' && Number.isFinite(value) && value > 0
      ? Math.floor(value)
      : 4096
  }

  private assertValidDimensions(width: number, height: number): void {
    if (!Number.isInteger(width) || !Number.isInteger(height)) {
      throw new Error('Texture dimensions must be integer values')
    }
    if (width <= 0 || height <= 0) {
      throw new Error('Texture dimensions must be positive values')
    }
    if (width > this.maxTextureSize || height > this.maxTextureSize) {
      throw new Error(
        `Texture dimensions ${width}x${height} exceed GPU limit ${this.maxTextureSize}`
      )
    }
  }
}
/** Named region map over a packed texture for sprite sheet lookups. */
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

/** Asset loader for image textures. */
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

/** JSON loader for texture atlas metadata. */
export class TextureAtlasLoader {
  private readonly decoder = new TextDecoder()

  async load(path: string, source: AssetSource): Promise<AtlasDefinition> {
    const bytes = await source.readFile(path)
    const atlas = parseAtlasJson(this.decoder.decode(bytes), path)
    return { texture: atlas.texture, atlas }
  }
}

function parseAtlasJson(raw: string, path: string): AtlasJson {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    throw new Error(
      `Failed to parse atlas JSON "${path}": ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Atlas JSON "${path}" must be an object`)
  }

  const texture = (parsed as Record<string, unknown>).texture
  const regions = (parsed as Record<string, unknown>).regions
  if (typeof texture !== 'string' || texture.trim().length === 0) {
    throw new Error(`Atlas JSON "${path}" has invalid "texture"`)
  }
  if (!regions || typeof regions !== 'object' || Array.isArray(regions)) {
    throw new Error(`Atlas JSON "${path}" has invalid "regions"`)
  }

  const validated: Record<string, AtlasJsonRegion> = {}
  for (const [name, region] of Object.entries(regions)) {
    if (!region || typeof region !== 'object' || Array.isArray(region)) {
      throw new Error(`Atlas JSON "${path}" has invalid region "${name}"`)
    }
    const candidate = region as Record<string, unknown>
    const x = asFiniteNumber(candidate.x)
    const y = asFiniteNumber(candidate.y)
    const w = asFiniteNumber(candidate.w)
    const h = asFiniteNumber(candidate.h)
    if (
      x === undefined ||
      y === undefined ||
      w === undefined ||
      h === undefined
    ) {
      throw new Error(`Atlas JSON "${path}" has invalid region "${name}"`)
    }
    validated[name] = { x, y, w, h }
  }

  return { texture, regions: validated }
}

function asFiniteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return undefined
  }
  return value
}

