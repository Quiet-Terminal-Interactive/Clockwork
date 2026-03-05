import { Fixed, Vec2 } from 'qti-clockwork-math'
import { type StructuralBody, type PhysicsMaterial } from '../components.js'

// How much stress bleeds into each neighbour per tick.
// Tuned for game feel, not physics accuracy — thin cross-sections accumulate faster.
const PROPAGATION_FACTOR = 0.25

// Pixels within this world-unit radius of the contact point receive impulse.
const DISTRIBUTION_RADIUS = 3

/** Spread contact impulse across pixels near the contact point using inverse-distance weighting. */
export function distributeImpulse(
  structural: StructuralBody,
  contactLocalPos: Vec2,
  impulseMagnitude: number
): void {
  const { pixels, stressMap, width, height } = structural

  // Gather pixels within radius and compute their distances.
  const cx = contactLocalPos.x
  const cy = contactLocalPos.y
  let weightSum = 0

  const indices: number[] = []
  const weights: number[] = []

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = py * width + px
      if (!pixels[idx]) continue
      const dx = px + 0.5 - cx
      const dy = py + 0.5 - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > DISTRIBUTION_RADIUS) continue
      // Inverse-distance weight: closer pixels absorb more of the impulse.
      // Epsilon avoids division by zero for pixels exactly at the contact point.
      const w = 1 / (dist + 0.001)
      indices.push(idx)
      weights.push(w)
      weightSum += w
    }
  }

  if (weightSum === 0 || indices.length === 0) return

  for (let i = 0; i < indices.length; i++) {
    stressMap[indices[i]!]! += (weights[i]! / weightSum) * impulseMagnitude
  }
}

/** One spring-mass stress propagation pass. This is not FEM — it is a game approximation. */
export function propagateStress(structural: StructuralBody): void {
  const { pixels, stressMap, width, height } = structural

  const delta = new Float32Array(stressMap.length)

  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const idx = py * width + px
      if (!pixels[idx] || stressMap[idx] === 0) continue

      const neighbours = [
        py > 0 ? idx - width : -1,
        py < height - 1 ? idx + width : -1,
        px > 0 ? idx - 1 : -1,
        px < width - 1 ? idx + 1 : -1
      ]

      for (const n of neighbours) {
        if (n < 0 || !pixels[n]) continue
        const transfer = stressMap[idx]! * PROPAGATION_FACTOR
        delta[idx]! -= transfer
        delta[n]! += transfer
      }
    }
  }

  for (let i = 0; i < stressMap.length; i++) {
    stressMap[i]! += delta[i]!
  }
}

export interface FractureResult {
  fracturedIndices: number[]
}

/** Mark pixels exceeding their material's tensile strength for removal. Returns affected indices. */
export function evaluateFracture(
  structural: StructuralBody,
  materials: PhysicsMaterial[]
): FractureResult {
  const { pixels, pixelMaterials, stressMap } = structural
  const fracturedIndices: number[] = []

  for (let i = 0; i < pixels.length; i++) {
    if (!pixels[i]) continue
    const matId = pixelMaterials[i] ?? 0
    const strength = Fixed.to(
      materials[matId]?.tensileStrength ?? Fixed.from(Infinity)
    )
    if (stressMap[i]! > strength) {
      fracturedIndices.push(i)
    }
  }

  return { fracturedIndices }
}

/** Apply fracture: zero fractured pixels and drain their stress. */
export function applyFracture(
  structural: StructuralBody,
  fracturedIndices: number[]
): void {
  for (const idx of fracturedIndices) {
    structural.pixels[idx] = 0
    structural.stressMap[idx] = 0
  }
}
