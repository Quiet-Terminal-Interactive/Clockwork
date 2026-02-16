export const packageId = '@clockwork/shaders'

const INCLUDE_PATTERN = /^\s*#include\s+"([^"]+)"\s*$/gm

export interface ShaderCompilerOptions {
  includeResolver?: (path: string) => string | undefined
  cache?: Map<string, Shader>
}
/** Compiled GPU program handle with cached uniform location lookups. */
export class Shader {
  readonly uniforms = new Map<string, WebGLUniformLocation>()

  constructor(
    private readonly gl: WebGL2RenderingContext,
    readonly program: WebGLProgram
  ) {}

  use(): void {
    this.gl.useProgram(this.program)
  }

  setUniform(name: string, value: unknown): void {
    const location = this.getUniformLocation(name)
    if (!location) {
      return
    }

    if (typeof value === 'number') {
      this.gl.uniform1f(location, value)
      return
    }

    if (typeof value === 'boolean') {
      this.gl.uniform1i(location, value ? 1 : 0)
      return
    }

    if (value instanceof Float32Array) {
      this.setFloatArray(location, value)
      return
    }

    if (value instanceof Int32Array) {
      this.setIntArray(location, value)
      return
    }

    if (
      Array.isArray(value) &&
      value.every((item) => typeof item === 'number')
    ) {
      this.setNumberArray(location, value)
      return
    }

    throw new Error(`Unsupported uniform value for "${name}"`)
  }

  setUniformBlock(name: string, binding: number): void {
    const index = this.gl.getUniformBlockIndex(this.program, name)
    if (index === this.gl.INVALID_INDEX) {
      throw new Error(`Uniform block "${name}" does not exist`)
    }
    this.gl.uniformBlockBinding(this.program, index, binding)
  }

  private getUniformLocation(name: string): WebGLUniformLocation | null {
    const cached = this.uniforms.get(name)
    if (cached) {
      return cached
    }

    const location = this.gl.getUniformLocation(this.program, name)
    if (!location) {
      return null
    }

    this.uniforms.set(name, location)
    return location
  }

  private setFloatArray(
    location: WebGLUniformLocation,
    value: Float32Array
  ): void {
    switch (value.length) {
      case 2:
        this.gl.uniform2fv(location, value)
        return
      case 3:
        this.gl.uniform3fv(location, value)
        return
      case 4:
        this.gl.uniform4fv(location, value)
        return
      case 9:
        this.gl.uniformMatrix3fv(location, false, value)
        return
      case 16:
        this.gl.uniformMatrix4fv(location, false, value)
        return
      default:
        throw new Error(
          `Unsupported float uniform array length: ${value.length}`
        )
    }
  }

  private setIntArray(location: WebGLUniformLocation, value: Int32Array): void {
    switch (value.length) {
      case 2:
        this.gl.uniform2iv(location, value)
        return
      case 3:
        this.gl.uniform3iv(location, value)
        return
      case 4:
        this.gl.uniform4iv(location, value)
        return
      default:
        throw new Error(`Unsupported int uniform array length: ${value.length}`)
    }
  }

  private setNumberArray(
    location: WebGLUniformLocation,
    value: number[]
  ): void {
    if (value.every((item) => Number.isInteger(item))) {
      this.setIntArray(location, new Int32Array(value))
      return
    }
    this.setFloatArray(location, new Float32Array(value))
  }
}
/** Compiles, links, and caches GLSL shaders with optional #include expansion. */
export class ShaderCompiler {
  private readonly cache: Map<string, Shader>
  private readonly includeResolver:
    | ((path: string) => string | undefined)
    | undefined
  private error: string | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    options?: ShaderCompilerOptions
  ) {
    this.cache = options?.cache ?? new Map<string, Shader>()
    this.includeResolver = options?.includeResolver
  }

  compile(vertSrc: string, fragSrc: string): Shader {
    return this.compileExpanded(vertSrc, fragSrc)
  }

  compileWithIncludes(vertPath: string, fragPath: string): Shader {
    if (!this.includeResolver) {
      throw new Error('compileWithIncludes requires includeResolver')
    }

    const vertSrc = this.resolveSource(vertPath)
    const fragSrc = this.resolveSource(fragPath)

    const expandedVert = this.expandIncludes(vertSrc, [vertPath])
    const expandedFrag = this.expandIncludes(fragSrc, [fragPath])
    return this.compileExpanded(expandedVert, expandedFrag)
  }

  getError(): string | null {
    return this.error
  }

  private resolveSource(path: string): string {
    const resolved = this.includeResolver?.(path)
    if (!resolved) {
      throw new Error(`Missing shader source: ${path}`)
    }
    return resolved
  }

  private expandIncludes(source: string, stack: string[]): string {
    return source.replace(INCLUDE_PATTERN, (_, includePath: string) => {
      if (stack.includes(includePath)) {
        throw new Error(
          `Circular shader include: ${[...stack, includePath].join(' -> ')}`
        )
      }

      const includeSource = this.resolveSource(includePath)
      return this.expandIncludes(includeSource, [...stack, includePath])
    })
  }

  private compileExpanded(vertSrc: string, fragSrc: string): Shader {
    const key = `${vertSrc}\u0000${fragSrc}`
    const cached = this.cache.get(key)
    if (cached) {
      return cached
    }

    this.error = null
    const vert = this.compileStage(this.gl.VERTEX_SHADER, vertSrc)
    const frag = this.compileStage(this.gl.FRAGMENT_SHADER, fragSrc)

    const program = this.gl.createProgram()
    if (!program) {
      this.gl.deleteShader(vert)
      this.gl.deleteShader(frag)
      throw new Error('Failed to create shader program')
    }

    this.gl.attachShader(program, vert)
    this.gl.attachShader(program, frag)
    this.gl.linkProgram(program)

    const linked = this.gl.getProgramParameter(program, this.gl.LINK_STATUS)
    this.gl.deleteShader(vert)
    this.gl.deleteShader(frag)

    if (!linked) {
      this.error = this.gl.getProgramInfoLog(program) ?? 'Unknown link error'
      this.gl.deleteProgram(program)
      throw new Error(`Shader link failed: ${this.error}`)
    }

    const shader = new Shader(this.gl, program)
    this.cache.set(key, shader)
    return shader
  }

  private compileStage(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)
    if (!shader) {
      throw new Error('Failed to create shader')
    }

    this.gl.shaderSource(shader, source)
    this.gl.compileShader(shader)

    const compiled = this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)
    if (compiled) {
      return shader
    }

    this.error = this.gl.getShaderInfoLog(shader) ?? 'Unknown compile error'
    this.gl.deleteShader(shader)
    throw new Error(`Shader compile failed: ${this.error}`)
  }
}
