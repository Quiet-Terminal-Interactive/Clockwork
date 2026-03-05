import { describe, expect, it } from 'vitest'
import {
  AABB,
  Fixed,
  FIXED_HALF_PI,
  FIXED_PI,
  FIXED_TWO_PI,
  Vec2,
  packageId
} from './index'

describe('math package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-math')
  })
})

describe('Fixed arithmetic', () => {
  it('round-trips number through from/to', () => {
    expect(Fixed.to(Fixed.from(1.5))).toBeCloseTo(1.5)
    expect(Fixed.to(Fixed.from(-3.25))).toBeCloseTo(-3.25)
    expect(Fixed.to(Fixed.from(0))).toBe(0)
  })

  it('adds and subtracts correctly', () => {
    const a = Fixed.from(1.5)
    const b = Fixed.from(2.5)
    expect(Fixed.to(Fixed.add(a, b))).toBeCloseTo(4.0)
    expect(Fixed.to(Fixed.sub(b, a))).toBeCloseTo(1.0)
  })

  it('multiplies without overflow for game-scale values', () => {
    const a = Fixed.from(100)
    const b = Fixed.from(200)
    expect(Fixed.to(Fixed.mul(a, b))).toBeCloseTo(20000)
  })

  it('multiplies fractional values', () => {
    const a = Fixed.from(1.5)
    const b = Fixed.from(2.0)
    expect(Fixed.to(Fixed.mul(a, b))).toBeCloseTo(3.0)
  })

  it('divides correctly', () => {
    const a = Fixed.from(10)
    const b = Fixed.from(4)
    expect(Fixed.to(Fixed.div(a, b))).toBeCloseTo(2.5)
  })

  it('abs, neg, min, max, clamp', () => {
    const neg = Fixed.from(-5)
    const pos = Fixed.from(5)
    expect(Fixed.to(Fixed.abs(neg))).toBeCloseTo(5)
    expect(Fixed.to(Fixed.neg(pos))).toBeCloseTo(-5)
    expect(Fixed.to(Fixed.min(neg, pos))).toBeCloseTo(-5)
    expect(Fixed.to(Fixed.max(neg, pos))).toBeCloseTo(5)
    expect(
      Fixed.to(Fixed.clamp(Fixed.from(10), Fixed.from(0), Fixed.from(5)))
    ).toBeCloseTo(5)
    expect(
      Fixed.to(Fixed.clamp(Fixed.from(-1), Fixed.from(0), Fixed.from(5)))
    ).toBeCloseTo(0)
  })

  it('floor, ceil, round', () => {
    const f = Fixed.from(1.7)
    expect(Fixed.to(Fixed.floor(f))).toBeCloseTo(1.0)
    expect(Fixed.to(Fixed.ceil(f))).toBeCloseTo(2.0)
    expect(Fixed.to(Fixed.round(f))).toBeCloseTo(2.0)
    expect(Fixed.to(Fixed.round(Fixed.from(1.4)))).toBeCloseTo(1.0)
  })

  it('lerp interpolates linearly', () => {
    const a = Fixed.from(0)
    const b = Fixed.from(10)
    const half = Fixed.from(0.5)
    expect(Fixed.to(Fixed.lerp(a, b, half))).toBeCloseTo(5.0, 2)
  })
})

describe('Fixed sqrt', () => {
  it('computes exact perfect squares', () => {
    expect(Fixed.to(Fixed.sqrt(Fixed.from(4)))).toBeCloseTo(2.0, 3)
    expect(Fixed.to(Fixed.sqrt(Fixed.from(9)))).toBeCloseTo(3.0, 3)
    expect(Fixed.to(Fixed.sqrt(Fixed.from(100)))).toBeCloseTo(10.0, 3)
  })

  it('returns zero for zero input', () => {
    expect(Fixed.to(Fixed.sqrt(Fixed.from(0)))).toBe(0)
  })

  it('clamps negative input to zero', () => {
    expect(Fixed.to(Fixed.sqrt(Fixed.from(-1)))).toBe(0)
  })

  it('approximates non-perfect squares', () => {
    expect(Fixed.to(Fixed.sqrt(Fixed.from(2)))).toBeCloseTo(Math.sqrt(2), 3)
  })
})

describe('Fixed trig', () => {
  it('sin(0) = 0', () => {
    expect(Fixed.to(Fixed.sin(Fixed.from(0)))).toBeCloseTo(0, 3)
  })

  it('sin(π/2) ≈ 1', () => {
    expect(Fixed.to(Fixed.sin(FIXED_HALF_PI))).toBeCloseTo(1, 2)
  })

  it('sin(π) ≈ 0', () => {
    expect(Fixed.to(Fixed.sin(FIXED_PI))).toBeCloseTo(0, 2)
  })

  it('sin(2π) ≈ 0', () => {
    expect(Fixed.to(Fixed.sin(FIXED_TWO_PI))).toBeCloseTo(0, 2)
  })

  it('cos(0) = 1', () => {
    expect(Fixed.to(Fixed.cos(Fixed.from(0)))).toBeCloseTo(1, 2)
  })

  it('cos(π) ≈ -1', () => {
    expect(Fixed.to(Fixed.cos(FIXED_PI))).toBeCloseTo(-1, 2)
  })

  it('atan2(0, 1) = 0', () => {
    expect(Fixed.to(Fixed.atan2(Fixed.from(0), Fixed.from(1)))).toBeCloseTo(
      0,
      2
    )
  })

  it('atan2(1, 0) = π/2', () => {
    expect(Fixed.to(Fixed.atan2(Fixed.from(1), Fixed.from(0)))).toBeCloseTo(
      Math.PI / 2,
      2
    )
  })

  it('atan2(0, -1) = π', () => {
    expect(Fixed.to(Fixed.atan2(Fixed.from(0), Fixed.from(-1)))).toBeCloseTo(
      Math.PI,
      2
    )
  })

  it('atan2(-1, 0) = -π/2', () => {
    expect(Fixed.to(Fixed.atan2(Fixed.from(-1), Fixed.from(0)))).toBeCloseTo(
      -Math.PI / 2,
      2
    )
  })

  it('atan2(0, 0) = 0', () => {
    expect(Fixed.to(Fixed.atan2(Fixed.from(0), Fixed.from(0)))).toBe(0)
  })
})

