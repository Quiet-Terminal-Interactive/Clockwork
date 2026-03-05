import { Fixed, Vec2 } from 'qti-clockwork-math'
import { type RigidBody } from '../components.js'
import { type ContactManifold, type ContactPoint } from '../manifold.js'

const WARMSTART_MATCH_RADIUS_SQ = Fixed.from(0.01)

// Warm-starting: re-apply accumulated impulses from the previous tick as an initial guess.
// Without this, stacking scenarios require many more solver iterations to converge.
export function warmStartManifold(
  manifold: ContactManifold,
  prevManifold: ContactManifold,
  bodyA: RigidBody,
  bodyB: RigidBody
): void {
  for (const pt of manifold.points) {
    const prev = findMatchingPoint(pt, prevManifold)
    if (!prev) continue

    pt.normalImpulse = prev.normalImpulse
    pt.tangentImpulse = prev.tangentImpulse

    applyContactImpulse(bodyA, bodyB, pt, pt.normalImpulse, pt.tangentImpulse)
  }
}

function findMatchingPoint(
  pt: ContactPoint,
  prev: ContactManifold
): ContactPoint | null {
  for (const pp of prev.points) {
    const dx = Fixed.sub(pt.position.x, pp.position.x)
    const dy = Fixed.sub(pt.position.y, pp.position.y)
    if (
      Fixed.add(Fixed.mul(dx, dx), Fixed.mul(dy, dy)) <
      WARMSTART_MATCH_RADIUS_SQ
    ) {
      return pp
    }
  }
  return null
}

export function applyContactImpulse(
  bodyA: RigidBody,
  bodyB: RigidBody,
  pt: ContactPoint,
  normalLambda: Fixed,
  tangentLambda: Fixed
): void {
  const rA = Vec2.sub(pt.position, bodyA.position)
  const rB = Vec2.sub(pt.position, bodyB.position)
  const n = pt.normal

  const impulse = Vec2.add(
    Vec2.scale(n, normalLambda),
    Vec2.scale(Vec2.perp(n), tangentLambda)
  )

  if (!bodyA.isStatic) {
    bodyA.velocity = Vec2.add(
      bodyA.velocity,
      Vec2.scale(impulse, bodyA.invMass)
    )
    bodyA.angularVelocity = Fixed.add(
      bodyA.angularVelocity,
      Fixed.mul(Vec2.cross(rA, impulse), bodyA.invInertia)
    )
  }

  if (!bodyB.isStatic) {
    bodyB.velocity = Vec2.sub(
      bodyB.velocity,
      Vec2.scale(impulse, bodyB.invMass)
    )
    bodyB.angularVelocity = Fixed.sub(
      bodyB.angularVelocity,
      Fixed.mul(Vec2.cross(rB, impulse), bodyB.invInertia)
    )
  }
}
