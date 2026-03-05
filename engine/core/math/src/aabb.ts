import { Fixed } from './fixed.js'
import { type Vec2, Vec2 as Vec2Ops } from './vec2.js'

/** Axis-aligned bounding box in fixed-point world space. */
export interface AABB {
  min: Vec2
  max: Vec2
}

export const AABB = {
  create(min: Vec2, max: Vec2): AABB {
    return { min, max }
  },

  overlaps(a: AABB, b: AABB): boolean {
    return (
      a.min.x <= b.max.x &&
      a.max.x >= b.min.x &&
      a.min.y <= b.max.y &&
      a.max.y >= b.min.y
    )
  },

  contains(box: AABB, point: Vec2): boolean {
    return (
      point.x >= box.min.x &&
      point.x <= box.max.x &&
      point.y >= box.min.y &&
      point.y <= box.max.y
    )
  },

  expand(box: AABB, amount: Fixed): AABB {
    return {
      min: Vec2Ops.sub(box.min, { x: amount, y: amount }),
      max: Vec2Ops.add(box.max, { x: amount, y: amount })
    }
  },

  union(a: AABB, b: AABB): AABB {
    return {
      min: {
        x: Fixed.min(a.min.x, b.min.x),
        y: Fixed.min(a.min.y, b.min.y)
      },
      max: {
        x: Fixed.max(a.max.x, b.max.x),
        y: Fixed.max(a.max.y, b.max.y)
      }
    }
  }
}
