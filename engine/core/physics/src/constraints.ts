import { type Fixed } from 'qti-clockwork-math'
import { type Vec2 } from 'qti-clockwork-math'
import { type EntityId } from 'qti-clockwork-ecs'
import { type ContactManifold } from './manifold.js'

export interface ContactConstraint {
  type: 'contact'
  manifold: ContactManifold
}

export interface JointConstraint {
  type: 'joint'
  entityA: EntityId
  entityB: EntityId
  anchorA: Vec2
  anchorB: Vec2
}

export interface DistanceConstraint {
  type: 'distance'
  entityA: EntityId
  entityB: EntityId
  anchorA: Vec2
  anchorB: Vec2
  restLength: Fixed
  stiffness: Fixed
}

export interface WeldConstraint {
  type: 'weld'
  entityA: EntityId
  entityB: EntityId
  anchorA: Vec2
  anchorB: Vec2
  refAngle: Fixed
}

export type Constraint =
  | ContactConstraint
  | JointConstraint
  | DistanceConstraint
  | WeldConstraint
