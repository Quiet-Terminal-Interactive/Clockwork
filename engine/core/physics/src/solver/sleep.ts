import { Fixed, Vec2 } from 'qti-clockwork-math'
import { type RigidBody } from '../components.js'
import { type PhysicsConfig } from '../world.js'

export function evaluateSleep(body: RigidBody, config: PhysicsConfig): boolean {
  if (body.isStatic) return false

  const linSpeedSq = Vec2.lenSq(body.velocity)
  const angSpeedSq = Fixed.mul(body.angularVelocity, body.angularVelocity)
  const linThreshSq = Fixed.mul(
    config.sleepLinearThreshold,
    config.sleepLinearThreshold
  )
  const angThreshSq = Fixed.mul(
    config.sleepAngularThreshold,
    config.sleepAngularThreshold
  )

  const isQuiet = linSpeedSq < linThreshSq && angSpeedSq < angThreshSq

  if (isQuiet) {
    body.sleepTimer += 1
    if (body.sleepTimer >= config.sleepFrameThreshold && !body.isSleeping) {
      body.isSleeping = true
      return true // state changed
    }
  } else {
    if (body.isSleeping) {
      body.isSleeping = false
      body.sleepTimer = 0
      return true // state changed
    }
    body.sleepTimer = 0
  }

  return false
}

export function wakeBody(body: RigidBody): void {
  body.isSleeping = false
  body.sleepTimer = 0
}
