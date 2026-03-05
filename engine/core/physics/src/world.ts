import { Fixed, Vec2 } from 'qti-clockwork-math'
import { type EntityId } from 'qti-clockwork-ecs'
import { type ContactManifold } from './manifold.js'
import { type Constraint } from './constraints.js'
import { type AABB } from 'qti-clockwork-math'

export interface PhysicsConfig {
  gravity: Vec2
  solverIterations: number
  sleepLinearThreshold: Fixed
  sleepAngularThreshold: Fixed
  sleepFrameThreshold: number
  spatialHashCellSize: number
}

export const DEFAULT_PHYSICS_CONFIG: PhysicsConfig = {
  gravity: Vec2.create(Fixed.from(0), Fixed.from(-9.81)),
  solverIterations: 8,
  sleepLinearThreshold: Fixed.from(0.01),
  sleepAngularThreshold: Fixed.from(0.01),
  sleepFrameThreshold: 60,
  spatialHashCellSize: 64
}

/** Flat spatial hash mapping cell coordinates to resident entity lists. */
export class SpatialHash {
  private readonly cells = new Map<number, EntityId[]>()

  constructor(private readonly cellSize: number) {}

  insert(entity: EntityId, aabb: AABB): void {
    for (const key of this.cellsForAABB(aabb)) {
      let bucket = this.cells.get(key)
      if (!bucket) {
        bucket = []
        this.cells.set(key, bucket)
      }
      bucket.push(entity)
    }
  }

  query(aabb: AABB): EntityId[] {
    const result: EntityId[] = []
    const seen = new Set<number>()
    for (const key of this.cellsForAABB(aabb)) {
      const bucket = this.cells.get(key)
      if (!bucket) continue
      for (const entity of bucket) {
        // Entity index is a stable small integer — good enough as a dedup key.
        if (!seen.has(entity.index)) {
          seen.add(entity.index)
          result.push(entity)
        }
      }
    }
    return result
  }

  clear(): void {
    this.cells.clear()
  }

  private cellsForAABB(aabb: AABB): number[] {
    const cs = this.cellSize
    const minCX = Math.floor(aabb.min.x / cs)
    const minCY = Math.floor(aabb.min.y / cs)
    const maxCX = Math.floor(aabb.max.x / cs)
    const maxCY = Math.floor(aabb.max.y / cs)

    const keys: number[] = []
    for (let cx = minCX; cx <= maxCX; cx++) {
      for (let cy = minCY; cy <= maxCY; cy++) {
        keys.push(this.cellKey(cx, cy))
      }
    }
    return keys
  }

  // Pack two 16-bit signed cell coordinates into one 32-bit JS number.
  // Handles worlds up to ±32768 cells (at default cell size 64: ±2M world units).
  private cellKey(cx: number, cy: number): number {
    return ((cx & 0xffff) | ((cy & 0xffff) << 16)) >>> 0
  }
}

/** The physics simulation state: config, spatial index, manifolds, and user constraints. */
export class PhysicsWorld {
  readonly config: PhysicsConfig
  readonly spatialHash: SpatialHash

  // Manifolds persist between ticks for warm-starting and CollisionEnded detection.
  // Key = BigInt(loIndex) << 32n | BigInt(hiIndex), where loIndex < hiIndex.
  readonly manifolds = new Map<bigint, ContactManifold>()
  readonly prevManifoldKeys = new Set<bigint>()

  // Contact constraints are rebuilt each tick from manifolds — not stored here.
  // Only user-placed joints, ropes, and welds live in this list.
  readonly userConstraints: Constraint[] = []

  constructor(config: Partial<PhysicsConfig> = {}) {
    this.config = { ...DEFAULT_PHYSICS_CONFIG, ...config }
    this.spatialHash = new SpatialHash(this.config.spatialHashCellSize)
  }

  manifoldKey(a: EntityId, b: EntityId): bigint {
    const lo = a.index < b.index ? a.index : b.index
    const hi = a.index < b.index ? b.index : a.index
    return (BigInt(lo) << 32n) | BigInt(hi)
  }
}

export const PHYSICS_WORLD_KEY = 'physics:world'
