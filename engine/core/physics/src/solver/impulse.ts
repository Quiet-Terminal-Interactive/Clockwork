import { Fixed, Vec2 } from 'qti-clockwork-math'
import { type RigidBody } from '../components.js'
import { type ContactManifold } from '../manifold.js'
import {
  type Constraint,
  type JointConstraint,
  type DistanceConstraint,
  type WeldConstraint
} from '../constraints.js'
import { applyContactImpulse } from './warmstart.js'

// Baumgarte position correction factor: fraction of position error corrected per tick.
// Too high causes jitter; too low causes sinking. 0.2 is a common sweet spot.
const BAUMGARTE = Fixed.from(0.2)
const SLOP = Fixed.from(0.005)

export function solveConstraints(
  constraints: Constraint[],
  manifolds: ContactManifold[],
  getBody: (entityIndex: number) => RigidBody | undefined,
  iterations: number,
  dt: Fixed
): void {
  for (let iter = 0; iter < iterations; iter++) {
    for (const manifold of manifolds) {
      solveContact(manifold, getBody, dt)
    }
    for (const c of constraints) {
      switch (c.type) {
        case 'contact':
          solveContact(c.manifold, getBody, dt)
          break
        case 'joint':
          solveJoint(c, getBody, dt)
          break
        case 'distance':
          solveDistance(c, getBody)
          break
        case 'weld':
          solveWeld(c, getBody, dt)
          break
      }
    }
  }
}

function solveContact(
  manifold: ContactManifold,
  getBody: (i: number) => RigidBody | undefined,
  _dt: Fixed
): void {
  const bodyA = getBody(manifold.entityA.index)
  const bodyB = getBody(manifold.entityB.index)
  if (!bodyA || !bodyB) return

  for (const pt of manifold.points) {
    const rA = Vec2.sub(pt.position, bodyA.position)
    const rB = Vec2.sub(pt.position, bodyB.position)
    const n = pt.normal

    // Relative velocity at contact point: v_rel = (vA + wA×rA) - (vB + wB×rB)
    const vA = Vec2.add(
      bodyA.velocity,
      Vec2.scale(Vec2.perp(rA), bodyA.angularVelocity)
    )
    const vB = Vec2.add(
      bodyB.velocity,
      Vec2.scale(Vec2.perp(rB), bodyB.angularVelocity)
    )
    const vRel = Vec2.sub(vA, vB)
    const vn = Vec2.dot(vRel, n)

    if (vn > 0) continue // separating — no impulse needed

    // Effective mass along normal:
    // k = invMassA + invMassB + cross(rA,n)² * invInertiaA + cross(rB,n)² * invInertiaB
    // This is the inverse of the combined translational+rotational inertia on the constraint axis.
    const rACrossN = Vec2.cross(rA, n)
    const rBCrossN = Vec2.cross(rB, n)
    const k = Fixed.add(
      Fixed.add(bodyA.invMass, bodyB.invMass),
      Fixed.add(
        Fixed.mul(Fixed.mul(rACrossN, rACrossN), bodyA.invInertia),
        Fixed.mul(Fixed.mul(rBCrossN, rBCrossN), bodyB.invInertia)
      )
    )

    if (k === 0) continue

    const restitution = Fixed.min(bodyA.restitution, bodyB.restitution)
    const lambda = Fixed.div(
      Fixed.neg(
        Fixed.add(
          Fixed.mul(Fixed.add(Fixed.from(1), restitution), vn),
          Fixed.from(0)
        )
      ),
      k
    )

    // Clamp accumulated normal impulse to [0, +∞) — no pulling bodies together.
    const prevNormal = pt.normalImpulse
    pt.normalImpulse = Fixed.max(
      Fixed.add(pt.normalImpulse, lambda),
      Fixed.from(0)
    )
    const deltaLambda = Fixed.sub(pt.normalImpulse, prevNormal)

    applyContactImpulse(bodyA, bodyB, pt, deltaLambda, Fixed.from(0))

    // Friction: Coulomb clamp |tangentImpulse| ≤ friction * normalImpulse.
    const friction = Fixed.mul(
      Fixed.from(
        Math.sqrt(Fixed.to(bodyA.friction) * Fixed.to(bodyB.friction))
      ),
      Fixed.from(1)
    )
    const tangent = Vec2.perp(n)
    const vt = Vec2.dot(vRel, tangent)
    const kT = Fixed.add(
      Fixed.add(bodyA.invMass, bodyB.invMass),
      Fixed.add(
        Fixed.mul(
          Fixed.mul(Vec2.cross(rA, tangent), Vec2.cross(rA, tangent)),
          bodyA.invInertia
        ),
        Fixed.mul(
          Fixed.mul(Vec2.cross(rB, tangent), Vec2.cross(rB, tangent)),
          bodyB.invInertia
        )
      )
    )
    if (kT === 0) continue

    const tLambda = Fixed.div(Fixed.neg(vt), kT)
    const maxFriction = Fixed.mul(friction, pt.normalImpulse)
    const prevTangent = pt.tangentImpulse
    pt.tangentImpulse = Fixed.clamp(
      Fixed.add(pt.tangentImpulse, tLambda),
      Fixed.neg(maxFriction),
      maxFriction
    )
    const deltaTLambda = Fixed.sub(pt.tangentImpulse, prevTangent)
    applyContactImpulse(bodyA, bodyB, pt, Fixed.from(0), deltaTLambda)
  }
}

