/** Q16.16 fixed-point scalar; lower 16 bits are fractional. */
export type Fixed = number & { readonly __fixed: unique symbol }

const FRAC_BITS = 16
const SCALE = 1 << FRAC_BITS

export const FIXED_PI = Math.round(Math.PI * SCALE) as Fixed
export const FIXED_TWO_PI = Math.round(2 * Math.PI * SCALE) as Fixed
export const FIXED_HALF_PI = Math.round((Math.PI / 2) * SCALE) as Fixed

// Precomputed at module load from floating-point; deterministic because
// the table is bit-identical everywhere — JIT never touches trig during simulation.
const SIN_TABLE: readonly Fixed[] = Array.from(
  { length: 257 },
  (_, i) => Math.round(Math.sin((i / 256) * 2 * Math.PI) * SCALE) as Fixed
)

// First-octant atan table: entry i = atan(i/512) in fixed-point radians.
const ATAN_TABLE: readonly Fixed[] = Array.from(
  { length: 513 },
  (_, i) => Math.round(Math.atan(i / 512) * SCALE) as Fixed
)

function sinLookup(a: Fixed): Fixed {
  // Map angle to fractional table index, interpolate between adjacent entries.
  // 256 entries give max error of ~0.5 ULP at the midpoint between samples.
  const norm = ((a % FIXED_TWO_PI) + FIXED_TWO_PI) % FIXED_TWO_PI
  const indexF = (norm * 256) / FIXED_TWO_PI
  const i = Math.floor(indexF)
  const frac = indexF - i
  const v0 = SIN_TABLE[i]! // i is always in [0, 255] since norm < FIXED_TWO_PI
  const v1 = SIN_TABLE[i + 1]! // table has 257 entries; i+1 is always valid
  return Math.round(v0 + (v1 - v0) * frac) as Fixed
}

function atanFirstOctant(ratio512: number): Fixed {
  if (ratio512 >= 512) return ATAN_TABLE[512]! // ax === ay exactly: atan(1) = π/4, no interpolation needed.
  const i = Math.floor(ratio512)
  const frac = ratio512 - i
  const v0 = ATAN_TABLE[i]!
  const v1 = ATAN_TABLE[i + 1]!
  return Math.round(v0 + (v1 - v0) * frac) as Fixed
}

export const Fixed = {
  from(n: number): Fixed {
    return Math.round(n * SCALE) as Fixed
  },

  to(f: Fixed): number {
    return f / SCALE
  },

  add(a: Fixed, b: Fixed): Fixed {
    return (a + b) as Fixed
  },

  sub(a: Fixed, b: Fixed): Fixed {
    return (a - b) as Fixed
  },

  mul(a: Fixed, b: Fixed): Fixed {
    // Q16.16 × Q16.16 = Q32.32 intermediate; BigInt prevents integer overflow before the shift.
    return Number((BigInt(a) * BigInt(b)) >> BigInt(FRAC_BITS)) as Fixed
  },

  div(a: Fixed, b: Fixed): Fixed {
    return Number((BigInt(a) << BigInt(FRAC_BITS)) / BigInt(b)) as Fixed
  },

  abs(a: Fixed): Fixed {
    return (a < 0 ? -a : a) as Fixed
  },

  neg(a: Fixed): Fixed {
    return -a as Fixed
  },

  min(a: Fixed, b: Fixed): Fixed {
    return (a < b ? a : b) as Fixed
  },

  max(a: Fixed, b: Fixed): Fixed {
    return (a > b ? a : b) as Fixed
  },

  clamp(v: Fixed, lo: Fixed, hi: Fixed): Fixed {
    return (v < lo ? lo : v > hi ? hi : v) as Fixed
  },

  floor(a: Fixed): Fixed {
    return ((a >> FRAC_BITS) << FRAC_BITS) as Fixed
  },

  ceil(a: Fixed): Fixed {
    return (((a + SCALE - 1) >> FRAC_BITS) << FRAC_BITS) as Fixed
  },

  round(a: Fixed): Fixed {
    return (((a + (SCALE >> 1)) >> FRAC_BITS) << FRAC_BITS) as Fixed
  },

  sqrt(a: Fixed): Fixed {
    if (a <= 0) return 0 as Fixed // Negative sqrt: clamp to zero rather than propagate NaN through the simulation.
    // Integer Newton-Raphson on the scaled target n = a << FRAC_BITS:
    // 1. Shift a left by FRAC_BITS so result^2 = n (i.e. result = sqrt(a) * 256)
    // 2. Start from float estimate for fast convergence (~2 iterations needed)
    // 3. Iterate r = (r + n/r) >> 1 until r stops decreasing (floor(sqrt(n)))
    const n = BigInt(a) << BigInt(FRAC_BITS)
    let r = BigInt(Math.ceil(Math.sqrt(a) * 256))
    if (r === 0n) return 0 as Fixed
    let r1 = (r + n / r) >> 1n
    while (r1 < r) {
      r = r1
      r1 = (r + n / r) >> 1n
    }
    return Number(r) as Fixed
  },

  sin(a: Fixed): Fixed {
    return sinLookup(a)
  },

  cos(a: Fixed): Fixed {
    return sinLookup((a + FIXED_HALF_PI) as Fixed)
  },

  atan2(y: Fixed, x: Fixed): Fixed {
    if (x === 0 && y === 0) return 0 as Fixed // Undefined direction — zero is at least consistent.
    // First-octant lookup: reduce (|x|, |y|) so that |y| <= |x|, then look up
    // atan(|y|/|x|) from the 512-entry table. Reconstruct full angle via octant
    // offset: swap gives π/2 − θ, x<0 reflects across y-axis, y<0 negates.
    const ax = Math.abs(x)
    const ay = Math.abs(y)
    let theta: Fixed
    if (ax >= ay) {
      theta = atanFirstOctant((ay * 512) / ax)
    } else {
      theta = (FIXED_HALF_PI - atanFirstOctant((ax * 512) / ay)) as Fixed
    }
    if (x < 0) theta = (FIXED_PI - theta) as Fixed
    if (y < 0) theta = -theta as Fixed
    return theta
  },

  lerp(a: Fixed, b: Fixed, t: Fixed): Fixed {
    return (a +
      Number((BigInt(b - a) * BigInt(t)) >> BigInt(FRAC_BITS))) as Fixed
  }
}
