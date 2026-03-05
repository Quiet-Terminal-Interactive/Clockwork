import { Fixed } from 'qti-clockwork-math'
import { type System, type SystemContext } from 'qti-clockwork-scheduler'
import { World } from 'qti-clockwork-ecs'
import {
  RIGID_BODY,
  COLLIDER,
  STRUCTURAL,
  MATERIAL,
  type RigidBody,
  type Collider,
  type StructuralBody,
  type PhysicsMaterial
} from '../components.js'
import { PhysicsWorld } from '../world.js'
import { buildBroadPhase } from '../collision/broad.js'
import { testCollision } from '../collision/narrow.js'
import { integrateVelocities, integratePositions } from '../solver/integrate.js'
import { evaluateSleep, wakeBody } from '../solver/sleep.js'
import { warmStartManifold } from '../solver/warmstart.js'
import { solveConstraints } from '../solver/impulse.js'
import {
  distributeImpulse,
  propagateStress,
  evaluateFracture,
  applyFracture
} from '../structural/stress.js'
import { floodFillComponents } from '../structural/flood.js'
import {
  buildStructuralBody,
  syncStructuralToRigidBody
} from '../structural/builder.js'
import {
  CollisionStarted,
  CollisionEnded,
  BodyFractured,
  BodySleepChanged
} from '../events.js'
import { type ContactManifold } from '../manifold.js'
import { type ContactConstraint } from '../constraints.js'
import { type EntityId } from 'qti-clockwork-ecs'

interface CommandBuilderLike {
  with(type: unknown, component: unknown): CommandBuilderLike
}

interface PhysicsCommandBufferLike {
  spawn(): CommandBuilderLike
  destroy(entity: EntityId): void
}