describe('Vec2', () => {
  it('add and sub', () => {
    const a = Vec2.create(Fixed.from(1), Fixed.from(2))
    const b = Vec2.create(Fixed.from(3), Fixed.from(4))
    const sum = Vec2.add(a, b)
    expect(Fixed.to(sum.x)).toBeCloseTo(4)
    expect(Fixed.to(sum.y)).toBeCloseTo(6)
    const diff = Vec2.sub(b, a)
    expect(Fixed.to(diff.x)).toBeCloseTo(2)
    expect(Fixed.to(diff.y)).toBeCloseTo(2)
  })

  it('dot product', () => {
    const a = Vec2.create(Fixed.from(1), Fixed.from(0))
    const b = Vec2.create(Fixed.from(0), Fixed.from(1))
    expect(Fixed.to(Vec2.dot(a, b))).toBeCloseTo(0)
    expect(Fixed.to(Vec2.dot(a, a))).toBeCloseTo(1)
  })

  it('cross product (2D scalar)', () => {
    const a = Vec2.create(Fixed.from(1), Fixed.from(0))
    const b = Vec2.create(Fixed.from(0), Fixed.from(1))
    expect(Fixed.to(Vec2.cross(a, b))).toBeCloseTo(1)
    expect(Fixed.to(Vec2.cross(b, a))).toBeCloseTo(-1)
  })

  it('len of 3-4-5 triangle', () => {
    const v = Vec2.create(Fixed.from(3), Fixed.from(4))
    expect(Fixed.to(Vec2.len(v))).toBeCloseTo(5, 2)
  })

  it('norm produces unit vector', () => {
    const v = Vec2.create(Fixed.from(3), Fixed.from(4))
    const n = Vec2.norm(v)
    expect(Fixed.to(n.x)).toBeCloseTo(0.6, 2)
    expect(Fixed.to(n.y)).toBeCloseTo(0.8, 2)
    expect(Fixed.to(Vec2.len(n))).toBeCloseTo(1.0, 2)
  })

  it('norm of zero vector returns zero', () => {
    const zero = Vec2.create(Fixed.from(0), Fixed.from(0))
    const n = Vec2.norm(zero)
    expect(Fixed.to(n.x)).toBe(0)
    expect(Fixed.to(n.y)).toBe(0)
  })

  it('rotate by π/2 maps (1,0) to (0,1)', () => {
    const v = Vec2.create(Fixed.from(1), Fixed.from(0))
    const r = Vec2.rotate(v, FIXED_HALF_PI)
    expect(Fixed.to(r.x)).toBeCloseTo(0, 2)
    expect(Fixed.to(r.y)).toBeCloseTo(1, 2)
  })

  it('perp is 90 degrees', () => {
    const v = Vec2.create(Fixed.from(1), Fixed.from(0))
    const p = Vec2.perp(v)
    expect(Fixed.to(p.x)).toBeCloseTo(0)
    expect(Fixed.to(p.y)).toBeCloseTo(1)
  })
})

describe('AABB', () => {
  const box = AABB.create(
    Vec2.create(Fixed.from(0), Fixed.from(0)),
    Vec2.create(Fixed.from(10), Fixed.from(10))
  )

  it('overlapping boxes', () => {
    const other = AABB.create(
      Vec2.create(Fixed.from(5), Fixed.from(5)),
      Vec2.create(Fixed.from(15), Fixed.from(15))
    )
    expect(AABB.overlaps(box, other)).toBe(true)
  })

  it('non-overlapping boxes', () => {
    const other = AABB.create(
      Vec2.create(Fixed.from(11), Fixed.from(0)),
      Vec2.create(Fixed.from(20), Fixed.from(10))
    )
    expect(AABB.overlaps(box, other)).toBe(false)
  })

  it('contains interior point', () => {
    expect(AABB.contains(box, Vec2.create(Fixed.from(5), Fixed.from(5)))).toBe(
      true
    )
  })

  it('does not contain exterior point', () => {
    expect(AABB.contains(box, Vec2.create(Fixed.from(15), Fixed.from(5)))).toBe(
      false
    )
  })

  it('expand increases bounds uniformly', () => {
    const expanded = AABB.expand(box, Fixed.from(2))
    expect(Fixed.to(expanded.min.x)).toBeCloseTo(-2)
    expect(Fixed.to(expanded.max.x)).toBeCloseTo(12)
  })

  it('union covers both boxes', () => {
    const other = AABB.create(
      Vec2.create(Fixed.from(-5), Fixed.from(-5)),
      Vec2.create(Fixed.from(5), Fixed.from(5))
    )
    const u = AABB.union(box, other)
    expect(Fixed.to(u.min.x)).toBeCloseTo(-5)
    expect(Fixed.to(u.max.x)).toBeCloseTo(10)
  })
})
