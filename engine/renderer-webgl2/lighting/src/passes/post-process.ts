import type { RenderPass, RenderContext, RenderGraph } from 'qti-clockwork-passes'
import { RenderTarget } from 'qti-clockwork-passes'
import type { LightingWorld } from '../world.js'
import { compileProgram, makeQuadVAO, makeHdrFramebuffer, VERT_QUAD_SRC } from './util.js'

// Dual-filter bloom: downsample with a 13-tap tent kernel (Jimenez 2014 style).
const BLOOM_THRESHOLD_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_src;
uniform float u_threshold;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    vec3 col = texture(u_src, v_uv).rgb;
    float lum = dot(col, vec3(0.2126, 0.7152, 0.0722));
    // Soft knee avoids hard threshold clipping.
    float knee = u_threshold * 0.5;
    float ramp = clamp((lum - (u_threshold - knee)) / (2.0 * knee), 0.0, 1.0);
    fragColor = vec4(col * ramp, 1.0);
}
`

// 4-tap bilinear downsample (offset samples to avoid aliasing).
const BLOOM_DOWN_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_src;
uniform vec2 u_texelSize;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    // 4 bilinear samples offset by half a texel each — cheap and effective.
    vec4 s = texture(u_src, v_uv + vec2(-0.5, -0.5) * u_texelSize)
           + texture(u_src, v_uv + vec2( 0.5, -0.5) * u_texelSize)
           + texture(u_src, v_uv + vec2(-0.5,  0.5) * u_texelSize)
           + texture(u_src, v_uv + vec2( 0.5,  0.5) * u_texelSize);
    fragColor = s * 0.25;
}
`

// 9-tap tent filter upsample — blends the bloom mip back onto the level above.
const BLOOM_UP_FRAG = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_src;
uniform sampler2D u_base;
uniform vec2 u_texelSize;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    // 3×3 tent kernel with weight 1/16 at corners, 2/16 at edges, 4/16 at centre.
    vec2 t = u_texelSize;
    vec4 up = texture(u_src, v_uv + vec2(-t.x,  t.y)) * 1.0
            + texture(u_src, v_uv + vec2( 0.0,  t.y)) * 2.0
            + texture(u_src, v_uv + vec2( t.x,  t.y)) * 1.0
            + texture(u_src, v_uv + vec2(-t.x,  0.0)) * 2.0
            + texture(u_src, v_uv                   ) * 4.0
            + texture(u_src, v_uv + vec2( t.x,  0.0)) * 2.0
            + texture(u_src, v_uv + vec2(-t.x, -t.y)) * 1.0
            + texture(u_src, v_uv + vec2( 0.0, -t.y)) * 2.0
            + texture(u_src, v_uv + vec2( t.x, -t.y)) * 1.0;
    up /= 16.0;
    fragColor = texture(u_base, v_uv) + up;
}
`

const COMPOSITE_BLOOM_FRAG = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler3D;

uniform sampler2D u_src;
uniform sampler2D u_bloom;
uniform float u_bloomIntensity;

uniform bool u_vignetteEnabled;
uniform float u_vignetteIntensity;
uniform float u_vignetteRadius;

uniform sampler3D u_lut;
uniform bool u_useLut;

in vec2 v_uv;
out vec4 fragColor;

vec3 applyLUT(vec3 col, sampler3D lut) {
    const float LUT_SIZE = 32.0;
    const float SCALE = (LUT_SIZE - 1.0) / LUT_SIZE;
    const float OFFSET = 0.5 / LUT_SIZE;
    vec3 uvw = col * SCALE + OFFSET;
    return texture(lut, uvw).rgb;
}

void main() {
    vec3 col = texture(u_src, v_uv).rgb;
    vec3 bloom = texture(u_bloom, v_uv).rgb;
    col += bloom * u_bloomIntensity;

    if (u_vignetteEnabled) {
        // Radius controls where darkening starts toward the screen edges.
        vec2 cent = v_uv - 0.5;
        float dist = length(cent) * 1.41421356237;
        float edge = smoothstep(u_vignetteRadius, 1.0, dist);
        col *= 1.0 - edge * u_vignetteIntensity;
    }

    if (u_useLut) {
        col = applyLUT(col, u_lut);
    }

    fragColor = vec4(col, 1.0);
}
`

