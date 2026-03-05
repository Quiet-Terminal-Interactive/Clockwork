import type { Camera2D } from 'qti-clockwork-passes'
import {
  type LightingConfig,
  type TextureHandle,
  DEFAULT_LIGHTING_CONFIG,
} from './config.js'
import {
  type PointLight,
  type SpotLight,
  type AmbientLight,
  type Vec2,
  type FalloffMode,
} from './components.js'
import { ShelfPacker, type AtlasAllocation } from './shelf-packer.js'

export const LIGHTING_WORLD_KEY = 'lighting:world'

/** Key for the active Camera2D resource (set by the renderer or app layer). */
export const LIGHTING_CAMERA_KEY = 'renderer:camera'
export const DEFAULT_SHADOW_RESOLUTION = 512

export type LightType = 'point' | 'spot'

export interface ActiveLight {
  type: LightType
  position: Vec2
  direction: Vec2
  colour: { r: number; g: number; b: number }
  intensity: number
  radius: number
  falloff: FalloffMode
  innerAngle: number
  outerAngle: number
  castsShadows: boolean
  shadowSoftness: number
  shadowResolution: number
  atlasAlloc: AtlasAllocation | null
}

export interface AmbientLightData {
  colour: { r: number; g: number; b: number }
  intensity: number
  skyColour: { r: number; g: number; b: number }
  groundColour: { r: number; g: number; b: number }
}

/**
 * Central lighting state for one frame. Systems write light/occluder data here,
 * render passes read from it. Owns all GL resources for the lighting pipeline.
 */
export class LightingWorld {
  readonly config: LightingConfig

  // Per-frame light list, rebuilt by the prep system every frame.
  readonly activeLights: ActiveLight[] = []
  readonly emissiveEntities = new Set<number>()
  activeAmbient: AmbientLightData | null = null

  // Camera info needed to reconstruct world positions in shaders.
  cameraPos: Vec2 = { x: 0, y: 0 }
  cameraZoom = 1.0
  viewportWidth = 1
  viewportHeight = 1

  // Shadow atlas: RGBA16F texture packed with 1D shadow maps.
  shadowAtlasTex: WebGLTexture | null = null
  private readonly shadowAtlasBuf: Float32Array

  // Light data texture: 8 texels × maxLights, RGBA32F.
  // Texel layout per light: see uploadLightData().
  lightDataTex: WebGLTexture | null = null
  private readonly lightDataBuf: Float32Array

  private readonly packer: ShelfPacker

  // Framebuffers and textures for each pipeline stage, set up by the passes.
  gbufferAlbedoTex: WebGLTexture | null = null
  gbufferNormalTex: WebGLTexture | null = null
  gbufferEmissiveTex: WebGLTexture | null = null
  lightBufferTex: WebGLTexture | null = null
  lightBufferFb: WebGLFramebuffer | null = null
  compositeTex: WebGLTexture | null = null
  compositeFb: WebGLFramebuffer | null = null
  postProcessTex: WebGLTexture | null = null
  postProcessFb: WebGLFramebuffer | null = null
  bloomTextures: WebGLTexture[] = []
  bloomFbs: WebGLFramebuffer[] = []

  constructor(config: LightingConfig = DEFAULT_LIGHTING_CONFIG) {
    this.config = config
    const atlasSize = this.config.shadowAtlasSize
    // 4 floats per pixel (RGBA), one pixel wide per angle bin, atlas is atlasSize × atlasSize.
    this.shadowAtlasBuf = new Float32Array(atlasSize * atlasSize * 4)
    // 8 texels × maxLights × 4 floats (RGBA32F)
    this.lightDataBuf = new Float32Array(8 * this.config.maxLights * 4)
    this.packer = new ShelfPacker(atlasSize, atlasSize)
  }

  /** Call from the prep system to synchronise camera parameters from ECS. */
  updateCamera(cam: Camera2D): void {
    this.cameraPos = { x: cam.position.x, y: cam.position.y }
    this.cameraZoom = cam.zoom
    this.viewportWidth = cam.viewport.width
    this.viewportHeight = cam.viewport.height
  }

  addPointLight(light: PointLight): void {
    if (this.activeLights.length >= this.config.maxLights) {
      return
    }
    this.activeLights.push({
      type: 'point',
      position: { ...light.position },
      direction: { x: 0, y: 1 },
      colour: { ...light.colour },
      intensity: light.intensity,
      radius: light.radius,
      falloff: light.falloff,
      innerAngle: 0,
      outerAngle: 0,
      castsShadows: light.castsShadows,
      shadowSoftness: light.shadowSoftness,
      shadowResolution: light.shadowResolution ?? DEFAULT_SHADOW_RESOLUTION,
      atlasAlloc: null,
    })
  }

