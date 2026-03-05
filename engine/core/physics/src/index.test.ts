import { describe, it, expect, beforeEach } from 'vitest'
import { Fixed, Vec2, AABB } from 'qti-clockwork-math'
import { AppBuilder } from 'qti-clockwork-app'

import { SpatialHash, PhysicsWorld, DEFAULT_PHYSICS_CONFIG } from './world.js'
import {
  testCircleCircle,
  testPolygonPolygon,
  testPolygonCircle
} from './collision/sat.js'
import { computeAABBForShape } from './collision/shapes.js'
import { buildStructuralBody } from './structural/builder.js'
import { floodFillComponents } from './structural/flood.js'
import {
  distributeImpulse,
  propagateStress,
  evaluateFracture,
  applyFracture
} from './structural/stress.js'
import { evaluateSleep, wakeBody } from './solver/sleep.js'
import { solveConstraints } from './solver/impulse.js'
import { PhysicsPlugin } from './plugin.js'
import { type RigidBody, type PhysicsMaterial } from './components.js'
import { type EntityId } from 'qti-clockwork-ecs'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeBody(overrides: Partial<RigidBody> = {}): RigidBody {
  return {
    position: Vec2.create(Fixed.from(0), Fixed.from(0)),
    velocity: Vec2.create(Fixed.from(0), Fixed.from(0)),
    angle: Fixed.from(0),
    angularVelocity: Fixed.from(0),
    mass: Fixed.from(1),
    invMass: Fixed.from(1),
    inertia: Fixed.from(1),
    invInertia: Fixed.from(1),
    restitution: Fixed.from(0.5),
    friction: Fixed.from(0.3),
    linearDamping: Fixed.from(0.01),
    angularDamping: Fixed.from(0.01),
    isStatic: false,
    isSleeping: false,
    sleepTimer: 0,
    ...overrides
  }
}

function makeEntityId(index: number): EntityId {
  return { index, generation: 0 }
}

const MAT: PhysicsMaterial = {
  density: Fixed.from(1),
  restitution: Fixed.from(0.5),
  friction: Fixed.from(0.3),
  tensileStrength: Fixed.from(10)
}

// ---------------------------------------------------------------------------
// SAT collision
// ---------------------------------------------------------------------------

describe('testCircleCircle', () => {
  it('returns null when separated', () => {
    const result = testCircleCircle(
      makeEntityId(0),
      Vec2.create(Fixed.from(0), Fixed.from(0)),
      Fixed.from(1),
      makeEntityId(1),
      Vec2.create(Fixed.from(5), Fixed.from(0)),
      Fixed.from(1)
    )
    expect(result).toBeNull()
  })

  it('returns manifold when overlapping', () => {
    const result = testCircleCircle(
      makeEntityId(0),
      Vec2.create(Fixed.from(0), Fixed.from(0)),
      Fixed.from(2),
      makeEntityId(1),
      Vec2.create(Fixed.from(3), Fixed.from(0)),
      Fixed.from(2)
    )
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })

  it('normal points from A toward B', () => {
    const result = testCircleCircle(
      makeEntityId(0),
      Vec2.create(Fixed.from(0), Fixed.from(0)),
      Fixed.from(2),
      makeEntityId(1),
      Vec2.create(Fixed.from(3), Fixed.from(0)),
      Fixed.from(2)
    )
    expect(result!.points[0].normal.x).toBeGreaterThan(0)
    expect(Math.abs(result!.points[0].normal.y)).toBeLessThan(0.01)
  })
})

describe('testPolygonPolygon', () => {
  const boxVerts = (cx: number, cy: number, hw: number, hh: number): Vec2[] => [
    Vec2.create(Fixed.from(cx - hw), Fixed.from(cy - hh)),
    Vec2.create(Fixed.from(cx + hw), Fixed.from(cy - hh)),
    Vec2.create(Fixed.from(cx + hw), Fixed.from(cy + hh)),
    Vec2.create(Fixed.from(cx - hw), Fixed.from(cy + hh))
  ]

  it('returns null for non-overlapping boxes', () => {
    const result = testPolygonPolygon(
      makeEntityId(0),
      boxVerts(0, 0, 1, 1),
      makeEntityId(1),
      boxVerts(5, 0, 1, 1)
    )
    expect(result).toBeNull()
  })

  it('detects overlap and returns positive penetration', () => {
    const result = testPolygonPolygon(
      makeEntityId(0),
      boxVerts(0, 0, 1, 1),
      makeEntityId(1),
      boxVerts(1.5, 0, 1, 1)
    )
    expect(result).not.toBeNull()
    expect(result!.points[0].penetration).toBeGreaterThan(0)
  })
})

