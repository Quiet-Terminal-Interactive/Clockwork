import { Fixed, Vec2, AABB } from 'qti-clockwork-math'
import { type ColliderShape } from '../components.js'

export function worldSpaceVertices(
  vertices: Vec2[],
  position: Vec2,
  angle: Fixed
): Vec2[] {
  return vertices.map((v) => Vec2.add(Vec2.rotate(v, angle), position))
}

export function computeAABBForShape(
  shape: ColliderShape,
  position: Vec2,
  angle: Fixed
): AABB {
  switch (shape.type) {
    case 'circle': {
      const r = shape.radius
      return AABB.create(
        Vec2.create(Fixed.sub(position.x, r), Fixed.sub(position.y, r)),
        Vec2.create(Fixed.add(position.x, r), Fixed.add(position.y, r))
      )
    }

    case 'aabb': {
      const hw = shape.half.x
      const hh = shape.half.y
      // AABB rotated by body angle — take the rotated half-extents envelope.
      // |cos θ|·hw + |sin θ|·hh gives the new half-width on each axis.
      const c = Fixed.abs(Fixed.cos(angle))
      const s = Fixed.abs(Fixed.sin(angle))
      const ex = Fixed.add(Fixed.mul(c, hw), Fixed.mul(s, hh))
      const ey = Fixed.add(Fixed.mul(s, hw), Fixed.mul(c, hh))
      return AABB.create(
        Vec2.create(Fixed.sub(position.x, ex), Fixed.sub(position.y, ey)),
        Vec2.create(Fixed.add(position.x, ex), Fixed.add(position.y, ey))
      )
    }

    case 'polygon': {
      const ws = worldSpaceVertices(shape.vertices, position, angle)
      if (ws.length === 0) {
        return AABB.create(position, position)
      }
      let minX = ws[0]!.x
      let minY = ws[0]!.y
      let maxX = ws[0]!.x
      let maxY = ws[0]!.y
      for (let i = 1; i < ws.length; i++) {
        const v = ws[i]!
        if (v.x < minX) minX = v.x
        if (v.y < minY) minY = v.y
        if (v.x > maxX) maxX = v.x
        if (v.y > maxY) maxY = v.y
      }
      return AABB.create(Vec2.create(minX, minY), Vec2.create(maxX, maxY))
    }

    case 'compound': {
      if (shape.shapes.length === 0) {
        return AABB.create(position, position)
      }
      let result = computeAABBForShape(shape.shapes[0]!, position, angle)
      for (let i = 1; i < shape.shapes.length; i++) {
        result = AABB.union(
          result,
          computeAABBForShape(shape.shapes[i]!, position, angle)
        )
      }
      return result
    }
  }
}
