import { Fixed, Vec2 } from 'qti-clockwork-math'
import { type ContactManifold, type ContactPoint } from '../manifold.js'
import { type EntityId } from 'qti-clockwork-ecs'

const SLOP = Fixed.from(0.005) // minimum penetration before we bother resolving
const MAX_CONTACTS = 2

// --- Circle-circle ---------------------------------------------------------

export function testCircleCircle(
  entityA: EntityId,
  centerA: Vec2,
  radiusA: Fixed,
  entityB: EntityId,
  centerB: Vec2,
  radiusB: Fixed
): ContactManifold | null {
  const d = Vec2.sub(centerB, centerA)
  const distSq = Vec2.lenSq(d)
  const radSum = Fixed.add(radiusA, radiusB)

  if (distSq >= Fixed.mul(radSum, radSum)) return null

  const dist = Fixed.sqrt(distSq)
  // Normal from A toward B. If circles are exactly coincident, pick an arbitrary direction.
  const normal =
    dist === 0 ? Vec2.create(Fixed.from(1), Fixed.from(0)) : Vec2.norm(d)
  const penetration = Fixed.sub(radSum, dist)
  const position = Vec2.add(centerA, Vec2.scale(normal, radiusA))

  return makeManifold(entityA, entityB, normal, penetration, position, null)
}

// --- Polygon-circle --------------------------------------------------------

export function testPolygonCircle(
  entityA: EntityId,
  vertsA: Vec2[],
  entityB: EntityId,
  centerB: Vec2,
  radiusB: Fixed
): ContactManifold | null {
  // Voronoi region test: find the closest feature on polygon A to circle center B.
  // Three cases: center is in a vertex region, an edge region, or inside the polygon.
  let minPenetration = Fixed.from(-Infinity)
  let bestFaceIndex = 0

  for (let i = 0; i < vertsA.length; i++) {
    const v = vertsA[i]!
    const next = vertsA[(i + 1) % vertsA.length]!
    const edge = Vec2.sub(next, v)
    // Left-hand perpendicular = outward face normal (assuming CCW winding).
    const normal = Vec2.norm(Vec2.perp(edge))
    const sep = Vec2.dot(normal, Vec2.sub(centerB, v))
    // Circle center is outside this face — definite separating axis.
    if (Fixed.sub(sep, radiusB) > 0) return null
    if (sep > minPenetration) {
      minPenetration = sep
      bestFaceIndex = i
    }
  }

  const v1 = vertsA[bestFaceIndex]!
  const v2 = vertsA[(bestFaceIndex + 1) % vertsA.length]!
  const edge = Vec2.sub(v2, v1)
  const faceNormal = Vec2.norm(Vec2.perp(edge))

  // Determine Voronoi region of circle center relative to the closest edge.
  const toCenter = Vec2.sub(centerB, v1)
  const dotV1 = Vec2.dot(toCenter, Vec2.sub(v2, v1))
  const dotV2 = Vec2.dot(Vec2.sub(centerB, v2), Vec2.sub(v1, v2))

  let normal: Vec2
  let penetration: Fixed
  let position: Vec2

  if (dotV1 <= 0) {
    // Vertex region of v1.
    const d = Vec2.sub(centerB, v1)
    const dist = Vec2.len(d)
    if (dist >= radiusB) return null
    normal =
      dist === 0 ? Vec2.create(Fixed.from(1), Fixed.from(0)) : Vec2.norm(d)
    penetration = Fixed.sub(radiusB, dist)
    position = v1
  } else if (dotV2 <= 0) {
    // Vertex region of v2.
    const d = Vec2.sub(centerB, v2)
    const dist = Vec2.len(d)
    if (dist >= radiusB) return null
    normal =
      dist === 0 ? Vec2.create(Fixed.from(1), Fixed.from(0)) : Vec2.norm(d)
    penetration = Fixed.sub(radiusB, dist)
    position = v2
  } else {
    // Edge region: signed distance from circle center to the face.
    const sep = Vec2.dot(faceNormal, toCenter)
    if (sep >= radiusB) return null
    normal = faceNormal
    penetration = Fixed.sub(radiusB, sep)
    position = Vec2.sub(centerB, Vec2.scale(normal, radiusB))
  }

  return makeManifold(entityA, entityB, normal, penetration, position, null)
}

// --- Polygon-polygon (SAT) -------------------------------------------------

