import { type Fixed } from 'qti-clockwork-math'
import { type Vec2 } from 'qti-clockwork-math'

// Component identity tokens — symbols prevent cross-plugin key collisions.
export const RIGID_BODY = Symbol('physics:RigidBody')
export const COLLIDER = Symbol('physics:Collider')
export const MATERIAL = Symbol('physics:PhysicsMaterial')
export const STRUCTURAL = Symbol('physics:StructuralBody')

export interface RigidBody {
  position: Vec2
  velocity: Vec2
  angle: Fixed
  angularVelocity: Fixed
  mass: Fixed
  invMass: Fixed
  inertia: Fixed
  invInertia: Fixed
  restitution: Fixed
  friction: Fixed
  linearDamping: Fixed
  angularDamping: Fixed
  isStatic: boolean
  isSleeping: boolean
  sleepTimer: number
}

export type ColliderShape =
  | { type: 'circle'; radius: Fixed }
  | { type: 'aabb'; half: Vec2 }
  | { type: 'polygon'; vertices: Vec2[] }
  | { type: 'compound'; shapes: ColliderShape[] }

export interface Collider {
  shape: ColliderShape
  offset: Vec2
  angle: Fixed
}

export interface PhysicsMaterial {
  density: Fixed
  restitution: Fixed
  friction: Fixed
  tensileStrength: Fixed
}

export interface StructuralBody {
  pixels: Uint8Array
  pixelMaterials: Uint8Array
  width: number
  height: number
  centreOfMass: Vec2
  mass: Fixed
  inertia: Fixed
  hullVertices: Vec2[]
  stressMap: Float32Array
}