  addSpotLight(light: SpotLight): void {
    if (this.activeLights.length >= this.config.maxLights) {
      return
    }
    this.activeLights.push({
      type: 'spot',
      position: { ...light.position },
      direction: { ...light.direction },
      colour: { ...light.colour },
      intensity: light.intensity,
      radius: light.radius,
      falloff: light.falloff,
      innerAngle: light.innerAngle,
      outerAngle: light.outerAngle,
      castsShadows: light.castsShadows,
      shadowSoftness: light.shadowSoftness,
      shadowResolution: light.shadowResolution ?? DEFAULT_SHADOW_RESOLUTION,
      atlasAlloc: null,
    })
  }

  /**
   * Remove lights that cannot affect the current viewport.
   *
   * A light is kept only if its radius intersects the camera rectangle.
   */
  cullLightsToCamera(): void {
    if (this.activeLights.length === 0) {
      return
    }
    const halfW = (this.viewportWidth * 0.5) / this.cameraZoom
    const halfH = (this.viewportHeight * 0.5) / this.cameraZoom
    const minX = this.cameraPos.x - halfW
    const maxX = this.cameraPos.x + halfW
    const minY = this.cameraPos.y - halfH
    const maxY = this.cameraPos.y + halfH

    let write = 0
    for (let i = 0; i < this.activeLights.length; i++) {
      const light = this.activeLights[i]
      if (!light) {
        continue
      }
      if (!circleIntersectsAabb(light.position.x, light.position.y, light.radius, minX, minY, maxX, maxY)) {
        continue
      }
      this.activeLights[write++] = light
    }
    this.activeLights.length = write
  }

  setAmbientLight(light: AmbientLight): void {
    this.activeAmbient = {
      colour: { ...light.colour },
      intensity: light.intensity,
      skyColour: { ...light.skyColour },
      groundColour: { ...light.groundColour },
    }
  }

  /**
   * CPU-side polar ray casting for all shadow-casting lights.
   *
   * For each angle bin, cast a ray from the light and find the nearest occluder.
   * Result is normalised distance in [0, 1], stored in the shadow atlas CPU buffer.
   * Then flush to GPU via uploadShadowAtlas().
   */
  computeShadowMaps(occluderSegments: [Vec2, Vec2][]): void {
    const atlasSize = this.config.shadowAtlasSize

    this.packer.reset()

    for (const light of this.activeLights) {
      if (!light.castsShadows) {
        light.atlasAlloc = null
        continue
      }

      const res = light.shadowResolution
      const alloc = this.packer.allocate(res, 1)
      light.atlasAlloc = alloc
      if (!alloc) {
        continue // Atlas is full. Graceful degredation: light renders unoccluded.
      }

      const relevantSegments = occluderSegments.filter(([a, b]) =>
        segmentIntersectsCircle(a.x, a.y, b.x, b.y, light.position.x, light.position.y, light.radius)
      )

      this.raycastShadowStrip(light, relevantSegments, alloc, atlasSize)
    }
  }

  /**
   * Ray-cast a single 1D shadow strip into the atlas CPU buffer.
   *
   * For each angle bin i: angle = i/res * 2π → ray from light position.
   * Nearest occluder hit distance (normalised by light.radius) goes into the strip.
   * Pixels outside the light radius are 1.0 (fully lit, no shadow).
   */
  private raycastShadowStrip(
    light: ActiveLight,
    segments: [Vec2, Vec2][],
    alloc: AtlasAllocation,
    atlasSize: number
  ): void {
    const res = alloc.width
    const px = light.position.x
    const py = light.position.y
    const r = light.radius
    const TWO_PI = Math.PI * 2

    for (let i = 0; i < res; i++) {
      const angle = (i / res) * TWO_PI
      const dx = Math.cos(angle)
      const dy = Math.sin(angle)

      let minT = r // Default: no occluder → map stores 1.0 (normalised by radius below)

      for (const [a, b] of segments) {
        const t = raySegmentT(px, py, dx, dy, a.x, a.y, b.x, b.y)
        if (t < minT) {
          minT = t
        }
      }

      const normDist = minT / r
      const bufIdx = (alloc.y * atlasSize + alloc.x + i) * 4
      this.shadowAtlasBuf[bufIdx + 0] = normDist
      this.shadowAtlasBuf[bufIdx + 1] = normDist
      this.shadowAtlasBuf[bufIdx + 2] = normDist
      this.shadowAtlasBuf[bufIdx + 3] = 1.0
    }
  }

  /** Upload shadow atlas CPU buffer to GPU. Call after computeShadowMaps(). */
  uploadShadowAtlas(gl: WebGL2RenderingContext): void {
    if (!this.shadowAtlasTex) {
      return
    }
    const atlasSize = this.config.shadowAtlasSize
    gl.bindTexture(gl.TEXTURE_2D, this.shadowAtlasTex)

    for (const light of this.activeLights) {
      if (!light.castsShadows || !light.atlasAlloc) {
        continue
      }
      const alloc = light.atlasAlloc
      const res = alloc.width

      // Extract just this light's strip from the full atlas buffer.
      const rowStart = (alloc.y * atlasSize + alloc.x) * 4
      const strip = this.shadowAtlasBuf.subarray(rowStart, rowStart + res * 4)

      gl.texSubImage2D(
        gl.TEXTURE_2D,
        0,
        alloc.x,
        alloc.y,
        res,
        1,
        gl.RGBA,
        gl.FLOAT,
        strip
      )
    }
  }

