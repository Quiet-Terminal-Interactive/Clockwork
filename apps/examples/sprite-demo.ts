import { SpriteBatch, type Camera2D } from '@clockwork/passes'

export function buildSpriteDemo(batch = new SpriteBatch()): number {
  const camera: Camera2D = {
    position: { x: 0, y: 0 },
    zoom: 1,
    viewport: { x: 0, y: 0, width: 800, height: 600 },
    clearColor: { r: 0, g: 0, b: 0, a: 1 },
    layerMask: -1
  }

  batch.begin(camera)
  return batch.end().drawCalls
}
