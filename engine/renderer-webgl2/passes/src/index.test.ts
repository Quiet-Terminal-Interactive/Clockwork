import { describe, expect, it } from 'vitest'
import type { Texture } from 'qti-clockwork-materials'
import {
  PrimitiveBatch,
  RenderGraph,
  type RenderPass,
  SpriteBatch,
  computeWorldTransforms,
  drawText,
  layoutText,
  packageId,
  screenToWorld,
  updateCameraFollow,
  worldToScreen,
  type Camera2D,
  type Font,
  type Transform2D
} from './index'

function makeTexture(width: number, height: number): Texture {
  return { width, height } as Texture
}

function makeCamera(): Camera2D {
  return {
    position: { x: 10, y: 5 },
    zoom: 2,
    viewport: { x: 0, y: 0, width: 200, height: 100 },
    clearColor: { r: 0, g: 0, b: 0, a: 1 },
    layerMask: -1
  }
}

describe('passes package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-passes')
  })

  it('computes hierarchical world transforms', () => {
    const transforms = new Map<number, Transform2D>([
      [
        1,
        {
          position: { x: 10, y: 0 },
          rotation: 0,
          scale: { x: 1, y: 1 },
          zIndex: 1
        }
      ],
      [
        2,
        {
          position: { x: 5, y: 0 },
          rotation: 0,
          scale: { x: 2, y: 1 },
          zIndex: 2,
          parent: 1
        }
      ]
    ])

    const world = computeWorldTransforms(transforms)
    expect(world.get(2)?.position.x).toBe(15)
    expect(world.get(2)?.scale.x).toBe(2)
    expect(world.get(2)?.zIndex).toBe(3)
  })

  it('converts between world and screen coordinates', () => {
    const camera = makeCamera()
    const screen = worldToScreen(camera, { x: 11, y: 6 })
    const world = screenToWorld(camera, screen)

    expect(world.x).toBeCloseTo(11)
    expect(world.y).toBeCloseTo(6)
  })

  it('rejects invalid camera zoom values', () => {
    const camera = makeCamera()
    camera.zoom = 0
    expect(() => worldToScreen(camera, { x: 0, y: 0 })).toThrow('zoom')
    expect(() => screenToWorld(camera, { x: 0, y: 0 })).toThrow('zoom')
  })

  it('follows a target with smoothing', () => {
    const camera = makeCamera()
    updateCameraFollow(camera, { x: 30, y: 15 }, { speed: 8 }, 1 / 60)
    expect(camera.position.x).toBeGreaterThan(10)
    expect(camera.position.y).toBeGreaterThan(5)
  })

  it('batches sprites by texture and blend mode', () => {
    const camera = makeCamera()
    const textureA = makeTexture(32, 32)
    const textureB = makeTexture(32, 32)

    const batch = new SpriteBatch(8)
    batch.begin(camera)

    const base = {
      position: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      zIndex: 0
    }
    batch.draw(base, {
      texture: textureA,
      tint: { r: 1, g: 1, b: 1, a: 1 },
      pivot: { x: 0, y: 0 },
      flipX: false,
      flipY: false,
      blendMode: 'alpha',
      visible: true
    })
    batch.draw(base, {
      texture: textureA,
      tint: { r: 1, g: 1, b: 1, a: 1 },
      pivot: { x: 0, y: 0 },
      flipX: false,
      flipY: false,
      blendMode: 'alpha',
      visible: true
    })
    batch.draw(base, {
      texture: textureB,
      tint: { r: 1, g: 1, b: 1, a: 1 },
      pivot: { x: 0, y: 0 },
      flipX: false,
      flipY: false,
      blendMode: 'alpha',
      visible: true
    })

    const stats = batch.end()
    expect(stats.spriteCount).toBe(3)
    expect(stats.drawCalls).toBe(2)
    expect(stats.vertexCount).toBe(12)
    expect(stats.indexCount).toBe(18)
  })

  it('rejects sprite capacity above Uint16 index limits', () => {
    expect(() => new SpriteBatch(20_000)).toThrow('Uint16')
  })

  it('lays out wrapped center-aligned text and emits glyph sprites', () => {
    const glyphs = {
      a: {
        char: 'a',
        x: 0,
        y: 0,
        width: 8,
        height: 12,
        xOffset: 0,
        yOffset: 0,
        xAdvance: 8
      },
      b: {
        char: 'b',
        x: 8,
        y: 0,
        width: 8,
        height: 12,
        xOffset: 0,
        yOffset: 0,
        xAdvance: 8
      },
      '?': {
        char: '?',
        x: 16,
        y: 0,
        width: 8,
        height: 12,
        xOffset: 0,
        yOffset: 0,
        xAdvance: 8
      }
    }

    const font = new (class {
      atlas = makeTexture(64, 64)
      glyphs = new Map(Object.entries(glyphs))
      lineHeight = 16
      baseline = 12
      getGlyph(char: string) {
        return this.glyphs.get(char) ?? this.glyphs.get('?')
      }
    })() as unknown as Font

    const text = {
      content: 'aabb',
      font,
      fontSize: 16,
      color: { r: 1, g: 1, b: 1, a: 1 },
      align: 'center' as const,
      wrapWidth: 20
    }

    const layout = layoutText(text)
    expect(layout.lines).toBe(2)

    const batch = new SpriteBatch(16)
    batch.begin(makeCamera())
    drawText(
      batch,
      {
        position: { x: 0, y: 0 },
        rotation: 0,
        scale: { x: 1, y: 1 },
        zIndex: 0
      },
      text
    )

    const stats = batch.end()
    expect(stats.spriteCount).toBe(4)
  })

  it('builds primitive geometry for debug rendering', () => {
    const batch = new PrimitiveBatch()
    batch.drawLine({ x: 0, y: 0 }, { x: 10, y: 0 }, { r: 1, g: 0, b: 0, a: 1 })
    batch.drawRect(
      { x: 0, y: 0, width: 10, height: 5 },
      { r: 0, g: 1, b: 0, a: 1 },
      true
    )
    batch.drawCircle({ x: 0, y: 0 }, 5, { r: 0, g: 0, b: 1, a: 1 }, 8, false)

    const stats = batch.flush()
    expect(stats.vertexCount).toBeGreaterThan(0)
    expect(stats.triangleCount).toBeGreaterThan(0)
  })

  it('compiles and executes render passes in dependency order', () => {
    const graph = new RenderGraph()
    const order: string[] = []

    const passes: RenderPass[] = [
      {
        name: 'scene',
        inputs: [],
        outputs: ['sceneColor'],
        execute() {
          order.push('scene')
        }
      },
      {
        name: 'bloom',
        inputs: ['sceneColor'],
        outputs: ['bloomColor'],
        execute() {
          order.push('bloom')
        }
      },
      {
        name: 'composite',
        inputs: ['sceneColor', 'bloomColor'],
        outputs: ['final'],
        execute() {
          order.push('composite')
        }
      }
    ]

    for (const pass of passes) {
      graph.addPass(pass)
    }

    graph.compile()
    graph.execute()
    expect(order).toEqual(['scene', 'bloom', 'composite'])
  })

  it('rejects duplicate render target producers', () => {
    const graph = new RenderGraph()
    graph.addPass({
      name: 'a',
      inputs: [],
      outputs: ['shared'],
      execute() {}
    })
    graph.addPass({
      name: 'b',
      inputs: [],
      outputs: ['shared'],
      execute() {}
    })

    expect(() => graph.compile()).toThrow('produced by multiple passes')
  })

  it('requires compile before execute when graph has passes', () => {
    const graph = new RenderGraph()
    graph.addPass({
      name: 'a',
      inputs: [],
      outputs: [],
      execute() {}
    })

    expect(() => graph.execute()).toThrow('requires compile')
  })
})

