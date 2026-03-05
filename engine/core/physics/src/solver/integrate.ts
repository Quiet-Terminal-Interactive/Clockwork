import { Fixed, Vec2 } from 'qti-clockwork-math'
import { type RigidBody } from '../components.js'
import { type PhysicsConfig } from '../world.js'

export function integrateVelocities(
  body: RigidBody,
  config: PhysicsConfig,
  dt: Fixed
): void {
  if (body.isStatic || body.isSleeping) return

  // Semi-implicit Euler velocity step: apply gravity then damp.
  body.velocity = Vec2.add(body.velocity, Vec2.scale(config.gravity, dt))

  // (1 - damping * dt) is first-order Euler approximation of exponential decay.
  // At fixed tick rates and typical damping values the error is negligible.
  const linFactor = Fixed.sub(Fixed.from(1), Fixed.mul(body.linearDamping, dt))
  const angFactor = Fixed.sub(Fixed.from(1), Fixed.mul(body.angularDamping, dt))

  body.velocity = Vec2.scale(body.velocity, Fixed.max(linFactor, Fixed.from(0)))
  body.angularVelocity = Fixed.mul(
    body.angularVelocity,
    Fixed.max(angFactor, Fixed.from(0))
  )
}

export function integratePositions(body: RigidBody, dt: Fixed): void {
  if (body.isStatic || body.isSleeping) return

  body.position = Vec2.add(body.position, Vec2.scale(body.velocity, dt))
  body.angle = Fixed.add(body.angle, Fixed.mul(body.angularVelocity, dt))
}
