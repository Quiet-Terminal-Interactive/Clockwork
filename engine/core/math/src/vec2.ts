import { Fixed } from './fixed.js'

/** Fixed-point 2D vector. */
export interface Vec2 {
  x: Fixed
  y: Fixed
}

export const Vec2 = {
  create(x: Fixed, y: Fixed): Vec2 {
    return { x, y }
  },

  add(a: Vec2, b: Vec2): Vec2 {
    return { x: Fixed.add(a.x, b.x), y: Fixed.add(a.y, b.y) }
  },

  sub(a: Vec2, b: Vec2): Vec2 {
    return { x: Fixed.sub(a.x, b.x), y: Fixed.sub(a.y, b.y) }
  },

  scale(v: Vec2, s: Fixed): Vec2 {
    return { x: Fixed.mul(v.x, s), y: Fixed.mul(v.y, s) }
  },

  dot(a: Vec2, b: Vec2): Fixed {
    return Fixed.add(Fixed.mul(a.x, b.x), Fixed.mul(a.y, b.y))
  },

  cross(a: Vec2, b: Vec2): Fixed {
    return Fixed.sub(Fixed.mul(a.x, b.y), Fixed.mul(a.y, b.x))
  },

  lenSq(v: Vec2): Fixed {
    return Vec2.dot(v, v)
  },

  len(v: Vec2): Fixed {
    return Fixed.sqrt(Vec2.lenSq(v))
  },

  norm(v: Vec2): Vec2 {
    const l = Vec2.len(v)
    if (l === 0) return { x: 0 as Fixed, y: 0 as Fixed } // Zero vector has no direction. Return zero rather than pollute the simulation with NaN.
    return { x: Fixed.div(v.x, l), y: Fixed.div(v.y, l) }
  },

  perp(v: Vec2): Vec2 {
    return { x: Fixed.neg(v.y), y: v.x }
  },

  lerp(a: Vec2, b: Vec2, t: Fixed): Vec2 {
    return { x: Fixed.lerp(a.x, b.x, t), y: Fixed.lerp(a.y, b.y, t) }
  },

  rotate(v: Vec2, angle: Fixed): Vec2 {
    // Rotation matrix: [cos θ  -sin θ] × [x]
    //                  [sin θ   cos θ]   [y]
    const c = Fixed.cos(angle)
    const s = Fixed.sin(angle)
    return {
      x: Fixed.sub(Fixed.mul(c, v.x), Fixed.mul(s, v.y)),
      y: Fixed.add(Fixed.mul(s, v.x), Fixed.mul(c, v.y))
    }
  }
}
