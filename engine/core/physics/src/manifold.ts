import { type Fixed } from 'qti-clockwork-math'
import { type Vec2 } from 'qti-clockwork-math'
import { type EntityId } from 'qti-clockwork-ecs'

export interface ContactPoint {
  position: Vec2
  normal: Vec2
  penetration: Fixed
  // Cached impulses for warm-starting — zero on first contact, persisted across ticks.
  normalImpulse: Fixed
  tangentImpulse: Fixed
}

export interface ContactManifold {
  entityA: EntityId
  entityB: EntityId
  points: [ContactPoint] | [ContactPoint, ContactPoint]
}
