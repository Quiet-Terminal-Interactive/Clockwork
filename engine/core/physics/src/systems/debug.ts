import { Fixed, Vec2 } from 'qti-clockwork-math'
import { type System, type SystemContext } from 'qti-clockwork-scheduler'
import { World } from 'qti-clockwork-ecs'
import {
  RIGID_BODY,
  COLLIDER,
  STRUCTURAL,
  type RigidBody,
  type Collider,
  type StructuralBody
} from '../components.js'
import { PhysicsWorld } from '../world.js'
import { worldSpaceVertices } from '../collision/shapes.js'

/** Debug overlay: draws collider outlines, velocity vectors, contact points, and stress maps. */
export function makePhysicsDebugSystem(physicsWorld: PhysicsWorld): System {
  return {
    id: 'physics:debug',
    stage: 'Render',
    order: 9999,
    reads: [RIGID_BODY, COLLIDER, STRUCTURAL],
    writes: [],
    execute(ctx: SystemContext): void {
      // Silently no-op if no canvas debug API is available — safe in test environments.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const canvas = (ctx as any).debugCanvas as
        | CanvasRenderingContext2D
        | undefined
      if (!canvas) return

      const ecs = ctx.world as World
      const pw = physicsWorld

      for (const entity of ecs.entities.iterAlive()) {
        const body = ecs.getComponent(entity, RIGID_BODY) as
          | RigidBody
          | undefined
        const collider = ecs.getComponent(entity, COLLIDER) as
          | Collider
          | undefined
        if (!body || !collider) continue

        // Collider colour: blue = static, grey = sleeping, green = awake.
        canvas.strokeStyle = body.isStatic
          ? '#4488ff'
          : body.isSleeping
            ? '#888'
            : '#44ff88'
        canvas.lineWidth = 1

        drawCollider(canvas, body, collider)

        // Centre of mass marker.
        canvas.fillStyle = '#ff0'
        canvas.beginPath()
        canvas.arc(body.position.x, body.position.y, 2, 0, Math.PI * 2)
        canvas.fill()

        // Velocity vector from CoM.
        if (!body.isSleeping) {
          const speed = Fixed.to(Vec2.len(body.velocity))
          const scale = 0.1
          canvas.strokeStyle = '#ff8800'
          canvas.beginPath()
          canvas.moveTo(body.position.x, body.position.y)
          canvas.lineTo(
            body.position.x + body.velocity.x * scale,
            body.position.y + body.velocity.y * scale
          )
          canvas.stroke()
          void speed
        }

        // Stress map overlay on structural bodies.
        const structural = ecs.getComponent(entity, STRUCTURAL) as
          | StructuralBody
          | undefined
        if (structural) {
          drawStressMap(canvas, body, structural)
        }
      }

      // Contact points and normals.
      canvas.strokeStyle = '#ff4444'
      canvas.fillStyle = '#ff4444'
      for (const manifold of pw.manifolds.values()) {
        for (const pt of manifold.points) {
          canvas.beginPath()
          canvas.arc(pt.position.x, pt.position.y, 3, 0, Math.PI * 2)
          canvas.fill()

          const normalEnd = Vec2.add(
            pt.position,
            Vec2.scale(pt.normal, Fixed.from(8))
          )
          canvas.beginPath()
          canvas.moveTo(pt.position.x, pt.position.y)
          canvas.lineTo(normalEnd.x, normalEnd.y)
          canvas.stroke()
        }
      }

      // Constraint lines.
      canvas.strokeStyle = '#aa44ff'
      for (const c of pw.userConstraints) {
        if (c.type === 'distance' || c.type === 'joint' || c.type === 'weld') {
          let posA: Vec2 | undefined
          let posB: Vec2 | undefined
          for (const entity of ecs.entities.iterAlive()) {
            const body = ecs.getComponent(entity, RIGID_BODY) as
              | RigidBody
              | undefined
            if (!body) continue
            if (entity.index === c.entityA.index) posA = body.position
            if (entity.index === c.entityB.index) posB = body.position
          }
          if (posA && posB) {
            canvas.beginPath()
            canvas.moveTo(posA.x, posA.y)
            canvas.lineTo(posB.x, posB.y)
            canvas.stroke()
          }
        }
      }
    }
  }
}

function drawCollider(
  canvas: CanvasRenderingContext2D,
  body: RigidBody,
  collider: Collider
): void {
  const shape = collider.shape
  canvas.beginPath()

  if (shape.type === 'circle') {
    canvas.arc(body.position.x, body.position.y, shape.radius, 0, Math.PI * 2)
  } else if (shape.type === 'aabb') {
    const hw = shape.half.x
    const hh = shape.half.y
    canvas.rect(body.position.x - hw, body.position.y - hh, hw * 2, hh * 2)
  } else if (shape.type === 'polygon') {
    const verts = worldSpaceVertices(shape.vertices, body.position, body.angle)
    if (verts.length === 0) return
    canvas.moveTo(verts[0]!.x, verts[0]!.y)
    for (let i = 1; i < verts.length; i++) {
      canvas.lineTo(verts[i]!.x, verts[i]!.y)
    }
    canvas.closePath()
  }

  canvas.stroke()
}

function drawStressMap(
  canvas: CanvasRenderingContext2D,
  body: RigidBody,
  structural: StructuralBody
): void {
  const { pixels, stressMap, width } = structural

  for (let i = 0; i < pixels.length; i++) {
    if (!pixels[i]) continue
    const px = i % width
    const py = Math.floor(i / width)
    // Normalise stress to [0, 1] relative to a rough display maximum.
    const t = Math.min(stressMap[i]! / 100, 1)
    // Green (0) → yellow (0.5) → red (1.0) gradient.
    const r = Math.round(t * 255)
    const g = Math.round((1 - t) * 255)
    canvas.fillStyle = `rgb(${r},${g},0)`
    canvas.fillRect(body.position.x + px, body.position.y + py, 1, 1)
  }
}