  /**
   * Pack active light parameters into the light data texture and upload to GPU.
   *
   * Each light occupies 8 texels (rows in a 8 × maxLights RGBA32F texture):
   *   0: (posX, posY, dirX, dirY)
   *   1: (colR, colG, colB, intensity)
   *   2: (radius, falloff, innerAngle, outerAngle)
   *   3: (shadowSoftness, lightType, castsShadows, unused)
   *   4: (atlasU0, atlasV0, atlasUWidth, unused)
   *   5–7: reserved
   */
  uploadLightData(gl: WebGL2RenderingContext): void {
    if (!this.lightDataTex) {
      return
    }

    const buf = this.lightDataBuf
    const maxLights = this.config.maxLights

    for (let i = 0; i < this.activeLights.length; i++) {
      const l = this.activeLights[i]
      if (!l) {
        continue
      }
      const base = i * 8 * 4

      const falloffCode = l.falloff === 'linear' ? 0 : l.falloff === 'quadratic' ? 1 : 2
      const typeCode = l.type === 'point' ? 0 : 1

      // Texel 0: position + direction
      buf[base + 0] = l.position.x
      buf[base + 1] = l.position.y
      buf[base + 2] = l.direction.x
      buf[base + 3] = l.direction.y

      // Texel 1: colour + intensity
      buf[base + 4] = l.colour.r
      buf[base + 5] = l.colour.g
      buf[base + 6] = l.colour.b
      buf[base + 7] = l.intensity

      // Texel 2: radius + falloff + spot angles
      buf[base + 8] = l.radius
      buf[base + 9] = falloffCode
      buf[base + 10] = l.innerAngle
      buf[base + 11] = l.outerAngle

      // Texel 3: shadow parameters
      buf[base + 12] = l.shadowSoftness
      buf[base + 13] = typeCode
      buf[base + 14] = l.castsShadows ? 1 : 0
      buf[base + 15] = 0

      // Texel 4: atlas UV region (0 if no shadow)
      const alloc = l.atlasAlloc
      buf[base + 16] = alloc ? alloc.u0 : 0
      buf[base + 17] = alloc ? alloc.v0 : 0
      buf[base + 18] = alloc ? alloc.uWidth : 0
      buf[base + 19] = 0

      // Texels 5–7: unused (clear to 0)
      buf.fill(0, base + 20, base + 32)
    }

    // Zero out unused light slots so the shader sees lightCount as the authority.
    if (this.activeLights.length < maxLights) {
      buf.fill(0, this.activeLights.length * 8 * 4)
    }

    gl.bindTexture(gl.TEXTURE_2D, this.lightDataTex)
    gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 8, maxLights, gl.RGBA, gl.FLOAT, buf)
  }

  getColourLUT(): TextureHandle {
    return this.config.colourLUT
  }

  clearFrame(): void {
    this.activeLights.length = 0
    this.activeAmbient = null
    this.emissiveEntities.clear()
  }
}

/**
 * Parametric ray–segment intersection.
 *
 * Returns the ray parameter t ≥ 0 where the ray (origin + t*dir) hits the
 * segment [a, b], or Infinity if there is no hit.
 * u ∈ [0,1] is the segment parameter (checked but not returned).
 */
function raySegmentT(
  px: number,
  py: number,
  dx: number,
  dy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const bax = bx - ax
  const bay = by - ay
  // denom = cross(dir, B-A)
  const denom = dy * bax - dx * bay
  if (Math.abs(denom) < 1e-10) {
    return Infinity // Ray parallel to segment — no intersection.
  }

  const apx = ax - px
  const apy = ay - py
  const t = (bax * apy - bay * apx) / denom
  const u = (dx * apy - dy * apx) / denom

  if (t >= 0 && u >= 0 && u <= 1) {
    return t
  }
  return Infinity
}

function circleIntersectsAabb(
  cx: number,
  cy: number,
  r: number,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number
): boolean {
  const nearestX = Math.max(minX, Math.min(cx, maxX))
  const nearestY = Math.max(minY, Math.min(cy, maxY))
  const dx = cx - nearestX
  const dy = cy - nearestY
  return dx * dx + dy * dy <= r * r
}

function segmentIntersectsCircle(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  r: number
): boolean {
  const abx = bx - ax
  const aby = by - ay
  const acx = cx - ax
  const acy = cy - ay
  const abLenSq = abx * abx + aby * aby

  let t = 0
  if (abLenSq > 1e-12) {
    t = (acx * abx + acy * aby) / abLenSq
    t = Math.max(0, Math.min(1, t))
  }
  const px = ax + abx * t
  const py = ay + aby * t
  const dx = cx - px
  const dy = cy - py
  return dx * dx + dy * dy <= r * r
}
