import { describe, expect, it } from 'vitest'
import { GLState, RendererContext, packageId } from './index'

function createMockGL(): WebGL2RenderingContext {
  const calls: Record<string, number> = {}

  const bump = (name: string): void => {
    calls[name] = (calls[name] ?? 0) + 1
  }

  const gl = {
    TRIANGLES: 0x0004,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
    BLEND: 0x0be2,
    DEPTH_TEST: 0x0b71,
    CULL_FACE: 0x0b44,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    ONE: 1,
    TEXTURE0: 0x84c0,
    TEXTURE_2D: 0x0de1,

    viewport: () => bump('viewport'),
    clearColor: () => bump('clearColor'),
    clear: () => bump('clear'),
    drawArrays: () => bump('drawArrays'),
    getError: () => 0,
    bindVertexArray: () => bump('bindVertexArray'),
    useProgram: () => bump('useProgram'),
    disable: () => bump('disable'),
    enable: () => bump('enable'),
    blendFunc: () => bump('blendFunc'),
    activeTexture: () => bump('activeTexture'),
    bindTexture: () => bump('bindTexture'),

    _calls: calls
  }

  return gl as unknown as WebGL2RenderingContext
}

describe('gl package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-gl')
  })
})

describe('renderer context', () => {
  it('throws when WebGL2 is unavailable', () => {
    const canvas = {
      width: 640,
      height: 360,
      getContext: () => null
    } as unknown as HTMLCanvasElement

    const context = new RendererContext()
    expect(() => context.init(canvas)).toThrow('WebGL2 is unavailable')
  })

  it('throws when calling methods before init', () => {
    const context = new RendererContext()
    expect(() => context.setClearColor(0, 0, 0, 1)).toThrow(
      'not been initialized'
    )
    expect(() => context.clear()).toThrow('not been initialized')
    expect(() => context.drawTriangles(3)).toThrow('not been initialized')
    expect(() => context.getError()).toThrow('not been initialized')
  })

  it('shuts down gracefully even if not initialized', () => {
    const context = new RendererContext()
    expect(() => context.shutdown()).not.toThrow()
  })

  it('initializes and issues draw calls', () => {
    const gl = createMockGL()
    const canvas = {
      width: 640,
      height: 360,
      getContext: () => gl
    } as unknown as HTMLCanvasElement

    const context = new RendererContext()
    context.init(canvas)
    context.setClearColor(0, 0, 0, 1)
    context.clear()
    context.drawTriangles(3)

    const calls = (gl as unknown as { _calls: Record<string, number> })._calls
    expect(calls.viewport).toBe(1)
    expect(calls.clearColor).toBe(1)
    expect(calls.clear).toBe(1)
    expect(calls.drawArrays).toBe(1)
  })
})

describe('gl state cache', () => {
  it('skips redundant state changes', () => {
    const gl = createMockGL()
    const state = new GLState(gl)

    state.setBlendMode('alpha')
    state.setBlendMode('alpha')

    state.setDepthTest(true)
    state.setDepthTest(true)

    const texture = {} as WebGLTexture
    state.bindTexture(0, texture)
    state.bindTexture(0, texture)

    const calls = (gl as unknown as { _calls: Record<string, number> })._calls
    expect(calls.enable).toBe(2)
    expect(calls.blendFunc).toBe(1)
    expect(calls.activeTexture).toBe(1)
  })
})