function solveJoint(
  c: JointConstraint,
  getBody: (i: number) => RigidBody | undefined,
  dt: Fixed
): void {
  const bodyA = getBody(c.entityA.index)
  const bodyB = getBody(c.entityB.index)
  if (!bodyA || !bodyB) return

  // World-space anchor points.
  const worldA = Vec2.add(bodyA.position, Vec2.rotate(c.anchorA, bodyA.angle))
  const worldB = Vec2.add(bodyB.position, Vec2.rotate(c.anchorB, bodyB.angle))
  const err = Vec2.sub(worldA, worldB)
  const dist = Vec2.len(err)
  if (dist === 0) return

  const n = Vec2.norm(err)
  const rA = Vec2.sub(worldA, bodyA.position)
  const rB = Vec2.sub(worldB, bodyB.position)

  // Baumgarte stabilisation: add a bias velocity proportional to the position error.
  const bias = Fixed.mul(Fixed.div(BAUMGARTE, dt), Fixed.sub(dist, SLOP))
  const rACrossN = Vec2.cross(rA, n)
  const rBCrossN = Vec2.cross(rB, n)
  const k = Fixed.add(
    Fixed.add(bodyA.invMass, bodyB.invMass),
    Fixed.add(
      Fixed.mul(Fixed.mul(rACrossN, rACrossN), bodyA.invInertia),
      Fixed.mul(Fixed.mul(rBCrossN, rBCrossN), bodyB.invInertia)
    )
  )
  if (k === 0) return

  const vA = Vec2.add(
    bodyA.velocity,
    Vec2.scale(Vec2.perp(rA), bodyA.angularVelocity)
  )
  const vB = Vec2.add(
    bodyB.velocity,
    Vec2.scale(Vec2.perp(rB), bodyB.angularVelocity)
  )
  const vRel = Vec2.dot(Vec2.sub(vA, vB), n)
  const lambda = Fixed.div(Fixed.neg(Fixed.add(vRel, bias)), k)

  if (!bodyA.isStatic) {
    bodyA.velocity = Vec2.add(
      bodyA.velocity,
      Vec2.scale(n, Fixed.mul(lambda, bodyA.invMass))
    )
    bodyA.angularVelocity = Fixed.add(
      bodyA.angularVelocity,
      Fixed.mul(Fixed.mul(rACrossN, lambda), bodyA.invInertia)
    )
  }
  if (!bodyB.isStatic) {
    bodyB.velocity = Vec2.sub(
      bodyB.velocity,
      Vec2.scale(n, Fixed.mul(lambda, bodyB.invMass))
    )
    bodyB.angularVelocity = Fixed.sub(
      bodyB.angularVelocity,
      Fixed.mul(Fixed.mul(rBCrossN, lambda), bodyB.invInertia)
    )
  }
}

