import { describe, expect, it } from 'vitest'
import { ShaderCompiler, packageId } from './index'

function createMockShaderGL(): WebGL2RenderingContext {
  const shaderSource = new Map<object, string>()
  const uniformLocations = new Map<string, object>()

  const gl = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    INVALID_INDEX: 0xffffffff,

    createShader: () => ({}),
    shaderSource: (shader: object, source: string) => {
      shaderSource.set(shader, source)
    },
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},

    createProgram: () => ({}),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},

    useProgram: () => {},
    getUniformLocation: (_program: object, name: string) => {
      if (!uniformLocations.has(name)) {
        uniformLocations.set(name, { name })
      }
      return uniformLocations.get(name)
    },
    uniform1f: () => {},
    uniform1i: () => {},
    uniform2fv: () => {},
    uniform3fv: () => {},
    uniform4fv: () => {},
    uniformMatrix3fv: () => {},
    uniformMatrix4fv: () => {},
    uniform2iv: () => {},
    uniform3iv: () => {},
    uniform4iv: () => {},
    getUniformBlockIndex: (_program: object, name: string) =>
      name === 'Globals' ? 0 : 0xffffffff,
    uniformBlockBinding: () => {},

    _shaderSource: shaderSource
  }

  return gl as unknown as WebGL2RenderingContext
}

describe('shaders package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('@clockwork/shaders')
  })
})

describe('shader compiler', () => {
  it('compiles and caches shaders by source', () => {
    const gl = createMockShaderGL()
    const compiler = new ShaderCompiler(gl)

    const vertex = '#version 300 es\nvoid main(){gl_Position=vec4(0.0);}'
    const fragment =
      '#version 300 es\nprecision mediump float; out vec4 o; void main(){o=vec4(1.0);}'

    const a = compiler.compile(vertex, fragment)
    const b = compiler.compile(vertex, fragment)

    expect(a).toBe(b)
    a.setUniform('u_time', 1)
  })

  it('expands includes using resolver', () => {
    const gl = createMockShaderGL()
    const sources: Record<string, string> = {
      'main.vert':
        '#version 300 es\n#include "common.glsl"\nvoid main(){gl_Position=vec4(build());}',
      'main.frag':
        '#version 300 es\nprecision mediump float;out vec4 o;void main(){o=vec4(1.0);}',
      'common.glsl': 'float build(){return 1.0;}'
    }

    const compiler = new ShaderCompiler(gl, {
      includeResolver(path) {
        return sources[path]
      }
    })

    const shader = compiler.compileWithIncludes('main.vert', 'main.frag')
    expect(shader).toBeTruthy()
  })
})
