import { Fixed, Vec2 } from 'qti-clockwork-math'
import {
  type PhysicsMaterial,
  type StructuralBody,
  type RigidBody
} from '../components.js'

const MAX_HULL_VERTICES = 16
const PIXEL_AREA = Fixed.from(1)

/** Compute full StructuralBody from raw pixel data. Call once on body creation, again after fracture. */
export function buildStructuralBody(
  pixels: Uint8Array,
  pixelMaterials: Uint8Array,
  width: number,
  height: number,
  materials: PhysicsMaterial[]
): StructuralBody {
  const { mass, centreOfMass, inertia } = computeMassProperties(
    pixels,
    pixelMaterials,
    width,
    height,
    materials
  )
  const hullVertices = computeConvexHull(pixels, width, height)

  return {
    pixels: new Uint8Array(pixels),
    pixelMaterials: new Uint8Array(pixelMaterials),
    width,
    height,
    centreOfMass,
    mass,
    inertia,
    hullVertices,
    stressMap: new Float32Array(pixels.length)
  }
}

export function syncStructuralToRigidBody(
  structural: StructuralBody,
  body: RigidBody
): void {
  body.mass = structural.mass
  body.invMass = body.isStatic
    ? Fixed.from(0)
    : structural.mass === 0
      ? Fixed.from(0)
      : Fixed.div(Fixed.from(1), structural.mass)
  body.inertia = structural.inertia
  body.invInertia = body.isStatic
    ? Fixed.from(0)
    : structural.inertia === 0
      ? Fixed.from(0)
      : Fixed.div(Fixed.from(1), structural.inertia)
}

interface MassProps {
  mass: Fixed
  centreOfMass: Vec2
  inertia: Fixed
}

function computeMassProperties(
  pixels: Uint8Array,
  pixelMaterials: Uint8Array,
  width: number,
  height: number,
  materials: PhysicsMaterial[]
): MassProps {
  let totalMass = Fixed.from(0)
  let sumX = Fixed.from(0)
  let sumY = Fixed.from(0)

  // Pass 1: total mass and density-weighted centroid sum.
  for (let i = 0; i < pixels.length; i++) {
    if (!pixels[i]) continue
    const matId = pixelMaterials[i] ?? 0
    const density = materials[matId]?.density ?? Fixed.from(1)
    const m = Fixed.mul(density, PIXEL_AREA)
    totalMass = Fixed.add(totalMass, m)
    const px = Fixed.from((i % width) + 0.5)
    const py = Fixed.from(Math.floor(i / width) + 0.5)
    sumX = Fixed.add(sumX, Fixed.mul(m, px))
    sumY = Fixed.add(sumY, Fixed.mul(m, py))
  }

  if (totalMass === 0) {
    return {
      mass: Fixed.from(0),
      centreOfMass: Vec2.create(Fixed.from(0), Fixed.from(0)),
      inertia: Fixed.from(0)
    }
  }

  const comX = Fixed.div(sumX, totalMass)
  const comY = Fixed.div(sumY, totalMass)
  const centreOfMass = Vec2.create(comX, comY)

  // Pass 2: moment of inertia using the parallel axis theorem per pixel.
  // For each pixel: I_pixel = m_pixel * (dx² + dy²)
  // where dx,dy is the vector from pixel centre to centre of mass.
  let inertia = Fixed.from(0)
  for (let i = 0; i < pixels.length; i++) {
    if (!pixels[i]) continue
    const matId = pixelMaterials[i] ?? 0
    const density = materials[matId]?.density ?? Fixed.from(1)
    const m = Fixed.mul(density, PIXEL_AREA)
    const px = Fixed.from((i % width) + 0.5)
    const py = Fixed.from(Math.floor(i / width) + 0.5)
    const dx = Fixed.sub(px, comX)
    const dy = Fixed.sub(py, comY)
    const distSq = Fixed.add(Fixed.mul(dx, dx), Fixed.mul(dy, dy))
    inertia = Fixed.add(inertia, Fixed.mul(m, distSq))
  }

  return { mass: totalMass, centreOfMass, inertia }
}

function computeConvexHull(
  pixels: Uint8Array,
  width: number,
  _height: number
): Vec2[] {
  // Collect pixel centre points.
  const points: Vec2[] = []
  for (let i = 0; i < pixels.length; i++) {
    if (!pixels[i]) continue
    points.push(
      Vec2.create(
        Fixed.from((i % width) + 0.5),
        Fixed.from(Math.floor(i / width) + 0.5)
      )
    )
  }

  if (points.length === 0) return []
  if (points.length === 1) return [points[0]!]

  // Gift wrapping (Jarvis march): O(n·h) where n = pixel count, h = hull size.
  // 1. Start from the leftmost point (lowest x, ties broken by lowest y).
  // 2. At each step, find the point making the smallest CCW turn from the current edge.
  //    That is: cross(current→p, current→candidate) < 0 for all other candidates.
  // 3. Stop when we return to the start.
  let startIdx = 0
  for (let i = 1; i < points.length; i++) {
    if (
      points[i]!.x < points[startIdx]!.x ||
      (points[i]!.x === points[startIdx]!.x &&
        points[i]!.y < points[startIdx]!.y)
    ) {
      startIdx = i
    }
  }

  const hull: Vec2[] = []
  let current = startIdx

  do {
    hull.push(points[current]!)
    let next = (current + 1) % points.length

    for (let i = 0; i < points.length; i++) {
      if (i === current) continue
      const c = cross2d(points[current]!, points[next]!, points[i]!)
      if (
        c < 0 ||
        (c === 0 &&
          distSq(points[current]!, points[i]!) >
            distSq(points[current]!, points[next]!))
      ) {
        next = i
      }
    }

    current = next
  } while (current !== startIdx && hull.length <= points.length)

  return hull.length > MAX_HULL_VERTICES
    ? simplifyHull(hull, MAX_HULL_VERTICES)
    : hull
}

function cross2d(o: Vec2, a: Vec2, b: Vec2): number {
  // Signed area of triangle OAB — positive = CCW, negative = CW.
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
}

function distSq(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x
  const dy = a.y - b.y
  return dx * dx + dy * dy
}

function simplifyHull(hull: Vec2[], maxVerts: number): Vec2[] {
  // Merge the two adjacent vertices contributing the least area (cross-product magnitude)
  // until we are at or below maxVerts. O(h²) but h ≤ a few hundred at worst.
  let h = hull.slice()

  while (h.length > maxVerts) {
    let minArea = Infinity
    let minIdx = 0
    for (let i = 0; i < h.length; i++) {
      const prev = h[(i + h.length - 1) % h.length]!
      const curr = h[i]!
      const next = h[(i + 1) % h.length]!
      const area = Math.abs(cross2d(prev, curr, next))
      if (area < minArea) {
        minArea = area
        minIdx = i
      }
    }
    h.splice(minIdx, 1)
  }

  return h
}
