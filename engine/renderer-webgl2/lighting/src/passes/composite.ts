import type { RenderPass, RenderContext, RenderGraph } from 'qti-clockwork-passes'
import { RenderTarget } from 'qti-clockwork-passes'
import type { LightingWorld } from '../world.js'
import { compileProgram, makeQuadVAO, makeHdrFramebuffer, VERT_QUAD_SRC } from './util.js'

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_albedo;
uniform sampler2D u_emissive;
uniform sampler2D u_lightBuffer;

in vec2 v_uv;
out vec4 fragColor;

void main() {
    vec4 albedo   = texture(u_albedo, v_uv);
    vec4 emissive = texture(u_emissive, v_uv);
    vec3 light    = texture(u_lightBuffer, v_uv).rgb;

    // Emissive alpha channel stores per-pixel emissive intensity.
    vec3 emissiveContrib = emissive.rgb * emissive.a;

    fragColor = vec4(albedo.rgb * light + emissiveContrib, albedo.a);
}
`

/** Combines albedo × light buffer and adds emissive contribution into a composite HDR buffer. */
export class CompositePass implements RenderPass {
  readonly name = 'composite'
  readonly inputs = ['albedo', 'emissive', 'lightBuffer']
  readonly outputs = ['composite']

  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly world: LightingWorld,
    private readonly width: number,
    private readonly height: number
  ) {}

  setup(graph: RenderGraph): void {
    const gl = this.gl
    this.program = compileProgram(gl, VERT_QUAD_SRC, FRAG_SRC)
    this.vao = makeQuadVAO(gl, this.program)

    const { tex, fb } = makeHdrFramebuffer(gl, this.width, this.height)
    this.world.compositeTex = tex
    this.world.compositeFb = fb

    graph.defineRenderTarget('composite', new RenderTarget(undefined, this.width, this.height, fb))
  }

  execute(ctx: RenderContext): void {
    const gl = this.gl
    const world = this.world

    // Read albedo and emissive from upstream G-buffer targets.
    const albedoTarget = ctx.targets.get('albedo')
    const emissiveTarget = ctx.targets.get('emissive')
    if (albedoTarget?.texture) {
      world.gbufferAlbedoTex = albedoTarget.texture.glTexture
    }
    if (emissiveTarget?.texture) {
      world.gbufferEmissiveTex = emissiveTarget.texture.glTexture
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, world.compositeFb)
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.program || !this.vao) {
      return
    }

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, world.gbufferAlbedoTex)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_albedo'), 0)

    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, world.gbufferEmissiveTex)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_emissive'), 1)

    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, world.lightBufferTex)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_lightBuffer'), 2)

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl.bindVertexArray(null)
  }
}
