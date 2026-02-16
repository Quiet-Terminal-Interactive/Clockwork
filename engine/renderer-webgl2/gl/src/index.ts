export const packageId = '@clockwork/gl'

export type BlendMode = 'opaque' | 'alpha' | 'additive'
/** WebGL2 rendering context lifecycle manager with viewport and draw call helpers. */
export class RendererContext {
  gl!: WebGL2RenderingContext

  private canvas: HTMLCanvasElement | undefined

  init(canvas: HTMLCanvasElement): void {
    const gl = canvas.getContext('webgl2')
    if (!gl) {
      throw new Error('WebGL2 is unavailable in this environment')
    }

    this.canvas = canvas
    this.gl = gl
    this.setViewport(0, 0, canvas.width, canvas.height)
  }

  setViewport(x: number, y: number, width: number, height: number): void {
    this.assertInitialized()
    this.gl.viewport(x, y, width, height)
  }

  setClearColor(r: number, g: number, b: number, a: number): void {
    this.assertInitialized()
    this.gl.clearColor(r, g, b, a)
  }

  clear(mask?: number): void {
    this.assertInitialized()
    const clearMask =
      mask ?? this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT
    this.gl.clear(clearMask)
  }

  drawTriangles(vertexCount: number, firstVertex = 0): void {
    this.assertInitialized()
    this.gl.drawArrays(this.gl.TRIANGLES, firstVertex, vertexCount)
  }

  getError(): number {
    this.assertInitialized()
    return this.gl.getError()
  }

  shutdown(): void {
    if (!this.gl) {
      return
    }
    this.gl.bindVertexArray(null)
    this.gl.useProgram(null)
    this.canvas = undefined
  }

  private assertInitialized(): void {
    if (!this.gl) {
      throw new Error('RendererContext has not been initialized')
    }
  }
}
/** GPU state cache that skips redundant blend, depth, texture, and program changes. */
export class GLState {
  private blendMode: BlendMode | null = null
  private depthEnabled: boolean | null = null
  private cullEnabled: boolean | null = null
  private readonly boundTextures = new Map<number, WebGLTexture | null>()
  private boundVao: WebGLVertexArrayObject | null = null
  private program: WebGLProgram | null = null

  constructor(private readonly gl: WebGL2RenderingContext) {}

  setBlendMode(mode: BlendMode): void {
    if (this.blendMode === mode) {
      return
    }
    this.blendMode = mode

    if (mode === 'opaque') {
      this.gl.disable(this.gl.BLEND)
      return
    }

    this.gl.enable(this.gl.BLEND)
    if (mode === 'alpha') {
      this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
      return
    }

    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE)
  }

  setDepthTest(enabled: boolean): void {
    if (this.depthEnabled === enabled) {
      return
    }
    this.depthEnabled = enabled

    if (enabled) {
      this.gl.enable(this.gl.DEPTH_TEST)
    } else {
      this.gl.disable(this.gl.DEPTH_TEST)
    }
  }

  setCullFace(enabled: boolean): void {
    if (this.cullEnabled === enabled) {
      return
    }
    this.cullEnabled = enabled

    if (enabled) {
      this.gl.enable(this.gl.CULL_FACE)
    } else {
      this.gl.disable(this.gl.CULL_FACE)
    }
  }

  bindTexture(slot: number, texture: WebGLTexture | null): void {
    if (this.boundTextures.get(slot) === texture) {
      return
    }
    this.boundTextures.set(slot, texture)

    this.gl.activeTexture(this.gl.TEXTURE0 + slot)
    this.gl.bindTexture(this.gl.TEXTURE_2D, texture)
  }

  bindVAO(vao: WebGLVertexArrayObject | null): void {
    if (this.boundVao === vao) {
      return
    }
    this.boundVao = vao
    this.gl.bindVertexArray(vao)
  }

  useProgram(program: WebGLProgram | null): void {
    if (this.program === program) {
      return
    }
    this.program = program
    this.gl.useProgram(program)
  }
}