export function makePhysicsStepSystem(physicsWorld: PhysicsWorld): System {
  return {
    id: 'physics:step',
    stage: 'FixedUpdate',
    order: 0,
    reads: [RIGID_BODY, COLLIDER, STRUCTURAL, MATERIAL],
    writes: [RIGID_BODY, STRUCTURAL],
    execute(ctx: SystemContext): void {
      // SystemContext.world is WorldLike but always a concrete World in practice.
      // Physics needs full ECS access (component stores, entity iteration).
      const ecs = ctx.world as World
      const pw = physicsWorld
      const dt = Fixed.from(ctx.deltaTime)

      // Step 1: Apply gravity + velocity damping to all awake bodies.
      for (const entity of ecs.entities.iterAlive()) {
        const body = ecs.getComponent(entity, RIGID_BODY) as
          | RigidBody
          | undefined
        if (body) integrateVelocities(body, pw.config, dt)
      }

      // Step 2: Broad phase — rebuild spatial hash, generate candidate pairs.
      const candidates = buildBroadPhase(ecs, pw.spatialHash)

      // Step 3: Narrow phase — generate contact manifolds.
      const freshManifolds: ContactManifold[] = []
      for (const { a, b } of candidates) {
        const bodyA = ecs.getComponent(a, RIGID_BODY) as RigidBody | undefined
        const bodyB = ecs.getComponent(b, RIGID_BODY) as RigidBody | undefined
        const colliderA = ecs.getComponent(a, COLLIDER) as Collider | undefined
        const colliderB = ecs.getComponent(b, COLLIDER) as Collider | undefined
        if (!bodyA || !bodyB || !colliderA || !colliderB) continue

        const manifold = testCollision(a, bodyA, colliderA, b, bodyB, colliderB)
        if (manifold) {
          freshManifolds.push(manifold)
          // Wake sleeping bodies on contact.
          if (bodyA.isSleeping) wakeBody(bodyA)
          if (bodyB.isSleeping) wakeBody(bodyB)
        }
      }

      // Step 4: Warm-start from previous tick's accumulated impulses.
      const freshManifoldKeys = new Set<bigint>()
      for (const m of freshManifolds) {
        const key = pw.manifoldKey(m.entityA, m.entityB)
        freshManifoldKeys.add(key)
        const prev = pw.manifolds.get(key)
        if (prev) {
          const bodyA = ecs.getComponent(m.entityA, RIGID_BODY) as
            | RigidBody
            | undefined
          const bodyB = ecs.getComponent(m.entityB, RIGID_BODY) as
            | RigidBody
            | undefined
          if (bodyA && bodyB) warmStartManifold(m, prev, bodyA, bodyB)
        }
      }

      // Step 5: Solver — sequential impulse over all constraints.
      const contactConstraints: ContactConstraint[] = freshManifolds.map(
        (m) => ({
          type: 'contact',
          manifold: m
        })
      )
      const allConstraints = [...pw.userConstraints, ...contactConstraints]

      solveConstraints(
        allConstraints,
        freshManifolds,
        (idx) => {
          // Find entity by index. The ECS doesn't have an O(1) index→entity lookup
          // without a full scan. This is O(n) per lookup — acceptable while entity
          // counts are reasonable. A dedicated index would fix this.
          for (const entity of ecs.entities.iterAlive()) {
            if (entity.index === idx) {
              return ecs.getComponent(entity, RIGID_BODY) as
                | RigidBody
                | undefined
            }
          }
          return undefined
        },
        pw.config.solverIterations,
        dt
      )

      // Step 6: Integrate velocity → position.
      for (const entity of ecs.entities.iterAlive()) {
        const body = ecs.getComponent(entity, RIGID_BODY) as
          | RigidBody
          | undefined
        if (body) integratePositions(body, dt)
      }

      // Step 7: Stress propagation + fracture for StructuralBodies.
      const fractures: { source: EntityId; fragments: EntityId[] }[] = []
      const commands = ctx.commands as unknown as PhysicsCommandBufferLike

      for (const m of freshManifolds) {
        for (const entity of [m.entityA, m.entityB]) {
          const structural = ecs.getComponent(entity, STRUCTURAL) as
            | StructuralBody
            | undefined
          if (!structural) continue
          for (const pt of m.points) {
            distributeImpulse(
              structural,
              pt.position,
              Fixed.to(pt.normalImpulse)
            )
          }
        }
      }

      for (const entity of ecs.entities.iterAlive()) {
        const structural = ecs.getComponent(entity, STRUCTURAL) as
          | StructuralBody
          | undefined
        if (!structural) continue

        propagateStress(structural)

        const materials = collectMaterials(ecs, structural)
        const { fracturedIndices } = evaluateFracture(structural, materials)
        if (fracturedIndices.length === 0) continue

        applyFracture(structural, fracturedIndices)

        const components = floodFillComponents(
          structural.pixels,
          structural.width,
          structural.height
        )
        if (components.length <= 1) {
          // Still one piece — rebuild mass/hull in place.
          const rebuilt = buildStructuralBody(
            structural.pixels,
            structural.pixelMaterials,
            structural.width,
            structural.height,
            materials
          )
          Object.assign(structural, rebuilt)
          const body = ecs.getComponent(entity, RIGID_BODY) as
            | RigidBody
            | undefined
          if (body) syncStructuralToRigidBody(structural, body)
          continue
        }

        // Multiple components — spawn a fragment entity per component, destroy source.
        const sourceBody = ecs.getComponent(entity, RIGID_BODY) as
          | RigidBody
          | undefined
        const fragmentIds: EntityId[] = []

        for (const component of components) {
          const fragPixels = new Uint8Array(structural.pixels.length)
          const fragMaterials = new Uint8Array(structural.pixelMaterials.length)
          for (const idx of component) {
            fragPixels[idx] = structural.pixels[idx]!
            fragMaterials[idx] = structural.pixelMaterials[idx]!
          }

          const fragStructural = buildStructuralBody(
            fragPixels,
            fragMaterials,
            structural.width,
            structural.height,
            materials
          )

          const fragBody: RigidBody = {
            position: fragStructural.centreOfMass,
            velocity: sourceBody?.velocity ?? {
              x: Fixed.from(0),
              y: Fixed.from(0)
            },
            angle: sourceBody?.angle ?? Fixed.from(0),
            angularVelocity: sourceBody?.angularVelocity ?? Fixed.from(0),
            mass: fragStructural.mass,
            invMass:
              fragStructural.mass === 0
                ? Fixed.from(0)
                : Fixed.div(Fixed.from(1), fragStructural.mass),
            inertia: fragStructural.inertia,
            invInertia:
              fragStructural.inertia === 0
                ? Fixed.from(0)
                : Fixed.div(Fixed.from(1), fragStructural.inertia),
            restitution: sourceBody?.restitution ?? Fixed.from(0.3),
            friction: sourceBody?.friction ?? Fixed.from(0.5),
            linearDamping: sourceBody?.linearDamping ?? Fixed.from(0.01),
            angularDamping: sourceBody?.angularDamping ?? Fixed.from(0.01),
            isStatic: false,
            isSleeping: false,
            sleepTimer: 0
          }

          const fragCollider = {
            shape: {
              type: 'polygon' as const,
              vertices: fragStructural.hullVertices
            },
            offset: { x: Fixed.from(0), y: Fixed.from(0) },
            angle: Fixed.from(0)
          }

          const builder = commands
            .spawn()
            .with(RIGID_BODY, fragBody)
            .with(STRUCTURAL, fragStructural)
            .with(COLLIDER, fragCollider)

          // We can't know the entity ID before flush, so collect after flush.
          // BodyFractured event is emitted after flush in a follow-up system — or
          // we emit it here with a placeholder and let game code reconcile. For now,
          // we track the fracture for event emission post-flush.
          void builder
        }

        fractures.push({ source: entity, fragments: fragmentIds })
        commands.destroy(entity)
      }

      // Step 8: Sleep evaluation.
      for (const entity of ecs.entities.iterAlive()) {
        const body = ecs.getComponent(entity, RIGID_BODY) as
          | RigidBody
          | undefined
        if (!body) continue
        const changed = evaluateSleep(body, pw.config)
        if (changed) {
          // ctx.events typing is EventBusLike; cast to any for emit.
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ;(ctx.events as any).emit?.(
            new BodySleepChanged(entity, body.isSleeping)
          )
        }
      }

      // Step 9: Emit collision events by diffing current and previous manifold sets.
      for (const key of freshManifoldKeys) {
        if (!pw.prevManifoldKeys.has(key)) {
          const m = freshManifolds.find(
            (fm) => pw.manifoldKey(fm.entityA, fm.entityB) === key
          )
          if (m) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(ctx.events as any).emit?.(
              new CollisionStarted(
                m.entityA,
                m.entityB,
                m.points[0]!.position,
                m.points[0]!.normal
              )
            )
          }
        }
      }
      for (const key of pw.prevManifoldKeys) {
        if (!freshManifoldKeys.has(key)) {
          const prev = pw.manifolds.get(key)
          if (prev) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            ;(ctx.events as any).emit?.(
              new CollisionEnded(prev.entityA, prev.entityB)
            )
          }
        }
      }

      // Update persistent manifold state for next tick.
      pw.manifolds.clear()
      for (const m of freshManifolds) {
        pw.manifolds.set(pw.manifoldKey(m.entityA, m.entityB), m)
      }
      pw.prevManifoldKeys.clear()
      for (const key of freshManifoldKeys) {
        pw.prevManifoldKeys.add(key)
      }

      // Emit BodyFractured events. Fragments are not yet resolvable (CommandBuffer not flushed),
      // so we emit with an empty fragments array. Game code wishing to react to fracture
      // can listen and query newly-spawned structural bodies. Full fragment tracking requires
      // deferred entity IDs — a known gap. Phase 20 will fix this. Today is not Phase 20.
      for (const { source } of fractures) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(ctx.events as any).emit?.(new BodyFractured(source, []))
      }
    }
  }
}

function collectMaterials(
  ecs: World,
  _structural: StructuralBody
): PhysicsMaterial[] {
  // Find the first entity with a MATERIAL component — used as the material palette.
  // Structural bodies share material definitions via the pixelMaterials index.
  // A more complete implementation would store materials per-structural-body.
  const mats: PhysicsMaterial[] = []
  for (const entity of ecs.entities.iterAlive()) {
    const m = ecs.getComponent(entity, MATERIAL) as PhysicsMaterial | undefined
    if (m) mats.push(m)
  }
  return mats
}