export function testPolygonPolygon(
  entityA: EntityId,
  vertsA: Vec2[],
  entityB: EntityId,
  vertsB: Vec2[]
): ContactManifold | null {
  // SAT: for each face normal of both polygons, project all vertices of the opposite
  // polygon onto that axis. A separating axis exists if the projections do not overlap.
  // The axis of minimum penetration determines the collision normal and depth.
  const axisA = findAxisOfMinPenetration(vertsA, vertsB)
  if (axisA === null) return null

  const axisB = findAxisOfMinPenetration(vertsB, vertsA)
  if (axisB === null) return null

  // Choose the reference face from the polygon whose axis has less penetration
  // (more separating tendency) — this produces stabler contact normals.
  const useA = axisA.penetration <= axisB.penetration
  const refVerts = useA ? vertsA : vertsB
  const incVerts = useA ? vertsB : vertsA
  const refEntity = useA ? entityA : entityB
  const incEntity = useA ? entityB : entityA
  const faceNormal = useA
    ? axisA.normal
    : Vec2.scale(axisB.normal, Fixed.from(-1))
  const penetration = useA ? axisA.penetration : axisB.penetration

  if (penetration < SLOP) return null

  // Sutherland-Hodgman clip: find the reference face and clip the incident face against it.
  // Keep up to MAX_CONTACTS (2) deepest penetrating points.
  const refFaceIdx = bestFaceIndex(refVerts, faceNormal)
  const incFaceIdx = incidentFaceIndex(incVerts, faceNormal)

  const refV1 = refVerts[refFaceIdx]!
  const refV2 = refVerts[(refFaceIdx + 1) % refVerts.length]!
  const incV1 = incVerts[incFaceIdx]!
  const incV2 = incVerts[(incFaceIdx + 1) % incVerts.length]!

  let clipped: Vec2[] = [incV1, incV2]

  // Clip against the side planes of the reference face.
  const refEdge = Vec2.sub(refV2, refV1)
  const sideNormal1 = Vec2.norm(refEdge)
  const sideNormal2 = Vec2.scale(sideNormal1, Fixed.from(-1))

  clipped = clipSegment(clipped, sideNormal1, Vec2.dot(sideNormal1, refV1))
  if (clipped.length === 0) return null
  clipped = clipSegment(clipped, sideNormal2, Vec2.dot(sideNormal2, refV2))
  if (clipped.length === 0) return null

  // Keep only points behind (penetrating) the reference face.
  const refNormal = Vec2.norm(Vec2.perp(refEdge))
  const refD = Vec2.dot(refNormal, refV1)

  const contacts: ContactPoint[] = []
  for (const pt of clipped) {
    const depth = Fixed.sub(refD, Vec2.dot(refNormal, pt))
    if (depth >= Fixed.from(0)) {
      contacts.push({
        position: pt,
        normal: faceNormal,
        penetration: depth,
        normalImpulse: Fixed.from(0),
        tangentImpulse: Fixed.from(0)
      })
    }
  }

  if (contacts.length === 0) return null

  // Keep the 2 deepest contacts.
  contacts.sort((a, b) => b.penetration - a.penetration)
  const kept = contacts.slice(0, MAX_CONTACTS)

  return {
    entityA: refEntity,
    entityB: incEntity,
    points: kept as [ContactPoint] | [ContactPoint, ContactPoint]
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface AxisResult {
  normal: Vec2
  penetration: Fixed
}

function findAxisOfMinPenetration(ref: Vec2[], inc: Vec2[]): AxisResult | null {
  let minPen = Fixed.from(-Infinity)
  let bestNormal = Vec2.create(Fixed.from(1), Fixed.from(0))

  for (let i = 0; i < ref.length; i++) {
    const v = ref[i]!
    const next = ref[(i + 1) % ref.length]!
    // Left-hand perp gives outward normal for CCW winding.
    const normal = Vec2.norm(Vec2.perp(Vec2.sub(next, v)))

    // Minimum projection of the incident polygon onto this normal.
    let minProj = Vec2.dot(normal, inc[0]!)
    for (let j = 1; j < inc.length; j++) {
      const proj = Vec2.dot(normal, inc[j]!)
      if (proj < minProj) minProj = proj
    }

    const faceProj = Vec2.dot(normal, v)
    const sep = Fixed.sub(minProj, faceProj)
    // Positive sep means the incident polygon is on the outside — separating axis found.
    if (sep > 0) return null

    if (sep > minPen) {
      minPen = sep
      bestNormal = normal
    }
  }

  return { normal: bestNormal, penetration: Fixed.neg(minPen) }
}

function bestFaceIndex(verts: Vec2[], normal: Vec2): number {
  let best = 0
  let bestDot = Vec2.dot(normal, Vec2.sub(verts[1]!, verts[0]!))
  for (let i = 1; i < verts.length; i++) {
    const next = (i + 1) % verts.length
    const d = Vec2.dot(normal, Vec2.sub(verts[next]!, verts[i]!))
    if (d > bestDot) {
      bestDot = d
      best = i
    }
  }
  return best
}

function incidentFaceIndex(inc: Vec2[], refNormal: Vec2): number {
  // Most anti-parallel edge normal = incident face.
  let minDot = Fixed.from(Infinity)
  let best = 0
  for (let i = 0; i < inc.length; i++) {
    const next = (i + 1) % inc.length
    const edgeNormal = Vec2.norm(Vec2.perp(Vec2.sub(inc[next]!, inc[i]!)))
    const d = Vec2.dot(refNormal, edgeNormal)
    if (d < minDot) {
      minDot = d
      best = i
    }
  }
  return best
}

function clipSegment(pts: Vec2[], normal: Vec2, offset: Fixed): Vec2[] {
  // Sutherland-Hodgman clip against a half-plane defined by dot(normal, p) >= offset.
  const result: Vec2[] = []
  for (let i = 0; i < pts.length; i++) {
    const curr = pts[i]!
    const next = pts[(i + 1) % pts.length]!
    const dCurr = Fixed.sub(Vec2.dot(normal, curr), offset)
    const dNext = Fixed.sub(Vec2.dot(normal, next), offset)

    if (dCurr >= 0) result.push(curr)
    if (dCurr >= 0 !== dNext >= 0) {
      // Edge crosses the clip plane — compute intersection.
      const t = Fixed.div(dCurr, Fixed.sub(dCurr, dNext))
      result.push(Vec2.lerp(curr, next, t))
    }
  }
  return result
}

function makeManifold(
  entityA: EntityId,
  entityB: EntityId,
  normal: Vec2,
  penetration: Fixed,
  position: Vec2,
  _position2: Vec2 | null
): ContactManifold {
  return {
    entityA,
    entityB,
    points: [
      {
        position,
        normal,
        penetration,
        normalImpulse: Fixed.from(0),
        tangentImpulse: Fixed.from(0)
      }
    ]
  }
}
