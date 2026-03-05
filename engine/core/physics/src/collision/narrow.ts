import { type EntityId } from 'qti-clockwork-ecs'
import {
  type ColliderShape,
  type RigidBody,
  type Collider
} from '../components.js'
import { type ContactManifold } from '../manifold.js'
import { worldSpaceVertices } from './shapes.js'
import {
  testCircleCircle,
  testPolygonCircle,
  testPolygonPolygon
} from './sat.js'
import { Vec2 } from 'qti-clockwork-math'

export function testCollision(
  entityA: EntityId,
  bodyA: RigidBody,
  colliderA: Collider,
  entityB: EntityId,
  bodyB: RigidBody,
  colliderB: Collider
): ContactManifold | null {
  return dispatchShapes(
    entityA,
    bodyA,
    colliderA.shape,
    entityB,
    bodyB,
    colliderB.shape
  )
}

function dispatchShapes(
  entityA: EntityId,
  bodyA: RigidBody,
  shapeA: ColliderShape,
  entityB: EntityId,
  bodyB: RigidBody,
  shapeB: ColliderShape
): ContactManifold | null {
  if (shapeA.type === 'circle' && shapeB.type === 'circle') {
    return testCircleCircle(
      entityA,
      bodyA.position,
      shapeA.radius,
      entityB,
      bodyB.position,
      shapeB.radius
    )
  }

  if (shapeA.type === 'circle' && shapeB.type === 'polygon') {
    const vertsB = worldSpaceVertices(
      shapeB.vertices,
      bodyB.position,
      bodyB.angle
    )
    // testPolygonCircle returns normals relative to polygon (A) toward circle (B),
    // so flip entities to match expected manifold convention.
    const m = testPolygonCircle(
      entityB,
      vertsB,
      entityA,
      bodyA.position,
      shapeA.radius
    )
    if (!m) return null
    return { entityA, entityB, points: m.points }
  }

  if (shapeA.type === 'polygon' && shapeB.type === 'circle') {
    const vertsA = worldSpaceVertices(
      shapeA.vertices,
      bodyA.position,
      bodyA.angle
    )
    return testPolygonCircle(
      entityA,
      vertsA,
      entityB,
      bodyB.position,
      shapeB.radius
    )
  }

  if (shapeA.type === 'polygon' && shapeB.type === 'polygon') {
    const vertsA = worldSpaceVertices(
      shapeA.vertices,
      bodyA.position,
      bodyA.angle
    )
    const vertsB = worldSpaceVertices(
      shapeB.vertices,
      bodyB.position,
      bodyB.angle
    )
    return testPolygonPolygon(entityA, vertsA, entityB, vertsB)
  }

  if (shapeA.type === 'aabb' && shapeB.type === 'aabb') {
    // AABB vs AABB: expand to polygon and run SAT.
    return testPolygonPolygon(
      entityA,
      aabbToPolygon(bodyA, shapeA.half),
      entityB,
      aabbToPolygon(bodyB, shapeB.half)
    )
  }

  if (shapeA.type === 'compound') {
    return firstContact(
      shapeA.shapes.map((s) =>
        dispatchShapes(entityA, bodyA, s, entityB, bodyB, shapeB)
      )
    )
  }

  if (shapeB.type === 'compound') {
    return firstContact(
      shapeB.shapes.map((s) =>
        dispatchShapes(entityA, bodyA, shapeA, entityB, bodyB, s)
      )
    )
  }

  // Mixed AABB/circle or AABB/polygon: expand AABB to polygon and recurse once.
  if (shapeA.type === 'aabb') {
    return dispatchShapes(
      entityA,
      bodyA,
      { type: 'polygon', vertices: aabbToPolygon(bodyA, shapeA.half) },
      entityB,
      bodyB,
      shapeB
    )
  }

  if (shapeB.type === 'aabb') {
    return dispatchShapes(entityA, bodyA, shapeA, entityB, bodyB, {
      type: 'polygon',
      vertices: aabbToPolygon(bodyB, shapeB.half)
    })
  }

  return null
}

function firstContact(
  results: (ContactManifold | null)[]
): ContactManifold | null {
  for (const r of results) {
    if (r) return r
  }
  return null
}

import { Fixed } from 'qti-clockwork-math'

function aabbToPolygon(body: RigidBody, half: Vec2): Vec2[] {
  const { x: hw, y: hh } = half
  return [
    Vec2.add(
      body.position,
      Vec2.rotate(Vec2.create(Fixed.neg(hw), Fixed.neg(hh)), body.angle)
    ),
    Vec2.add(
      body.position,
      Vec2.rotate(Vec2.create(hw, Fixed.neg(hh)), body.angle)
    ),
    Vec2.add(body.position, Vec2.rotate(Vec2.create(hw, hh), body.angle)),
    Vec2.add(
      body.position,
      Vec2.rotate(Vec2.create(Fixed.neg(hw), hh), body.angle)
    )
  ]
}