function solveDistance(
  c: DistanceConstraint,
  getBody: (i: number) => RigidBody | undefined
): void {
  const bodyA = getBody(c.entityA.index)
  const bodyB = getBody(c.entityB.index)
  if (!bodyA || !bodyB) return

  const worldA = Vec2.add(bodyA.position, Vec2.rotate(c.anchorA, bodyA.angle))
  const worldB = Vec2.add(bodyB.position, Vec2.rotate(c.anchorB, bodyB.angle))
  const d = Vec2.sub(worldB, worldA)
  const dist = Vec2.len(d)
  if (dist === 0) return

  const error = Fixed.sub(dist, c.restLength)
  if (error === 0) return

  const n = Vec2.norm(d)
  const rA = Vec2.sub(worldA, bodyA.position)
  const rB = Vec2.sub(worldB, bodyB.position)
  const rACrossN = Vec2.cross(rA, n)
  const rBCrossN = Vec2.cross(rB, n)
  const k = Fixed.add(
    Fixed.add(bodyA.invMass, bodyB.invMass),
    Fixed.add(
      Fixed.mul(Fixed.mul(rACrossN, rACrossN), bodyA.invInertia),
      Fixed.mul(Fixed.mul(rBCrossN, rBCrossN), bodyB.invInertia)
    )
  )
  if (k === 0) return

  const vA = Vec2.dot(
    Vec2.add(bodyA.velocity, Vec2.scale(Vec2.perp(rA), bodyA.angularVelocity)),
    n
  )
  const vB = Vec2.dot(
    Vec2.add(bodyB.velocity, Vec2.scale(Vec2.perp(rB), bodyB.angularVelocity)),
    n
  )
  const vRel = Fixed.sub(vA, vB)

  const lambda = Fixed.mul(Fixed.div(Fixed.neg(vRel), k), c.stiffness)

  if (!bodyA.isStatic) {
    bodyA.velocity = Vec2.sub(
      bodyA.velocity,
      Vec2.scale(n, Fixed.mul(lambda, bodyA.invMass))
    )
    bodyA.angularVelocity = Fixed.sub(
      bodyA.angularVelocity,
      Fixed.mul(Fixed.mul(rACrossN, lambda), bodyA.invInertia)
    )
  }
  if (!bodyB.isStatic) {
    bodyB.velocity = Vec2.add(
      bodyB.velocity,
      Vec2.scale(n, Fixed.mul(lambda, bodyB.invMass))
    )
    bodyB.angularVelocity = Fixed.add(
      bodyB.angularVelocity,
      Fixed.mul(Fixed.mul(rBCrossN, lambda), bodyB.invInertia)
    )
  }
}

function solveWeld(
  c: WeldConstraint,
  getBody: (i: number) => RigidBody | undefined,
  dt: Fixed
): void {
  // Weld is a joint that also corrects relative angle via Baumgarte.
  solveJoint(
    {
      type: 'joint',
      entityA: c.entityA,
      entityB: c.entityB,
      anchorA: c.anchorA,
      anchorB: c.anchorB
    },
    getBody,
    dt
  )

  const bodyA = getBody(c.entityA.index)
  const bodyB = getBody(c.entityB.index)
  if (!bodyA || !bodyB) return

  const angleErr = Fixed.sub(Fixed.sub(bodyB.angle, bodyA.angle), c.refAngle)
  const kRot = Fixed.add(bodyA.invInertia, bodyB.invInertia)
  if (kRot === 0) return

  const bias = Fixed.mul(Fixed.div(BAUMGARTE, dt), angleErr)
  const vRelRot = Fixed.sub(bodyB.angularVelocity, bodyA.angularVelocity)
  const lambdaRot = Fixed.div(Fixed.neg(Fixed.add(vRelRot, bias)), kRot)

  if (!bodyA.isStatic) {
    bodyA.angularVelocity = Fixed.sub(
      bodyA.angularVelocity,
      Fixed.mul(lambdaRot, bodyA.invInertia)
    )
  }
  if (!bodyB.isStatic) {
    bodyB.angularVelocity = Fixed.add(
      bodyB.angularVelocity,
      Fixed.mul(lambdaRot, bodyB.invInertia)
    )
  }
}