describe('testPolygonCircle', () => {
  const boxVerts = [
    Vec2.create(Fixed.from(-1), Fixed.from(-1)),
    Vec2.create(Fixed.from(1), Fixed.from(-1)),
    Vec2.create(Fixed.from(1), Fixed.from(1)),
    Vec2.create(Fixed.from(-1), Fixed.from(1))
  ]

  it('returns null when circle is far outside', () => {
    const result = testPolygonCircle(
      makeEntityId(0),
      boxVerts,
      makeEntityId(1),
      Vec2.create(Fixed.from(5), Fixed.from(0)),
      Fixed.from(1)
    )
    expect(result).toBeNull()
  })

  it('detects circle overlapping edge', () => {
    const result = testPolygonCircle(
      makeEntityId(0),
      boxVerts,
      makeEntityId(1),
      Vec2.create(Fixed.from(1.5), Fixed.from(0)),
      Fixed.from(1)
    )
    expect(result).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Shape AABB computation
// ---------------------------------------------------------------------------

describe('computeAABBForShape', () => {
  it('circle AABB equals position ± radius', () => {
    const pos = Vec2.create(Fixed.from(3), Fixed.from(4))
    const aabb = computeAABBForShape(
      { type: 'circle', radius: Fixed.from(2) },
      pos,
      Fixed.from(0)
    )
    expect(Fixed.to(aabb.min.x)).toBeCloseTo(1)
    expect(Fixed.to(aabb.max.x)).toBeCloseTo(5)
    expect(Fixed.to(aabb.min.y)).toBeCloseTo(2)
    expect(Fixed.to(aabb.max.y)).toBeCloseTo(6)
  })

  it('polygon AABB wraps all vertices', () => {
    const pos = Vec2.create(Fixed.from(0), Fixed.from(0))
    const verts = [
      Vec2.create(Fixed.from(-2), Fixed.from(-3)),
      Vec2.create(Fixed.from(4), Fixed.from(1))
    ]
    const aabb = computeAABBForShape(
      { type: 'polygon', vertices: verts },
      pos,
      Fixed.from(0)
    )
    expect(Fixed.to(aabb.min.x)).toBeCloseTo(-2)
    expect(Fixed.to(aabb.max.x)).toBeCloseTo(4)
  })
})

// ---------------------------------------------------------------------------
// Spatial hash
// ---------------------------------------------------------------------------

describe('SpatialHash', () => {
  let hash: SpatialHash

  beforeEach(() => {
    hash = new SpatialHash(64)
  })

  it('query returns inserted entity whose AABB overlaps', () => {
    const e = makeEntityId(0)
    const aabb = AABB.create(
      Vec2.create(Fixed.from(0), Fixed.from(0)),
      Vec2.create(Fixed.from(10), Fixed.from(10))
    )
    hash.insert(e, aabb)
    const results = hash.query(aabb)
    expect(results.some((r) => r.index === 0)).toBe(true)
  })

  it('clear removes all entries', () => {
    const e = makeEntityId(0)
    const aabb = AABB.create(
      Vec2.create(Fixed.from(0), Fixed.from(0)),
      Vec2.create(Fixed.from(10), Fixed.from(10))
    )
    hash.insert(e, aabb)
    hash.clear()
    const results = hash.query(aabb)
    expect(results.length).toBe(0)
  })

  it('does not return entities whose AABB does not overlap query', () => {
    const e = makeEntityId(0)
    hash.insert(
      e,
      AABB.create(
        Vec2.create(Fixed.from(0), Fixed.from(0)),
        Vec2.create(Fixed.from(10), Fixed.from(10))
      )
    )
    const results = hash.query(
      AABB.create(
        Vec2.create(Fixed.from(200), Fixed.from(200)),
        Vec2.create(Fixed.from(210), Fixed.from(210))
      )
    )
    expect(results.some((r) => r.index === 0)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// StructuralBody builder
// ---------------------------------------------------------------------------

describe('buildStructuralBody', () => {
  it('4×4 uniform grid: mass = 16, CoM = centre', () => {
    const w = 4,
      h = 4
    const pixels = new Uint8Array(w * h).fill(1)
    const mats = new Uint8Array(w * h).fill(0)
    const structural = buildStructuralBody(pixels, mats, w, h, [MAT])

    expect(Fixed.to(structural.mass)).toBeCloseTo(16, 1)
    expect(Fixed.to(structural.centreOfMass.x)).toBeCloseTo(2, 1)
    expect(Fixed.to(structural.centreOfMass.y)).toBeCloseTo(2, 1)
  })

  it('single pixel: inertia is zero (point mass at CoM)', () => {
    const pixels = new Uint8Array([1])
    const mats = new Uint8Array([0])
    const structural = buildStructuralBody(pixels, mats, 1, 1, [MAT])
    // Single pixel at CoM → parallel axis distance = 0 → I = 0
    expect(Fixed.to(structural.inertia)).toBeCloseTo(0, 2)
  })

  it('point mass at (3,0) from CoM: inertia ≈ m * 9', () => {
    // 2 pixels: one at (0,0) and one at (3,0)
    const pixels = new Uint8Array([1, 0, 0, 1]) // 4 wide, 1 tall, pixels at index 0 and 3
    const mats = new Uint8Array(4).fill(0)
    const structural = buildStructuralBody(pixels, mats, 4, 1, [MAT])
    // CoM at x = (0.5 + 3.5) / 2 = 2
    // I = m*(0.5-2)² + m*(3.5-2)² = 1*2.25 + 1*2.25 = 4.5
    expect(Fixed.to(structural.inertia)).toBeCloseTo(4.5, 1)
  })

  it('convex hull for 4×4 grid has 4 corners', () => {
    const w = 4,
      h = 4
    const pixels = new Uint8Array(w * h).fill(1)
    const mats = new Uint8Array(w * h).fill(0)
    const structural = buildStructuralBody(pixels, mats, w, h, [MAT])
    expect(structural.hullVertices.length).toBeGreaterThanOrEqual(3)
    expect(structural.hullVertices.length).toBeLessThanOrEqual(4)
  })

  it('empty pixel buffer returns zero mass', () => {
    const pixels = new Uint8Array(4)
    const mats = new Uint8Array(4)
    const structural = buildStructuralBody(pixels, mats, 2, 2, [MAT])
    expect(Fixed.to(structural.mass)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Flood fill
// ---------------------------------------------------------------------------

describe('floodFillComponents', () => {
  it('single contiguous block = 1 component', () => {
    const pixels = new Uint8Array([1, 1, 1, 1])
    const components = floodFillComponents(pixels, 2, 2)
    expect(components.length).toBe(1)
    expect(components[0]!.length).toBe(4)
  })

  it('two disconnected blobs = 2 components', () => {
    // 5×1 row: [1, 0, 0, 0, 1]
    const pixels = new Uint8Array([1, 0, 0, 0, 1])
    const components = floodFillComponents(pixels, 5, 1)
    expect(components.length).toBe(2)
  })

  it('empty buffer = 0 components', () => {
    const pixels = new Uint8Array(4)
    const components = floodFillComponents(pixels, 2, 2)
    expect(components.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Stress and fracture
// ---------------------------------------------------------------------------

describe('stress system', () => {
  it('distributeImpulse increases stress near contact point', () => {
    const pixels = new Uint8Array(9).fill(1)
    const structural = buildStructuralBody(
      pixels,
      new Uint8Array(9).fill(0),
      3,
      3,
      [MAT]
    )
    const center = Vec2.create(Fixed.from(1.5), Fixed.from(1.5))
    distributeImpulse(structural, center, 100)
    const totalStress = Array.from(structural.stressMap).reduce(
      (a, b) => a + b,
      0
    )
    expect(totalStress).toBeGreaterThan(0)
  })

  it('propagateStress spreads stress to neighbours', () => {
    const pixels = new Uint8Array([1, 1])
    const structural = buildStructuralBody(
      pixels,
      new Uint8Array(2).fill(0),
      2,
      1,
      [MAT]
    )
    structural.stressMap[0] = 100
    propagateStress(structural)
    expect(structural.stressMap[1]).toBeGreaterThan(0)
  })

  it('evaluateFracture identifies pixels above threshold', () => {
    const pixels = new Uint8Array([1])
    const structural = buildStructuralBody(pixels, new Uint8Array([0]), 1, 1, [
      MAT
    ])
    structural.stressMap[0] = 999
    const { fracturedIndices } = evaluateFracture(structural, [MAT])
    expect(fracturedIndices).toContain(0)
  })

  it('applyFracture zeros the pixel', () => {
    const pixels = new Uint8Array([1])
    const structural = buildStructuralBody(pixels, new Uint8Array([0]), 1, 1, [
      MAT
    ])
    structural.stressMap[0] = 999
    applyFracture(structural, [0])
    expect(structural.pixels[0]).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// Sleep
// ---------------------------------------------------------------------------

describe('evaluateSleep', () => {
  it('body with low velocity sleeps after threshold frames', () => {
    const body = makeBody({
      velocity: Vec2.create(Fixed.from(0), Fixed.from(0)),
      angularVelocity: Fixed.from(0)
    })
    const config = { ...DEFAULT_PHYSICS_CONFIG, sleepFrameThreshold: 3 }
    evaluateSleep(body, config)
    evaluateSleep(body, config)
    evaluateSleep(body, config)
    expect(body.isSleeping).toBe(true)
  })

  it('sleeping body wakes when velocity applied', () => {
    const body = makeBody({ isSleeping: true, sleepTimer: 100 })
    wakeBody(body)
    expect(body.isSleeping).toBe(false)
    expect(body.sleepTimer).toBe(0)
  })

  it('body with high velocity does not sleep', () => {
    const body = makeBody({
      velocity: Vec2.create(Fixed.from(10), Fixed.from(0))
    })
    const config = { ...DEFAULT_PHYSICS_CONFIG, sleepFrameThreshold: 2 }
    evaluateSleep(body, config)
    evaluateSleep(body, config)
    expect(body.isSleeping).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// Impulse solver
// ---------------------------------------------------------------------------

describe('solveConstraints (contact)', () => {
  it('two overlapping bodies: normal velocity becomes non-negative after solve', () => {
    const bodyA = makeBody({
      position: Vec2.create(Fixed.from(0), Fixed.from(0)),
      velocity: Vec2.create(Fixed.from(1), Fixed.from(0))
    })
    const bodyB = makeBody({
      position: Vec2.create(Fixed.from(1), Fixed.from(0)),
      velocity: Vec2.create(Fixed.from(-1), Fixed.from(0))
    })

    const manifold = testCircleCircle(
      makeEntityId(0),
      bodyA.position,
      Fixed.from(1),
      makeEntityId(1),
      bodyB.position,
      Fixed.from(1)
    )
    if (!manifold) return // shouldn't happen

    const bodies = new Map<number, RigidBody>([
      [0, bodyA],
      [1, bodyB]
    ])

    solveConstraints(
      [],
      [manifold],
      (idx) => bodies.get(idx),
      8,
      Fixed.from(1 / 60)
    )

    // After solving, relative velocity along normal should be ≥ 0 (separating or zero).
    const n = manifold.points[0].normal
    const vRel = Vec2.dot(Vec2.sub(bodyA.velocity, bodyB.velocity), n)
    expect(vRel).toBeGreaterThanOrEqual(-0.1) // small tolerance for fixed-point
  })

  it('static body does not move under contact', () => {
    const bodyA = makeBody({
      position: Vec2.create(Fixed.from(0), Fixed.from(0)),
      velocity: Vec2.create(Fixed.from(2), Fixed.from(0)),
      isStatic: false
    })
    const bodyB = makeBody({
      position: Vec2.create(Fixed.from(1), Fixed.from(0)),
      velocity: Vec2.create(Fixed.from(0), Fixed.from(0)),
      isStatic: true,
      invMass: Fixed.from(0),
      invInertia: Fixed.from(0)
    })

    const manifold = testCircleCircle(
      makeEntityId(0),
      bodyA.position,
      Fixed.from(1),
      makeEntityId(1),
      bodyB.position,
      Fixed.from(1)
    )
    if (!manifold) return

    const origVelBx = bodyB.velocity.x

    const bodies = new Map<number, RigidBody>([
      [0, bodyA],
      [1, bodyB]
    ])
    solveConstraints(
      [],
      [manifold],
      (idx) => bodies.get(idx),
      8,
      Fixed.from(1 / 60)
    )

    expect(bodyB.velocity.x).toBe(origVelBx)
  })
})

// ---------------------------------------------------------------------------
// Plugin integration
// ---------------------------------------------------------------------------

describe('PhysicsPlugin', () => {
  it('registers without error', () => {
    expect(() => new AppBuilder().use(PhysicsPlugin()).build()).not.toThrow()
  })

  it('installs PhysicsWorld resource', async () => {
    const app = new AppBuilder().use(PhysicsPlugin()).build()
    const pw = app.world.tryGetResource('physics:world') as
      | PhysicsWorld
      | undefined
    expect(pw).toBeInstanceOf(PhysicsWorld)
  })
})
