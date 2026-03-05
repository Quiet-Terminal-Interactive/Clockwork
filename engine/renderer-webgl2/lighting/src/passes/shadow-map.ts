import type { RenderPass, RenderContext } from 'qti-clockwork-passes'
import type { LightingWorld } from '../world.js'

/**
 * Initialises the shadow atlas GPU texture and uploads CPU-computed shadow maps
 * each frame. The actual ray casting happens in LightingWorld.computeShadowMaps()
 * (called by the prep system), so this pass is purely a GPU upload step.
 */
export class ShadowMapPass implements RenderPass {
  readonly name = 'shadowMap'
  readonly inputs: string[] = []
  readonly outputs = ['shadowAtlas']

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly world: LightingWorld
  ) {}

  setup(): void {
    const gl = this.gl
    const config = this.world.config
    const atlasSize = config.shadowAtlasSize

    const tex = gl.createTexture()
    if (!tex) {
      throw new Error('LightingPlugin: failed to create shadow atlas texture')
    }

    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, atlasSize, atlasSize, 0, gl.RGBA, gl.FLOAT, null)

    // Nearest filter: shadow distance must not blur across angle bins.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    // Wrap-around on U so angular sampling at 0/2π boundary is seamless.
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    // Create the light data texture: 8 texels wide × maxLights tall, RGBA32F.
    const lightTex = gl.createTexture()
    if (!lightTex) {
      throw new Error('LightingPlugin: failed to create light data texture')
    }
    gl.bindTexture(gl.TEXTURE_2D, lightTex)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA32F,
      8,
      config.maxLights,
      0,
      gl.RGBA,
      gl.FLOAT,
      null
    )
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    this.world.shadowAtlasTex = tex
    this.world.lightDataTex = lightTex
  }

  execute(_ctx: RenderContext): void {
    // Shadow ray casting was done by the prep system; just push it to GPU.
    this.world.uploadShadowAtlas(this.gl)
    this.world.uploadLightData(this.gl)
  }
}
