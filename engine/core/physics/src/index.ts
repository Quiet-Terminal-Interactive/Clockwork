export const packageId = 'qti-clockwork-physics'

export { RIGID_BODY, COLLIDER, MATERIAL, STRUCTURAL } from './components.js'
export type {
  RigidBody,
  Collider,
  ColliderShape,
  PhysicsMaterial,
  StructuralBody
} from './components.js'

export {
  PhysicsWorld,
  DEFAULT_PHYSICS_CONFIG,
  PHYSICS_WORLD_KEY
} from './world.js'
export type { PhysicsConfig } from './world.js'

export {
  CollisionStarted,
  CollisionEnded,
  BodyFractured,
  BodySleepChanged
} from './events.js'
export type { ContactManifold, ContactPoint } from './manifold.js'
export type {
  Constraint,
  ContactConstraint,
  JointConstraint,
  DistanceConstraint,
  WeldConstraint
} from './constraints.js'

export { PhysicsPlugin, PhysicsDebugPlugin } from './plugin.js'
export {
  buildStructuralBody,
  syncStructuralToRigidBody
} from './structural/builder.js'
