import { type Vec2 } from 'qti-clockwork-math'
import { type EntityId } from 'qti-clockwork-ecs'

/** Emitted the first tick two bodies make contact. */
export class CollisionStarted {
  constructor(
    readonly entityA: EntityId,
    readonly entityB: EntityId,
    readonly point: Vec2,
    readonly normal: Vec2
  ) {}
}

/** Emitted the first tick two previously-colliding bodies separate. */
export class CollisionEnded {
  constructor(
    readonly entityA: EntityId,
    readonly entityB: EntityId
  ) {}
}

/** Emitted when a StructuralBody fractures into two or more pieces. */
export class BodyFractured {
  constructor(
    readonly source: EntityId,
    readonly fragments: EntityId[]
  ) {}
}

export class BodySleepChanged {
  constructor(
    readonly entity: EntityId,
    readonly sleeping: boolean
  ) {}
}
