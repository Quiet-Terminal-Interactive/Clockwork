import { AABB } from 'qti-clockwork-math'
import { type EntityId } from 'qti-clockwork-ecs'
import {
  type RigidBody,
  type Collider,
  RIGID_BODY,
  COLLIDER
} from '../components.js'
import { SpatialHash } from '../world.js'
import { computeAABBForShape } from './shapes.js'
import { type World } from 'qti-clockwork-ecs'

export interface CandidatePair {
  a: EntityId
  b: EntityId
}

export function buildBroadPhase(
  world: World,
  hash: SpatialHash
): CandidatePair[] {
  // Per-frame full hash rebuild: simpler than incremental dirty tracking.
  // If this becomes a hotspot on very large worlds, that's a problem for future-us.
  hash.clear()

  const awakeEntities: EntityId[] = []
  const aabbCache = new Map<number, AABB>()

  for (const entity of world.entities.iterAlive()) {
    const body = world.getComponent(entity, RIGID_BODY) as RigidBody | undefined
    const collider = world.getComponent(entity, COLLIDER) as
      | Collider
      | undefined
    if (!body || !collider || body.isSleeping) continue

    const aabb = computeAABBForShape(collider.shape, body.position, body.angle)
    hash.insert(entity, aabb)
    aabbCache.set(entity.index, aabb)
    awakeEntities.push(entity)
  }

  const pairs: CandidatePair[] = []
  for (const a of awakeEntities) {
    const aabbA = aabbCache.get(a.index)!
    const candidates = hash.query(aabbA)
    for (const b of candidates) {
      // Only emit each pair once (lower index first) and skip self.
      if (b.index <= a.index) continue
      const aabbB = aabbCache.get(b.index)
      if (!aabbB) continue
      if (AABB.overlaps(aabbA, aabbB)) {
        pairs.push({ a, b })
      }
    }
  }

  return pairs
}
