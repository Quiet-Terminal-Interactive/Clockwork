import type { RenderPass, RenderContext } from 'qti-clockwork-passes'
import type { LightingWorld } from '../world.js'
import { compileProgram, makeQuadVAO, VERT_QUAD_SRC } from './util.js'

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;

uniform sampler2D u_src;

in vec2 v_uv;
out vec4 fragColor;

// Linear → sRGB: approximation good to < 0.5% error.
// The exact formula has a kink at 0.0031308 but the approximation is fine for games.
vec3 linearToSRGB(vec3 col) {
    return pow(max(col, vec3(0.0)), vec3(1.0 / 2.2));
}

void main() {
    vec3 col = texture(u_src, v_uv).rgb;
    col = linearToSRGB(col);

    fragColor = vec4(col, 1.0);
}
`

/**
 * Final output pass: gamma correction and blit to canvas.
 * Renders directly to the default framebuffer (null).
 */
export class OutputPass implements RenderPass {
  readonly name = 'output'
  readonly inputs = ['postProcessed']
  readonly outputs: string[] = []

  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly world: LightingWorld,
    private readonly width: number,
    private readonly height: number
  ) {}

  setup(): void {
    const gl = this.gl
    this.program = compileProgram(gl, VERT_QUAD_SRC, FRAG_SRC)
    this.vao = makeQuadVAO(gl, this.program)
  }

  execute(_ctx: RenderContext): void {
    const gl = this.gl
    const world = this.world

    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, this.width, this.height)

    if (!this.program || !this.vao) {
      return
    }

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, world.postProcessTex)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_src'), 0)

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl.bindVertexArray(null)
  }
}