const BLOOM_LEVELS = 4

/**
 * Post-processing: bloom (dual-filter downsample/upsample), vignette, colour grading.
 */
export class PostProcessPass implements RenderPass {
  readonly name = 'postProcess'
  readonly inputs = ['composite']
  readonly outputs = ['postProcessed']

  private threshProgram: WebGLProgram | null = null
  private downProgram: WebGLProgram | null = null
  private upProgram: WebGLProgram | null = null
  private compositeBloomProgram: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null

  // Bloom mip chain: [threshold, down1, down2, down3, down4]
  private bloomChainTex: WebGLTexture[] = []
  private bloomChainFb: WebGLFramebuffer[] = []
  private bloomChainSize: Array<{ w: number; h: number }> = []

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly world: LightingWorld,
    private readonly width: number,
    private readonly height: number
  ) {}

  setup(graph: RenderGraph): void {
    const gl = this.gl
    this.threshProgram = compileProgram(gl, VERT_QUAD_SRC, BLOOM_THRESHOLD_FRAG)
    this.downProgram = compileProgram(gl, VERT_QUAD_SRC, BLOOM_DOWN_FRAG)
    this.upProgram = compileProgram(gl, VERT_QUAD_SRC, BLOOM_UP_FRAG)
    this.compositeBloomProgram = compileProgram(gl, VERT_QUAD_SRC, COMPOSITE_BLOOM_FRAG)

    // All programs share the same quad geometry; use the first one to build the VAO.
    this.vao = makeQuadVAO(gl, this.threshProgram)

    // Build bloom mip chain: full → half → quarter → eighth → sixteenth.
    let w = this.width
    let h = this.height
    for (let i = 0; i <= BLOOM_LEVELS; i++) {
      const { tex, fb } = makeHdrFramebuffer(gl, w, h)
      this.bloomChainTex.push(tex)
      this.bloomChainFb.push(fb)
      this.bloomChainSize.push({ w, h })
      w = Math.max(1, w >> 1)
      h = Math.max(1, h >> 1)
    }

    const { tex, fb } = makeHdrFramebuffer(gl, this.width, this.height)
    this.world.postProcessTex = tex
    this.world.postProcessFb = fb

    graph.defineRenderTarget(
      'postProcessed',
      new RenderTarget(undefined, this.width, this.height, fb)
    )
  }

  execute(_ctx: RenderContext): void {
    const gl = this.gl
    const world = this.world
    const config = world.config

    if (!this.vao) {
      return
    }

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.bindVertexArray(this.vao)

    if (config.bloomEnabled) {
      this.runBloom()
    }

    // Composite bloom onto the scene image (bloom=0 if disabled).
    this.runCompositeBloom()

    gl.bindVertexArray(null)
  }

  private runBloom(): void {
    const gl = this.gl
    const world = this.world
    const config = world.config

    // Step 1: Threshold — extract bright pixels into bloom chain level 0.
    if (!this.threshProgram || !this.bloomChainFb[0] || !this.bloomChainSize[0]) {
      return
    }
    const s0 = this.bloomChainSize[0]
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.bloomChainFb[0])
    gl.viewport(0, 0, s0.w, s0.h)
    gl.useProgram(this.threshProgram)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, world.compositeTex)
    gl.uniform1i(gl.getUniformLocation(this.threshProgram, 'u_src'), 0)
    gl.uniform1f(gl.getUniformLocation(this.threshProgram, 'u_threshold'), config.bloomThreshold)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    if (!this.downProgram) {
      return
    }

    // Step 2: Downsample chain.
    for (let i = 1; i <= BLOOM_LEVELS; i++) {
      const src = this.bloomChainSize[i - 1]
      const dst = this.bloomChainSize[i]
      if (!src || !dst || !this.bloomChainFb[i] || !this.bloomChainTex[i - 1]) {
        continue
      }
      const fb = this.bloomChainFb[i]!
      const srcTex = this.bloomChainTex[i - 1]!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.viewport(0, 0, dst.w, dst.h)
      gl.useProgram(this.downProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, srcTex)
      gl.uniform1i(gl.getUniformLocation(this.downProgram, 'u_src'), 0)
      gl.uniform2f(
        gl.getUniformLocation(this.downProgram, 'u_texelSize'),
        config.bloomRadius / src.w,
        config.bloomRadius / src.h
      )
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }

    if (!this.upProgram) {
      return
    }

    // Step 3: Upsample chain — accumulate bloom back up the mip levels.
    for (let i = BLOOM_LEVELS - 1; i >= 0; i--) {
      const src = this.bloomChainSize[i + 1]
      const dst = this.bloomChainSize[i]
      if (!src || !dst || !this.bloomChainFb[i] || !this.bloomChainTex[i + 1] || !this.bloomChainTex[i]) {
        continue
      }
      const fb = this.bloomChainFb[i]!
      const srcTex = this.bloomChainTex[i + 1]!
      const baseTex = this.bloomChainTex[i]!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.viewport(0, 0, dst.w, dst.h)
      gl.useProgram(this.upProgram)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, srcTex)
      gl.uniform1i(gl.getUniformLocation(this.upProgram, 'u_src'), 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, baseTex)
      gl.uniform1i(gl.getUniformLocation(this.upProgram, 'u_base'), 1)
      gl.uniform2f(
        gl.getUniformLocation(this.upProgram, 'u_texelSize'),
        config.bloomRadius / src.w,
        config.bloomRadius / src.h
      )
      gl.drawArrays(gl.TRIANGLES, 0, 6)
    }
  }

  private runCompositeBloom(): void {
    const gl = this.gl
    const world = this.world
    const config = world.config

    if (!this.compositeBloomProgram) {
      return
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, world.postProcessFb)
    gl.viewport(0, 0, this.width, this.height)
    gl.useProgram(this.compositeBloomProgram)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, world.compositeTex)
    gl.uniform1i(gl.getUniformLocation(this.compositeBloomProgram, 'u_src'), 0)

    gl.activeTexture(gl.TEXTURE1)
    // bloom chain level 0 contains the accumulated bloom after upsample.
    gl.bindTexture(gl.TEXTURE_2D, config.bloomEnabled ? (this.bloomChainTex[0] ?? null) : null)
    gl.uniform1i(gl.getUniformLocation(this.compositeBloomProgram, 'u_bloom'), 1)
    gl.uniform1f(
      gl.getUniformLocation(this.compositeBloomProgram, 'u_bloomIntensity'),
      config.bloomEnabled ? config.bloomIntensity : 0.0
    )

    gl.uniform1i(
      gl.getUniformLocation(this.compositeBloomProgram, 'u_vignetteEnabled'),
      config.vignetteEnabled ? 1 : 0
    )
    gl.uniform1f(
      gl.getUniformLocation(this.compositeBloomProgram, 'u_vignetteIntensity'),
      config.vignetteIntensity
    )
    gl.uniform1f(
      gl.getUniformLocation(this.compositeBloomProgram, 'u_vignetteRadius'),
      config.vignetteRadius
    )

    const lut = world.getColourLUT()
    if (lut) {
      gl.activeTexture(gl.TEXTURE2)
      gl.bindTexture(gl.TEXTURE_3D, lut)
      gl.uniform1i(gl.getUniformLocation(this.compositeBloomProgram, 'u_lut'), 2)
      gl.uniform1i(gl.getUniformLocation(this.compositeBloomProgram, 'u_useLut'), 1)
    } else {
      gl.uniform1i(gl.getUniformLocation(this.compositeBloomProgram, 'u_useLut'), 0)
    }

    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }
}
