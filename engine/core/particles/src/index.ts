import { type AppBuilder, type Plugin } from 'qti-clockwork-app'
import { type EntityId } from 'qti-clockwork-ecs'
import {
  Fixed,
  Vec2,
  type Fixed as FixedScalar,
  type Vec2 as FixedVec2
} from 'qti-clockwork-math'
import { SeededRng, type System } from 'qti-clockwork-scheduler'

export const packageId = 'qti-clockwork-particles'

export const PARTICLE_WORLD_KEY = 'particles:world'
export const VISUAL_PARTICLE_WORLD_KEY = 'particles:visual-world'
export const PARTICLE_RENDER_PASS_KEY = 'particles:render-pass'

export const PARTICLE_EMITTER = Symbol('particles:ParticleEmitter')
export const SIM_PARTICLE_REGION = Symbol('particles:SimParticleRegion')
export const PARTICLE_WORLD_SNAPSHOT = Symbol('particles:ParticleWorldSnapshot')

const FIXED_ZERO = Fixed.from(0)
const IDENTITY_MAT4 = new Float32Array([
  1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1
])

export interface RGBA {
  r: number
  g: number
  b: number
  a: number
}
export interface Vec2f {
  x: number
  y: number
}
export interface Range {
  min: number
  max: number
}
export interface Vec2Range {
  min: Vec2f
  max: Vec2f
}
export interface CurvePoint {
  t: number
  value: number
}
export interface Curve {
  points: readonly CurvePoint[]
}
export interface GradientPoint {
  t: number
  color: RGBA
}
export interface GradientCurve {
  points: readonly GradientPoint[]
}

export type TextureHandle = string | number | symbol | object

export interface SimCell {
  material: number
  velocity: FixedVec2
  temperature: FixedScalar
  pressure: FixedScalar
  metadata: number
}

export type SimParticleType = 'solid' | 'powder' | 'liquid' | 'gas' | 'fire'

export interface SimReaction {
  selfMaterial?: number
  otherMaterial?: number
  emit?: Omit<SimParticleEvent, 'x' | 'y' | 'material'>
}

export interface SimGrid {
  getCell(x: number, y: number): SimCell
  setCell(x: number, y: number, cell: SimCell): void
  isEmpty(x: number, y: number): boolean
  move(ax: number, ay: number, bx: number, by: number): boolean
  random(): number
  emit(event: Omit<SimParticleEvent, 'x' | 'y'>, x: number, y: number): void
}

export interface SimMaterial {
  id: number
  name: string
  density: FixedScalar
  type: SimParticleType
  update(cell: SimCell, grid: SimGrid, x: number, y: number): void
  react(
    self: SimCell,
    other: SimCell,
    selfMat: SimMaterial,
    otherMat: SimMaterial
  ): SimReaction | null
  colour(cell: SimCell): RGBA
  visualEffects?: readonly ParticleVisualEffect[]
}

export interface ParticleVisualEffect {
  event: SimParticleEventType
  preset: ParticleEmitterPresetName
  burstCount: number
  chance?: number
}

export type SimParticleEventType =
  | 'ignite'
  | 'contact'
  | 'explode'
  | 'phase-change'
  | 'erode'

export interface SimParticleEvent {
  type: SimParticleEventType
  material: number
  x: number
  y: number
  intensity: number
  preset?: ParticleEmitterPresetName
  burstCount?: number
}

export interface SimParticleRegion {
  origin: { x: number; y: number }
  size: { width: number; height: number }
  active: boolean
  seed: number
}

export interface ParticleWorldConfig {
  chunkSize: number
  seed: number
}

export const DEFAULT_PARTICLE_WORLD_CONFIG: ParticleWorldConfig = {
  chunkSize: 64,
  seed: 0xdecafbad
}

const DEFAULT_RENDER_GRAPH_RESOURCE_KEYS: readonly unknown[] = [
  'render:graph',
  'passes:graph'
]

interface RegionState {
  id: string
  originX: number
  originY: number
  width: number
  height: number
  active: boolean
  seed: number
  cells: SimCell[]
}

export interface FrozenRegionSnapshot {
  id: string
  originX: number
  originY: number
  width: number
  height: number
  seed: number
  cells: SimCell[]
}

export interface ParticleWorldSnapshotComponent {
  frozenRegions: FrozenRegionSnapshot[]
}

export interface ObstructionStrip {
  minX: number
  maxX: number
  y: number
}

export interface ParticleObstructionAABB {
  min: Vec2f
  max: Vec2f
}

export interface ParticlePhysicsReport {
  buoyancyApplications: number
  pressureApplications: number
  erosionApplications: number
}

interface RigidBodyLike {
  position: FixedVec2
  velocity: FixedVec2
  isStatic: boolean
}

interface ColliderLike {
  shape:
    | { type: 'circle'; radius: FixedScalar }
    | { type: 'aabb'; half: FixedVec2 }
    | { type: 'polygon'; vertices: FixedVec2[] }
    | { type: string }
}

interface StructuralBodyLike {
  pixels: Uint8Array
  width: number
  height: number
  stressMap: Float32Array
}

interface PhysicsTokenSet {
  rigidBody?: unknown
  collider?: unknown
  structural?: unknown
}

interface RenderPassLike {
  name: string
  inputs: string[]
  outputs: string[]
  execute(ctx: RenderContextLike): void
}

interface RenderContextLike {
  graph: unknown
  targets: ReadonlyMap<string, unknown>
}

interface RenderGraphLike {
  addPass(pass: RenderPassLike): void
  removePass?(name: string): void
  compile?(): void
  getExecutionOrder?(): readonly string[]
}

interface SerializerLike {
  register<T>(
    type: unknown,
    schema: {
      version: number
      typeId: string
      serialize(component: T): unknown
      deserialize(data: unknown): T
    }
  ): void
}

const BUILTIN = {
  EMPTY: 0,
  SAND: 1,
  GRAVEL: 2,
  WATER: 3,
  LAVA: 4,
  STONE: 5,
  WOOD: 6,
  FIRE: 7,
  SMOKE: 8,
  STEAM: 9,
  OIL: 10,
  ACID: 11,
  EXPLOSIVES: 12
} as const

function makeCell(material = 0): SimCell {
  return {
    material,
    velocity: Vec2.create(FIXED_ZERO, FIXED_ZERO),
    temperature: FIXED_ZERO,
    pressure: FIXED_ZERO,
    metadata: 0
  }
}

function cloneCell(cell: SimCell): SimCell {
  return {
    material: cell.material,
    velocity: Vec2.create(cell.velocity.x, cell.velocity.y),
    temperature: cell.temperature,
    pressure: cell.pressure,
    metadata: cell.metadata
  }
}

function regionKey(x: number, y: number): string {
  return `${x}:${y}`
}

function resolvePhysicsTokens(worldLike: {
  components?: Map<unknown, unknown>
}): PhysicsTokenSet {
  if (!worldLike.components) {
    return {}
  }

  let rigidBody: unknown
  let collider: unknown
  let structural: unknown

  for (const token of worldLike.components.keys()) {
    if (typeof token !== 'symbol') {
      continue
    }
    const description = token.description ?? ''
    if (!rigidBody && description === 'physics:RigidBody') {
      rigidBody = token
      continue
    }
    if (!collider && description === 'physics:Collider') {
      collider = token
      continue
    }
    if (!structural && description === 'physics:StructuralBody') {
      structural = token
    }
  }

  return { rigidBody, collider, structural }
}

class ParticleObstructionBridge {
  private obstructionEntities: EntityId[] = []

  sync(worldLike: unknown, aabbs: readonly ParticleObstructionAABB[]): void {
    const world = worldLike as {
      components?: Map<unknown, unknown>
      spawnEntity?: () => EntityId
      addComponent?: (
        entity: EntityId,
        token: unknown,
        component: unknown
      ) => void
      destroy?: (entity: EntityId) => void
    }
    const tokens = resolvePhysicsTokens(world)
    if (!tokens.rigidBody || !tokens.collider) {
      return
    }
    if (!world.spawnEntity || !world.addComponent || !world.destroy) {
      return
    }

    for (const entity of this.obstructionEntities) {
      world.destroy(entity)
    }
    this.obstructionEntities = []

    for (const aabb of aabbs) {
      const entity = world.spawnEntity()
      const cx = (aabb.min.x + aabb.max.x) * 0.5
      const cy = (aabb.min.y + aabb.max.y) * 0.5
      const hx = Math.max(0.5, (aabb.max.x - aabb.min.x) * 0.5)
      const hy = Math.max(0.5, (aabb.max.y - aabb.min.y) * 0.5)

      world.addComponent(entity, tokens.rigidBody, {
        position: Vec2.create(Fixed.from(cx), Fixed.from(cy)),
        velocity: Vec2.create(Fixed.from(0), Fixed.from(0)),
        angle: Fixed.from(0),
        angularVelocity: Fixed.from(0),
        mass: Fixed.from(0),
        invMass: Fixed.from(0),
        inertia: Fixed.from(0),
        invInertia: Fixed.from(0),
        restitution: Fixed.from(0),
        friction: Fixed.from(0.8),
        linearDamping: Fixed.from(0),
        angularDamping: Fixed.from(0),
        isStatic: true,
        isSleeping: true,
        sleepTimer: 0
      })
      world.addComponent(entity, tokens.collider, {
        shape: {
          type: 'aabb',
          half: Vec2.create(Fixed.from(hx), Fixed.from(hy))
        },
        offset: Vec2.create(Fixed.from(0), Fixed.from(0)),
        angle: Fixed.from(0)
      })

      this.obstructionEntities.push(entity)
    }
  }
}

function approximateBodyCellBounds(
  body: RigidBodyLike,
  collider: ColliderLike | undefined
): { minX: number; maxX: number; minY: number; maxY: number } {
  const px = Fixed.to(body.position.x)
  const py = Fixed.to(body.position.y)

  if (!collider) {
    return {
      minX: Math.floor(px - 0.5),
      maxX: Math.ceil(px + 0.5),
      minY: Math.floor(py - 0.5),
      maxY: Math.ceil(py + 0.5)
    }
  }

  if (collider.shape.type === 'circle' && 'radius' in collider.shape) {
    const r = Fixed.to(collider.shape.radius)
    return {
      minX: Math.floor(px - r),
      maxX: Math.ceil(px + r),
      minY: Math.floor(py - r),
      maxY: Math.ceil(py + r)
    }
  }

  if (collider.shape.type === 'aabb' && 'half' in collider.shape) {
    const hx = Fixed.to(collider.shape.half.x)
    const hy = Fixed.to(collider.shape.half.y)
    return {
      minX: Math.floor(px - hx),
      maxX: Math.ceil(px + hx),
      minY: Math.floor(py - hy),
      maxY: Math.ceil(py + hy)
    }
  }

  if (collider.shape.type === 'polygon' && 'vertices' in collider.shape) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const vertex of collider.shape.vertices) {
      const vx = px + Fixed.to(vertex.x)
      const vy = py + Fixed.to(vertex.y)
      if (vx < minX) minX = vx
      if (vy < minY) minY = vy
      if (vx > maxX) maxX = vx
      if (vy > maxY) maxY = vy
    }
    return {
      minX: Math.floor(minX),
      maxX: Math.ceil(maxX),
      minY: Math.floor(minY),
      maxY: Math.ceil(maxY)
    }
  }

  return {
    minX: Math.floor(px - 1),
    maxX: Math.ceil(px + 1),
    minY: Math.floor(py - 1),
    maxY: Math.ceil(py + 1)
  }
}

function floatRange(random: () => number, range: Range): number {
  return range.min + random() * (range.max - range.min)
}

function evalCurve(curve: Curve, t: number): number {
  const points = curve.points
  if (points.length === 0) return 1
  if (points.length === 1) return points[0]!.value
  const u = Math.max(0, Math.min(1, t))
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    if (u > b.t) continue
    const span = b.t - a.t
    if (span <= 0) return b.value
    const alpha = (u - a.t) / span
    return a.value + (b.value - a.value) * alpha
  }
  return points[points.length - 1]!.value
}

function evalGradient(curve: GradientCurve, t: number): RGBA {
  const points = curve.points
  if (points.length === 0) return { r: 1, g: 1, b: 1, a: 1 }
  if (points.length === 1) return { ...points[0]!.color }
  const u = Math.max(0, Math.min(1, t))
  for (let i = 1; i < points.length; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    if (u > b.t) continue
    const span = b.t - a.t
    if (span <= 0) return { ...b.color }
    const alpha = (u - a.t) / span
    return {
      r: a.color.r + (b.color.r - a.color.r) * alpha,
      g: a.color.g + (b.color.g - a.color.g) * alpha,
      b: a.color.b + (b.color.b - a.color.b) * alpha,
      a: a.color.a + (b.color.a - a.color.a) * alpha
    }
  }
  return { ...points[points.length - 1]!.color }
}

/** Chunked deterministic simulation grid for gameplay particles. */
export class ParticleWorld {
  readonly config: ParticleWorldConfig
  private readonly materialsById = new Map<number, SimMaterial>()
  private readonly materialsByName = new Map<string, SimMaterial>()
  private readonly regions = new Map<string, RegionState>()
  private readonly frozenRegions = new Map<string, FrozenRegionSnapshot>()
  private readonly obstructionStrips: ObstructionStrip[] = []
  private readonly obstructionAABBs: ParticleObstructionAABB[] = []
  private readonly events: SimParticleEvent[] = []
  private tickCount = 0

  constructor(config?: Partial<ParticleWorldConfig>) {
    this.config = { ...DEFAULT_PARTICLE_WORLD_CONFIG, ...config }
    for (const m of createBuiltinSimMaterials()) this.registerMaterial(m)
  }

  registerMaterial(material: SimMaterial): void {
    if (material.id === 0) throw new Error('Material id 0 is reserved')
    if (this.materialsById.has(material.id))
      throw new Error(`Material id ${material.id} already exists`)
    if (this.materialsByName.has(material.name))
      throw new Error(`Material name "${material.name}" already exists`)
    this.materialsById.set(material.id, material)
    this.materialsByName.set(material.name, material)
  }

  getMaterial(id: number): SimMaterial | undefined {
    return this.materialsById.get(id)
  }
  getMaterialByName(name: string): SimMaterial | undefined {
    return this.materialsByName.get(name)
  }
  getMaterials(): readonly SimMaterial[] {
    return [...this.materialsById.values()].sort((a, b) => a.id - b.id)
  }

  ensureRegion(region: SimParticleRegion): void {
    const fallbackChunk = Math.max(1, Math.floor(this.config.chunkSize))
    const width =
      Number.isFinite(region.size.width) && region.size.width > 0
        ? Math.floor(region.size.width)
        : fallbackChunk
    const height =
      Number.isFinite(region.size.height) && region.size.height > 0
        ? Math.floor(region.size.height)
        : fallbackChunk
    const id = regionKey(region.origin.x, region.origin.y)
    if (!region.active) {
      const active = this.regions.get(id)
      if (active) {
        this.frozenRegions.set(id, this.snapshotRegionState(active))
        this.regions.delete(id)
      }
      return
    }

    const frozen = this.frozenRegions.get(id)
    if (frozen) {
      this.frozenRegions.delete(id)
      this.regions.set(id, {
        id: frozen.id,
        originX: frozen.originX,
        originY: frozen.originY,
        width: frozen.width,
        height: frozen.height,
        active: true,
        seed: region.seed >>> 0,
        cells: frozen.cells.map((cell) => cloneCell(cell))
      })
      return
    }

    const existing = this.regions.get(id)
    if (existing) {
      existing.active = region.active
      existing.seed = region.seed >>> 0
      return
    }

    const cells = new Array<SimCell>(width * height)
    for (let i = 0; i < cells.length; i += 1) cells[i] = makeCell()

    this.regions.set(id, {
      id,
      originX: region.origin.x,
      originY: region.origin.y,
      width,
      height,
      active: region.active,
      seed: region.seed >>> 0,
      cells
    })
  }

  freezeInactiveRegions(): void {
    for (const [id, region] of this.regions.entries()) {
      if (region.active) {
        continue
      }
      this.frozenRegions.set(id, this.snapshotRegionState(region))
      this.regions.delete(id)
    }
  }

  serializeFrozenRegion(id: string): FrozenRegionSnapshot | undefined {
    const region = this.frozenRegions.get(id)
    if (!region) {
      return undefined
    }
    return {
      ...region,
      cells: region.cells.map((cell) => cloneCell(cell))
    }
  }

  getFrozenRegionSnapshots(): FrozenRegionSnapshot[] {
    return [...this.frozenRegions.values()].map((region) => ({
      ...region,
      cells: region.cells.map((cell) => cloneCell(cell))
    }))
  }

  thawRegion(snapshot: FrozenRegionSnapshot): void {
    this.frozenRegions.delete(snapshot.id)
    this.regions.set(snapshot.id, {
      id: snapshot.id,
      originX: snapshot.originX,
      originY: snapshot.originY,
      width: snapshot.width,
      height: snapshot.height,
      active: true,
      seed: snapshot.seed,
      cells: snapshot.cells.map((cell) => cloneCell(cell))
    })
  }

  getCell(x: number, y: number): SimCell {
    const l = this.locateCell(x, y)
    if (!l) return makeCell()
    return cloneCell(l.region.cells[l.index]!)
  }

  setCell(x: number, y: number, cell: SimCell): void {
    const l = this.locateCell(x, y)
    if (!l) return
    l.region.cells[l.index] = cloneCell(cell)
  }

  setMaterial(x: number, y: number, material: number): void {
    const l = this.locateCell(x, y)
    if (!l) return
    const cell = l.region.cells[l.index]!
    cell.material = material
    if (material === 0) {
      cell.velocity = Vec2.create(FIXED_ZERO, FIXED_ZERO)
      cell.temperature = FIXED_ZERO
      cell.pressure = FIXED_ZERO
      cell.metadata = 0
    }
  }

  emit(event: SimParticleEvent): void {
    this.events.push(event)
  }
  drainEvents(): SimParticleEvent[] {
    return this.events.splice(0, this.events.length)
  }

  step(): void {
    this.tickCount += 1
    const active = [...this.regions.values()]
      .filter((r) => r.active)
      .sort((a, b) => a.id.localeCompare(b.id))

    for (const region of active) this.stepRegion(region)
    for (const region of active) this.reactRegion(region)
    this.rebuildObstructions()
  }

  private stepRegion(region: RegionState): void {
    const order = new Array<number>(region.cells.length)
    for (let i = 0; i < order.length; i += 1) order[i] = i

    const rng = new SeededRng(
      (region.seed ^ this.config.seed ^ this.tickCount) >>> 0
    )
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng.nextFloat() * (i + 1))
      const t = order[i]!
      order[i] = order[j]!
      order[j] = t
    }

    const moved = new Uint8Array(region.cells.length)

    const grid: SimGrid = {
      getCell: (x, y) => this.getCell(x, y),
      setCell: (x, y, cell) => this.setCell(x, y, cell),
      isEmpty: (x, y) => {
        const l = this.locateCell(x, y)
        return !l || l.region.cells[l.index]!.material === 0
      },
      move: (ax, ay, bx, by) => {
        const a = this.locateCell(ax, ay)
        const b = this.locateCell(bx, by)
        if (!a || !b) return false
        if (b.region.cells[b.index]!.material !== 0) return false

        b.region.cells[b.index] = cloneCell(a.region.cells[a.index]!)
        a.region.cells[a.index] = makeCell()

        if (a.region.id === region.id) moved[a.index] = 1
        if (b.region.id === region.id) moved[b.index] = 1
        return true
      },
      random: () => rng.nextFloat(),
      emit: (event, x, y) => {
        this.events.push({ ...event, x, y })
        if (event.type === 'explode') {
          this.applyExplosionImpulse(x, y, event.intensity)
        }
      }
    }

    for (const idx of order) {
      if (moved[idx] === 1) continue
      const cell = region.cells[idx]!
      if (cell.material === 0) continue
      const mat = this.materialsById.get(cell.material)
      if (!mat) continue
      const x = region.originX + (idx % region.width)
      const y = region.originY + Math.floor(idx / region.width)
      mat.update(cell, grid, x, y)
    }
  }

  private reactRegion(region: RegionState): void {
    for (let y = 0; y < region.height; y += 1) {
      for (let x = 0; x < region.width; x += 1) {
        const wx = region.originX + x
        const wy = region.originY + y
        const a = this.locateCell(wx, wy)
        if (!a) continue

        const self = a.region.cells[a.index]!
        if (self.material === 0) continue
        const selfMat = this.materialsById.get(self.material)
        if (!selfMat) continue

        const neighbors: Array<[number, number]> = [
          [wx + 1, wy],
          [wx, wy + 1]
        ]

        for (const [nx, ny] of neighbors) {
          const b = this.locateCell(nx, ny)
          if (!b) continue
          const other = b.region.cells[b.index]!
          if (other.material === 0) continue
          const otherMat = this.materialsById.get(other.material)
          if (!otherMat) continue

          const reaction = selfMat.react(self, other, selfMat, otherMat)
          if (!reaction) continue
          if (reaction.selfMaterial !== undefined)
            self.material = reaction.selfMaterial
          if (reaction.otherMaterial !== undefined)
            other.material = reaction.otherMaterial
          if (reaction.emit) {
            const event: SimParticleEvent = {
              type: reaction.emit.type,
              material: selfMat.id,
              x: wx,
              y: wy,
              intensity: reaction.emit.intensity
            }
            if (reaction.emit.preset !== undefined) {
              event.preset = reaction.emit.preset
            }
            if (reaction.emit.burstCount !== undefined) {
              event.burstCount = reaction.emit.burstCount
            }
            this.events.push(event)
            if (event.type === 'explode') {
              this.applyExplosionImpulse(event.x, event.y, event.intensity)
            }
          }
        }
      }
    }
  }

  private applyExplosionImpulse(x: number, y: number, intensity: number): void {
    const radius = Math.max(1, Math.ceil(intensity * 2))
    for (let oy = -radius; oy <= radius; oy += 1) {
      for (let ox = -radius; ox <= radius; ox += 1) {
        const nx = x + ox
        const ny = y + oy
        const hit = this.locateCell(nx, ny)
        if (!hit) {
          continue
        }

        const distance = Math.hypot(ox, oy)
        if (distance > radius) {
          continue
        }

        const falloff = 1 - distance / Math.max(1, radius)
        const pressureDelta = falloff * intensity
        if (pressureDelta <= 0) {
          continue
        }

        const cell = hit.region.cells[hit.index]!
        cell.pressure = Fixed.add(cell.pressure, Fixed.from(pressureDelta))
        cell.temperature = Fixed.add(
          cell.temperature,
          Fixed.from(pressureDelta * 0.75)
        )

        if (cell.material === BUILTIN.EXPLOSIVES && pressureDelta > 0.75) {
          cell.metadata = Math.max(cell.metadata, 1)
        }
        if (
          (cell.material === BUILTIN.WOOD || cell.material === BUILTIN.OIL) &&
          pressureDelta > 0.9
        ) {
          const ignited = makeCell(BUILTIN.FIRE)
          ignited.metadata = 6
          hit.region.cells[hit.index] = ignited
          continue
        }
        if (pressureDelta > 1.25 && cell.material !== BUILTIN.STONE) {
          hit.region.cells[hit.index] = makeCell()
        }
      }
    }
  }

  getObstructionStrips(): readonly ObstructionStrip[] {
    return this.obstructionStrips
  }

  getObstructionAABBs(): readonly ParticleObstructionAABB[] {
    return this.obstructionAABBs
  }

  applyPhysicsInteractions(worldLike: unknown): ParticlePhysicsReport {
    const report: ParticlePhysicsReport = {
      buoyancyApplications: 0,
      pressureApplications: 0,
      erosionApplications: 0
    }

    const world = worldLike as {
      entities: { iterAlive: () => Iterable<EntityId> }
      getComponent: (entity: EntityId, token: unknown) => unknown
      components?: Map<unknown, unknown>
    }

    if (!world?.entities?.iterAlive || !world?.getComponent) {
      return report
    }

    const tokens = resolvePhysicsTokens(world)
    if (!tokens.rigidBody) {
      return report
    }

    for (const entity of world.entities.iterAlive()) {
      const body = world.getComponent(entity, tokens.rigidBody) as
        | RigidBodyLike
        | undefined
      if (!body || body.isStatic) {
        continue
      }

      const collider = tokens.collider
        ? (world.getComponent(entity, tokens.collider) as
            | ColliderLike
            | undefined)
        : undefined
      const cellBounds = approximateBodyCellBounds(body, collider)
      const sampled = this.samplePerimeter(cellBounds)

      if (sampled.liquid > 0) {
        const buoyancy = Fixed.from(sampled.liquid * 0.005)
        body.velocity = Vec2.create(
          body.velocity.x,
          Fixed.add(body.velocity.y, buoyancy)
        )
        report.buoyancyApplications += 1
      }

      if (sampled.gasPressure > 0) {
        const impulse = Fixed.from(sampled.gasPressure * 0.002)
        body.velocity = Vec2.create(
          body.velocity.x,
          Fixed.add(body.velocity.y, impulse)
        )
        report.pressureApplications += 1
      }

      const structural = tokens.structural
        ? (world.getComponent(entity, tokens.structural) as
            | StructuralBodyLike
            | undefined)
        : undefined
      if (!structural) {
        continue
      }

      const erosionEvents = this.erodeStructuralPixels(structural, cellBounds)
      report.erosionApplications += erosionEvents
    }

    return report
  }

  private erodeStructuralPixels(
    structural: StructuralBodyLike,
    bounds: { minX: number; maxX: number; minY: number; maxY: number }
  ): number {
    let eroded = 0
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        const cell = this.getCell(x, y)
        if (cell.material !== BUILTIN.ACID && cell.material !== BUILTIN.FIRE) {
          continue
        }
        const localX = Math.abs(x) % structural.width
        const localY = Math.abs(y) % structural.height
        const idx = localY * structural.width + localX
        if (structural.pixels[idx] === 0) {
          continue
        }
        structural.pixels[idx] = 0
        structural.stressMap[idx] = 999
        eroded += 1
      }
    }
    return eroded
  }

  private samplePerimeter(bounds: {
    minX: number
    maxX: number
    minY: number
    maxY: number
  }): { liquid: number; gasPressure: number } {
    let liquid = 0
    let gasPressure = 0
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      for (const y of [bounds.minY, bounds.maxY]) {
        const cell = this.getCell(x, y)
        const material = this.materialsById.get(cell.material)
        if (!material) {
          continue
        }
        if (material.type === 'liquid') {
          liquid += 1
        }
        if (material.type === 'gas') {
          gasPressure += Math.max(1, Fixed.to(cell.pressure))
        }
      }
    }

    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      for (const x of [bounds.minX, bounds.maxX]) {
        const cell = this.getCell(x, y)
        const material = this.materialsById.get(cell.material)
        if (!material) {
          continue
        }
        if (material.type === 'liquid') {
          liquid += 1
        }
        if (material.type === 'gas') {
          gasPressure += Math.max(1, Fixed.to(cell.pressure))
        }
      }
    }
    return { liquid, gasPressure }
  }

  private rebuildObstructions(): void {
    this.obstructionStrips.length = 0
    this.obstructionAABBs.length = 0

    for (const region of this.regions.values()) {
      for (let y = 0; y < region.height; y += 1) {
        let runStart: number | undefined
        for (let x = 0; x < region.width; x += 1) {
          const cell = region.cells[y * region.width + x]!
          const material = this.materialsById.get(cell.material)
          const solid =
            material?.type === 'solid' || material?.type === 'powder'

          if (solid && runStart === undefined) {
            runStart = x
          }
          if (!solid && runStart !== undefined) {
            this.pushStrip(region, y, runStart, x - 1)
            runStart = undefined
          }
        }
        if (runStart !== undefined) {
          this.pushStrip(region, y, runStart, region.width - 1)
        }
      }
    }
  }

  private pushStrip(
    region: RegionState,
    y: number,
    runStart: number,
    runEnd: number
  ): void {
    const strip = {
      minX: region.originX + runStart,
      maxX: region.originX + runEnd,
      y: region.originY + y
    }
    this.obstructionStrips.push(strip)
    this.obstructionAABBs.push({
      min: { x: strip.minX, y: strip.y },
      max: { x: strip.maxX + 1, y: strip.y + 1 }
    })
  }

  private snapshotRegionState(region: RegionState): FrozenRegionSnapshot {
    return {
      id: region.id,
      originX: region.originX,
      originY: region.originY,
      width: region.width,
      height: region.height,
      seed: region.seed,
      cells: region.cells.map((cell) => cloneCell(cell))
    }
  }

  private locateCell(
    x: number,
    y: number
  ): { region: RegionState; index: number } | undefined {
    for (const region of this.regions.values()) {
      if (
        x < region.originX ||
        y < region.originY ||
        x >= region.originX + region.width ||
        y >= region.originY + region.height
      ) {
        continue
      }
      const lx = x - region.originX
      const ly = y - region.originY
      return { region, index: ly * region.width + lx }
    }
    return undefined
  }
}

export function serializeParticleWorld(
  particleWorld: ParticleWorld
): Uint8Array {
  const payload: ParticleWorldSnapshotComponent = {
    frozenRegions: particleWorld.getFrozenRegionSnapshots()
  }
  return new TextEncoder().encode(JSON.stringify(payload))
}

export function deserializeParticleWorld(
  particleWorld: ParticleWorld,
  bytes: Uint8Array
): void {
  const parsed = JSON.parse(new TextDecoder().decode(bytes)) as
    | ParticleWorldSnapshotComponent
    | undefined
  if (!parsed?.frozenRegions) {
    return
  }
  for (const region of parsed.frozenRegions) {
    particleWorld.thawRegion(region)
    particleWorld.ensureRegion({
      origin: { x: region.originX, y: region.originY },
      size: { width: region.width, height: region.height },
      active: false,
      seed: region.seed
    })
  }
}

export function registerParticleSerialization(
  serializer: SerializerLike
): void {
  serializer.register(PARTICLE_EMITTER, {
    version: 1,
    typeId: 'particles:ParticleEmitter',
    serialize(component: ParticleEmitter) {
      return component
    },
    deserialize(data: unknown) {
      return data as ParticleEmitter
    }
  })
  serializer.register(SIM_PARTICLE_REGION, {
    version: 1,
    typeId: 'particles:SimParticleRegion',
    serialize(component: SimParticleRegion) {
      return component
    },
    deserialize(data: unknown) {
      return data as SimParticleRegion
    }
  })
  serializer.register(PARTICLE_WORLD_SNAPSHOT, {
    version: 1,
    typeId: 'particles:ParticleWorldSnapshot',
    serialize(component: ParticleWorldSnapshotComponent) {
      return component
    },
    deserialize(data: unknown) {
      return data as ParticleWorldSnapshotComponent
    }
  })
}

function makeSolid(
  id: number,
  name: string,
  density: number,
  color: RGBA
): SimMaterial {
  return {
    id,
    name,
    density: Fixed.from(density),
    type: 'solid',
    update() {},
    react() {
      return null
    },
    colour() {
      return color
    }
  }
}

function powderStep(
  grid: SimGrid,
  x: number,
  y: number,
  spreadChance: number
): void {
  const down = y - 1
  if (grid.isEmpty(x, down)) {
    grid.move(x, y, x, down)
    return
  }
  if (grid.random() > spreadChance) return

  const deltas = grid.random() < 0.5 ? [-1, 1] : [1, -1]
  for (const dx of deltas) {
    if (grid.isEmpty(x + dx, down)) {
      grid.move(x, y, x + dx, down)
      return
    }
  }
}

function liquidStep(grid: SimGrid, x: number, y: number): void {
  const down = y - 1
  if (grid.isEmpty(x, down)) {
    grid.move(x, y, x, down)
    return
  }

  const deltas = grid.random() < 0.5 ? [-1, 1] : [1, -1]
  for (const dx of deltas) {
    if (grid.isEmpty(x + dx, down)) {
      grid.move(x, y, x + dx, down)
      return
    }
  }

  for (const dx of deltas) {
    if (grid.isEmpty(x + dx, y)) {
      grid.move(x, y, x + dx, y)
      return
    }
  }
}

function makePowder(
  id: number,
  name: string,
  density: number,
  color: RGBA,
  spreadChance = 0.8
): SimMaterial {
  return {
    id,
    name,
    density: Fixed.from(density),
    type: 'powder',
    update(_cell, grid, x, y) {
      powderStep(grid, x, y, spreadChance)
    },
    react() {
      return null
    },
    colour() {
      return color
    }
  }
}

function makeLiquid(
  id: number,
  name: string,
  density: number,
  color: RGBA
): SimMaterial {
  return {
    id,
    name,
    density: Fixed.from(density),
    type: 'liquid',
    update(cell, grid, x, y) {
      cell.pressure = Fixed.add(cell.pressure, Fixed.from(0.05))
      liquidStep(grid, x, y)
    },
    react() {
      return null
    },
    colour() {
      return color
    }
  }
}

function makeGas(
  id: number,
  name: string,
  density: number,
  color: RGBA
): SimMaterial {
  return {
    id,
    name,
    density: Fixed.from(density),
    type: 'gas',
    update(cell, grid, x, y) {
      cell.pressure = Fixed.add(cell.pressure, Fixed.from(0.02))
      if (cell.metadata > 0) cell.metadata -= 1
      if (cell.metadata === 0 && grid.random() < 0.03) {
        grid.setCell(x, y, makeCell())
        return
      }

      const up = y + 1
      if (grid.isEmpty(x, up)) {
        grid.move(x, y, x, up)
        return
      }

      const deltas = grid.random() < 0.5 ? [-1, 1] : [1, -1]
      for (const dx of deltas) {
        if (grid.isEmpty(x + dx, up)) {
          grid.move(x, y, x + dx, up)
          return
        }
      }

      for (const dx of deltas) {
        if (grid.isEmpty(x + dx, y)) {
          grid.move(x, y, x + dx, y)
          return
        }
      }
    },
    react() {
      return null
    },
    colour() {
      return color
    },
    visualEffects: [
      { event: 'contact', preset: 'smoke', burstCount: 1, chance: 0.1 }
    ]
  }
}

function createBuiltinSimMaterials(): readonly SimMaterial[] {
  const sand = makePowder(BUILTIN.SAND, 'Sand', 2.0, {
    r: 0.78,
    g: 0.7,
    b: 0.35,
    a: 1
  })
  const gravel = makePowder(
    BUILTIN.GRAVEL,
    'Gravel',
    2.6,
    { r: 0.45, g: 0.45, b: 0.45, a: 1 },
    0.4
  )
  const water = makeLiquid(BUILTIN.WATER, 'Water', 1.0, {
    r: 0.22,
    g: 0.42,
    b: 0.95,
    a: 0.85
  })
  const lava = makeLiquid(BUILTIN.LAVA, 'Lava', 2.2, {
    r: 1,
    g: 0.35,
    b: 0.05,
    a: 1
  })
  const stone = makeSolid(BUILTIN.STONE, 'Stone', 3.5, {
    r: 0.38,
    g: 0.38,
    b: 0.38,
    a: 1
  })
  const wood = makeSolid(BUILTIN.WOOD, 'Wood', 0.7, {
    r: 0.55,
    g: 0.37,
    b: 0.2,
    a: 1
  })

  stone.update = (cell, grid, x, y) => {
    if (cell.temperature > Fixed.from(15) && grid.random() < 0.02) {
      grid.setCell(x, y, makeCell(BUILTIN.LAVA))
    }
  }

  wood.react = (_self, other) => {
    if (other.material !== BUILTIN.FIRE && other.material !== BUILTIN.LAVA) {
      return null
    }
    return {
      selfMaterial: BUILTIN.FIRE,
      emit: { type: 'ignite', intensity: 1, preset: 'smoke', burstCount: 2 }
    }
  }
  wood.visualEffects = [{ event: 'ignite', preset: 'smoke', burstCount: 2 }]

  const fire: SimMaterial = {
    id: BUILTIN.FIRE,
    name: 'Fire',
    density: Fixed.from(0.01),
    type: 'fire',
    update(cell, grid, x, y) {
      if (cell.metadata <= 0) cell.metadata = 10
      cell.metadata -= 1

      if (cell.metadata <= 0) {
        if (grid.isEmpty(x, y + 1)) {
          const smoke = makeCell(BUILTIN.SMOKE)
          smoke.metadata = 20
          grid.setCell(x, y + 1, smoke)
        }
        grid.setCell(x, y, makeCell())
        return
      }

      const targets: Array<[number, number]> = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1]
      ]
      for (const [nx, ny] of targets) {
        const other = grid.getCell(nx, ny)
        if (
          other.material !== BUILTIN.WOOD &&
          other.material !== BUILTIN.OIL &&
          other.material !== BUILTIN.EXPLOSIVES
        )
          continue
        if (grid.random() > 0.08) continue

        const next = makeCell(BUILTIN.FIRE)
        next.metadata = 10 + Math.floor(grid.random() * 30)
        grid.setCell(nx, ny, next)
        grid.emit(
          {
            type: 'ignite',
            material: BUILTIN.FIRE,
            intensity: 1,
            preset: 'embers',
            burstCount: 1
          },
          nx,
          ny
        )
      }

      if (grid.random() < 0.7 && grid.isEmpty(x, y + 1))
        grid.move(x, y, x, y + 1)
    },
    react(_self, other) {
      if (other.material !== BUILTIN.WATER) return null
      return {
        selfMaterial: BUILTIN.STEAM,
        otherMaterial: BUILTIN.STEAM,
        emit: {
          type: 'phase-change',
          intensity: 1,
          preset: 'steam',
          burstCount: 6
        }
      }
    },
    colour() {
      return { r: 1, g: 0.45, b: 0.1, a: 1 }
    },
    visualEffects: [
      { event: 'ignite', preset: 'embers', burstCount: 3 },
      { event: 'contact', preset: 'smoke', burstCount: 1, chance: 0.3 }
    ]
  }

  const smoke = makeGas(BUILTIN.SMOKE, 'Smoke', 0.02, {
    r: 0.3,
    g: 0.3,
    b: 0.3,
    a: 0.5
  })
  const steam = makeGas(BUILTIN.STEAM, 'Steam', 0.01, {
    r: 0.85,
    g: 0.85,
    b: 0.95,
    a: 0.5
  })
  const oil = makeLiquid(BUILTIN.OIL, 'Oil', 0.9, {
    r: 0.15,
    g: 0.15,
    b: 0.12,
    a: 0.95
  })
  oil.react = (_self, other) => {
    if (other.material !== BUILTIN.FIRE && other.material !== BUILTIN.LAVA) {
      return null
    }
    return {
      selfMaterial: BUILTIN.FIRE,
      emit: { type: 'ignite', intensity: 1, preset: 'fire', burstCount: 6 }
    }
  }

  const acid: SimMaterial = {
    ...makeLiquid(BUILTIN.ACID, 'Acid', 1.1, {
      r: 0.25,
      g: 0.95,
      b: 0.2,
      a: 0.85
    }),
    update(_cell, grid, x, y) {
      liquidStep(grid, x, y)
      const targets: Array<[number, number]> = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1]
      ]
      for (const [nx, ny] of targets) {
        const other = grid.getCell(nx, ny)
        if (
          other.material === 0 ||
          other.material === BUILTIN.ACID ||
          other.material === BUILTIN.STONE
        )
          continue
        if (grid.random() > 0.02) continue
        grid.setCell(nx, ny, makeCell())
        grid.emit(
          {
            type: 'erode',
            material: BUILTIN.ACID,
            intensity: 1,
            preset: 'splash',
            burstCount: 1
          },
          nx,
          ny
        )
      }
    },
    visualEffects: [{ event: 'erode', preset: 'splash', burstCount: 1 }]
  }

  const explosives: SimMaterial = {
    ...makePowder(BUILTIN.EXPLOSIVES, 'Explosives', 1.5, {
      r: 0.95,
      g: 0.32,
      b: 0.32,
      a: 1
    }),
    update(cell, grid, x, y) {
      const pressureTrigger = Fixed.from(1.8)
      if (cell.pressure >= pressureTrigger) {
        cell.metadata = Math.max(cell.metadata, 1)
      }

      if (cell.metadata > 0) {
        cell.metadata -= 1
        if (cell.metadata <= 0) {
          grid.setCell(x, y, makeCell())
          grid.emit(
            {
              type: 'explode',
              material: BUILTIN.EXPLOSIVES,
              intensity: 4,
              preset: 'explosion',
              burstCount: 42
            },
            x,
            y
          )
          return
        }
      }

      powderStep(grid, x, y, 0.65)
      cell.pressure = Fixed.max(
        FIXED_ZERO,
        Fixed.sub(cell.pressure, Fixed.from(0.1))
      )
    },
    react(_self, other) {
      if (other.material !== BUILTIN.FIRE && other.material !== BUILTIN.LAVA)
        return null
      return {
        selfMaterial: 0,
        emit: {
          type: 'explode',
          intensity: 4,
          preset: 'explosion',
          burstCount: 42
        }
      }
    },
    visualEffects: [{ event: 'explode', preset: 'explosion', burstCount: 24 }]
  }

  lava.react = (_self, other) => {
    if (other.material === BUILTIN.WATER) {
      return {
        selfMaterial: BUILTIN.STONE,
        otherMaterial: BUILTIN.STEAM,
        emit: {
          type: 'phase-change',
          intensity: 1,
          preset: 'steam',
          burstCount: 8
        }
      }
    }
    if (other.material === BUILTIN.WOOD || other.material === BUILTIN.OIL) {
      return {
        otherMaterial: BUILTIN.FIRE,
        emit: { type: 'ignite', intensity: 1, preset: 'fire', burstCount: 4 }
      }
    }
    return null
  }
  lava.visualEffects = [
    { event: 'ignite', preset: 'fire', burstCount: 4 },
    { event: 'phase-change', preset: 'bubbles', burstCount: 8 }
  ]

  return [
    sand,
    gravel,
    water,
    lava,
    stone,
    wood,
    fire,
    smoke,
    steam,
    oil,
    acid,
    explosives
  ]
}

export interface ParticleEmitter {
  position: Vec2f
  active: boolean
  emissionRate: number
  burstCount: number
  initialVelocity: Vec2Range
  initialSpeed: Range
  spread: number
  lifetime: Range
  sizeOverLife: Curve
  alphaOverLife: Curve
  colourOverLife: GradientCurve
  gravity: Vec2f
  drag: number
  texture: TextureHandle | null
  blendMode: 'alpha' | 'additive'
  sortKey: number
}

export interface SimulatedVisualParticle {
  position: Vec2f
  velocity: Vec2f
  age: number
  lifetime: number
  size: number
  alpha: number
  color: RGBA
  texture: TextureHandle | null
  blendMode: 'alpha' | 'additive'
  sortKey: number
}

export interface VisualParticleWorldConfig {
  maxEmitters: number
  maxParticlesPerEmitter: number
}

export const DEFAULT_VISUAL_PARTICLE_WORLD_CONFIG: VisualParticleWorldConfig = {
  maxEmitters: 32,
  maxParticlesPerEmitter: 65536
}

interface VisualEmitterState {
  emitter: ParticleEmitter
  carry: number
  burstUsed: boolean
}

export interface GpuParticleStats {
  activeParticles: number
  emittedThisFrame: number
}

export interface VisualParticleBackend {
  beginFrame(): void
  emit(emitterId: number, emitter: ParticleEmitter, count: number): void
  step(deltaTime: number): void
  endFrame(): GpuParticleStats
  render(viewProjection?: Float32Array): void
}

/** WebGL2 transform-feedback visual particle backend with ring-buffer emission. */
export class TransformFeedbackParticleSimulator implements VisualParticleBackend {
  private static readonly FLOATS_PER_PARTICLE = 30
  private static readonly STRIDE_BYTES =
    TransformFeedbackParticleSimulator.FLOATS_PER_PARTICLE * 4

  private readonly capacity: number
  private active = 0
  private spawnCursor = 0
  private emittedThisFrame = 0

  private readonly vaoA: WebGLVertexArrayObject
  private readonly vaoB: WebGLVertexArrayObject
  private readonly vboA: WebGLBuffer
  private readonly vboB: WebGLBuffer
  private readonly tfA: WebGLTransformFeedback
  private readonly tfB: WebGLTransformFeedback
  private readonly renderVaoA: WebGLVertexArrayObject
  private readonly renderVaoB: WebGLVertexArrayObject
  private readonly updateProgram: WebGLProgram
  private readonly renderProgram: WebGLProgram
  private readonly updateDtLocation: WebGLUniformLocation | null
  private readonly renderViewProjLocation: WebGLUniformLocation | null
  private readonly renderBlendModeLocation: WebGLUniformLocation | null
  private readonly emitQueue: Array<{
    emitterId: number
    emitter: ParticleEmitter
    count: number
  }> = []
  private swap = false

  constructor(
    private readonly gl: WebGL2RenderingContext,
    options?: { capacity?: number }
  ) {
    this.capacity = Math.max(1, Math.floor(options?.capacity ?? 65536))

    const vaoA = gl.createVertexArray()
    const vaoB = gl.createVertexArray()
    const vboA = gl.createBuffer()
    const vboB = gl.createBuffer()
    const tfA = gl.createTransformFeedback()
    const tfB = gl.createTransformFeedback()
    const renderVaoA = gl.createVertexArray()
    const renderVaoB = gl.createVertexArray()

    if (
      !vaoA ||
      !vaoB ||
      !vboA ||
      !vboB ||
      !tfA ||
      !tfB ||
      !renderVaoA ||
      !renderVaoB
    ) {
      throw new Error(
        'Failed to allocate transform-feedback particle resources'
      )
    }

    this.updateProgram = createUpdateProgram(gl)
    this.renderProgram = createRenderProgram(gl)
    this.updateDtLocation = gl.getUniformLocation(this.updateProgram, 'u_dt')
    this.renderViewProjLocation = gl.getUniformLocation(
      this.renderProgram,
      'u_viewProjection'
    )
    this.renderBlendModeLocation = gl.getUniformLocation(
      this.renderProgram,
      'u_renderBlendMode'
    )

    this.vaoA = vaoA
    this.vaoB = vaoB
    this.vboA = vboA
    this.vboB = vboB
    this.tfA = tfA
    this.tfB = tfB
    this.renderVaoA = renderVaoA
    this.renderVaoB = renderVaoB

    const initial = new Float32Array(
      this.capacity * TransformFeedbackParticleSimulator.FLOATS_PER_PARTICLE
    )
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboA)
    gl.bufferData(gl.ARRAY_BUFFER, initial, gl.DYNAMIC_COPY)
    gl.bindBuffer(gl.ARRAY_BUFFER, this.vboB)
    gl.bufferData(gl.ARRAY_BUFFER, initial, gl.DYNAMIC_COPY)

    this.bindUpdateVAO(this.vaoA, this.vboA)
    this.bindUpdateVAO(this.vaoB, this.vboB)
    this.bindRenderVAO(this.renderVaoA, this.vboA)
    this.bindRenderVAO(this.renderVaoB, this.vboB)

    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tfA)
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.vboA)
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, this.tfB)
    gl.bindBufferBase(gl.TRANSFORM_FEEDBACK_BUFFER, 0, this.vboB)
    gl.bindTransformFeedback(gl.TRANSFORM_FEEDBACK, null)
    gl.bindBuffer(gl.ARRAY_BUFFER, null)
    gl.bindVertexArray(null)
  }

  beginFrame(): void {
    this.emittedThisFrame = 0
    this.emitQueue.length = 0
  }

  emit(emitterId: number, emitter: ParticleEmitter, count: number): void {
    if (count <= 0) {
      return
    }
    this.emitQueue.push({ emitterId, emitter, count })
  }

  step(_deltaTime: number): void {
    const incoming = this.flushEmitsToSourceBuffer()
    this.emittedThisFrame = incoming
    this.active = Math.min(this.capacity, this.active + incoming)

    if (this.active === 0) {
      return
    }

    const sourceVao = this.swap ? this.vaoB : this.vaoA
    const targetTf = this.swap ? this.tfA : this.tfB

    this.gl.useProgram(this.updateProgram)
    this.gl.uniform1f(this.updateDtLocation, _deltaTime)
    this.gl.enable(this.gl.RASTERIZER_DISCARD)
    this.gl.bindVertexArray(sourceVao)
    this.gl.bindTransformFeedback(this.gl.TRANSFORM_FEEDBACK, targetTf)
    this.gl.beginTransformFeedback(this.gl.POINTS)
    this.gl.drawArrays(this.gl.POINTS, 0, this.active)
    this.gl.endTransformFeedback()
    this.gl.bindTransformFeedback(this.gl.TRANSFORM_FEEDBACK, null)
    this.gl.bindVertexArray(null)
    this.gl.disable(this.gl.RASTERIZER_DISCARD)
    this.gl.useProgram(null)

    this.swap = !this.swap
  }

  render(viewProjection?: Float32Array): void {
    if (this.active === 0) {
      return
    }

    const vao = this.swap ? this.renderVaoA : this.renderVaoB
    this.gl.useProgram(this.renderProgram)
    if (this.renderViewProjLocation) {
      this.gl.uniformMatrix4fv(
        this.renderViewProjLocation,
        false,
        viewProjection ?? IDENTITY_MAT4
      )
    }
    this.gl.bindVertexArray(vao)
    this.gl.enable(this.gl.BLEND)

    if (this.renderBlendModeLocation) {
      this.gl.uniform1f(this.renderBlendModeLocation, 0)
    }
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)
    this.gl.drawArraysInstanced(this.gl.POINTS, 0, 1, this.active)

    if (this.renderBlendModeLocation) {
      this.gl.uniform1f(this.renderBlendModeLocation, 1)
    }
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE)
    this.gl.drawArraysInstanced(this.gl.POINTS, 0, 1, this.active)

    this.gl.disable(this.gl.BLEND)
    this.gl.bindVertexArray(null)
    this.gl.useProgram(null)
  }

  private flushEmitsToSourceBuffer(): number {
    const sourceVbo = this.swap ? this.vboB : this.vboA
    let emitted = 0

    for (const entry of this.emitQueue) {
      for (let i = 0; i < entry.count; i += 1) {
        emitted += 1
        const idx = this.spawnCursor
        this.spawnCursor = (this.spawnCursor + 1) % this.capacity
        const packed = this.packSpawn(entry.emitter)
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, sourceVbo)
        this.gl.bufferSubData(
          this.gl.ARRAY_BUFFER,
          idx * TransformFeedbackParticleSimulator.STRIDE_BYTES,
          packed
        )
      }
    }
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    return Math.min(emitted, this.capacity)
  }

  endFrame(): GpuParticleStats {
    return {
      activeParticles: this.active,
      emittedThisFrame: this.emittedThisFrame
    }
  }

  private packSpawn(emitter: ParticleEmitter): Float32Array {
    const directionX =
      emitter.initialVelocity.min.x +
      Math.random() *
        (emitter.initialVelocity.max.x - emitter.initialVelocity.min.x)
    const directionY =
      emitter.initialVelocity.min.y +
      Math.random() *
        (emitter.initialVelocity.max.y - emitter.initialVelocity.min.y)
    const len = Math.hypot(directionX, directionY) || 1
    const nx = directionX / len
    const ny = directionY / len
    const theta = (Math.random() - 0.5) * emitter.spread
    const cs = Math.cos(theta)
    const sn = Math.sin(theta)
    const speed =
      emitter.initialSpeed.min +
      Math.random() * (emitter.initialSpeed.max - emitter.initialSpeed.min)
    const vx = (nx * cs - ny * sn) * speed
    const vy = (nx * sn + ny * cs) * speed
    const life = Math.max(
      0.001,
      emitter.lifetime.min +
        Math.random() * (emitter.lifetime.max - emitter.lifetime.min)
    )
    const sizeStart = evalCurve(emitter.sizeOverLife, 0)
    const sizeEnd = evalCurve(emitter.sizeOverLife, 1)
    const alphaStart = evalCurve(emitter.alphaOverLife, 0)
    const alphaEnd = evalCurve(emitter.alphaOverLife, 1)
    const colorStart = evalGradient(emitter.colourOverLife, 0)
    const colorEnd = evalGradient(emitter.colourOverLife, 1)
    const textured = emitter.texture === null ? 0 : 1

    return new Float32Array([
      emitter.position.x,
      emitter.position.y,
      vx,
      vy,
      0,
      life,
      sizeStart,
      alphaStart,
      colorStart.r,
      colorStart.g,
      colorStart.b,
      colorStart.a,
      emitter.gravity.x,
      emitter.gravity.y,
      emitter.drag,
      emitter.sortKey,
      emitter.blendMode === 'additive' ? 1 : 0,
      sizeStart,
      sizeEnd,
      alphaStart,
      alphaEnd,
      colorStart.r,
      colorStart.g,
      colorStart.b,
      colorStart.a,
      colorEnd.r,
      colorEnd.g,
      colorEnd.b,
      colorEnd.a,
      textured
    ])
  }

  private bindUpdateVAO(vao: WebGLVertexArrayObject, vbo: WebGLBuffer): void {
    const gl = this.gl
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    let offset = 0
    const stride = TransformFeedbackParticleSimulator.STRIDE_BYTES
    const bind = (index: number, size: number) => {
      gl.enableVertexAttribArray(index)
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride, offset)
      offset += size * 4
    }
    bind(0, 2)
    bind(1, 2)
    bind(2, 1)
    bind(3, 1)
    bind(4, 1)
    bind(5, 1)
    bind(6, 4)
    bind(7, 2)
    bind(8, 1)
    bind(9, 1)
    bind(10, 1)
    bind(11, 1)
    bind(12, 1)
    bind(13, 1)
    bind(14, 1)
    bind(15, 4)
    bind(16, 4)
    bind(17, 1)
    gl.bindVertexArray(null)
  }

  private bindRenderVAO(vao: WebGLVertexArrayObject, vbo: WebGLBuffer): void {
    const gl = this.gl
    gl.bindVertexArray(vao)
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
    let offset = 0
    const stride = TransformFeedbackParticleSimulator.STRIDE_BYTES
    const bindInstanced = (index: number, size: number) => {
      gl.enableVertexAttribArray(index)
      gl.vertexAttribPointer(index, size, gl.FLOAT, false, stride, offset)
      gl.vertexAttribDivisor(index, 1)
      offset += size * 4
    }
    bindInstanced(0, 2)
    offset += (2 + 1 + 1) * 4
    bindInstanced(1, 1)
    bindInstanced(2, 1)
    bindInstanced(3, 4)
    offset += (2 + 1) * 4
    bindInstanced(4, 1)
    bindInstanced(5, 1)
    offset += (1 + 1 + 1 + 1 + 4 + 4) * 4
    bindInstanced(6, 1)
    gl.bindVertexArray(null)
  }
}

function createUpdateProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `#version 300 es
in vec2 a_position;
in vec2 a_velocity;
in float a_age;
in float a_lifetime;
in float a_size;
in float a_alpha;
in vec4 a_color;
in vec2 a_gravity;
in float a_drag;
in float a_sortKey;
in float a_blendMode;
in float a_sizeStart;
in float a_sizeEnd;
in float a_alphaStart;
in float a_alphaEnd;
in vec4 a_colorStart;
in vec4 a_colorEnd;
in float a_textured;

uniform float u_dt;

out vec2 v_position;
out vec2 v_velocity;
out float v_age;
out float v_lifetime;
out float v_size;
out float v_alpha;
out vec4 v_color;
out vec2 v_gravity;
out float v_drag;
out float v_sortKey;
out float v_blendMode;
out float v_sizeStart;
out float v_sizeEnd;
out float v_alphaStart;
out float v_alphaEnd;
out vec4 v_colorStart;
out vec4 v_colorEnd;
out float v_textured;

void main() {
  float age = a_age + u_dt;
  float alive = step(age, a_lifetime);
  vec2 velocity = a_velocity + a_gravity * u_dt;
  velocity *= max(0.0, 1.0 - a_drag * u_dt);
  vec2 position = a_position + velocity * u_dt;
  float t = clamp(age / max(a_lifetime, 0.001), 0.0, 1.0);
  float size = max(0.0, mix(a_sizeStart, a_sizeEnd, t));
  float alpha = max(0.0, mix(a_alphaStart, a_alphaEnd, t)) * alive;
  vec4 color = mix(a_colorStart, a_colorEnd, t);

  v_position = position;
  v_velocity = velocity;
  v_age = age * alive;
  v_lifetime = a_lifetime;
  v_size = size;
  v_alpha = alpha;
  v_color = color;
  v_gravity = a_gravity;
  v_drag = a_drag;
  v_sortKey = a_sortKey;
  v_blendMode = a_blendMode;
  v_sizeStart = a_sizeStart;
  v_sizeEnd = a_sizeEnd;
  v_alphaStart = a_alphaStart;
  v_alphaEnd = a_alphaEnd;
  v_colorStart = a_colorStart;
  v_colorEnd = a_colorEnd;
  v_textured = a_textured;
}`
  )

  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es
precision highp float;
void main() {}`
  )

  const program = gl.createProgram()
  if (!program) {
    throw new Error('Failed to create transform-feedback update program')
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.transformFeedbackVaryings(
    program,
    [
      'v_position',
      'v_velocity',
      'v_age',
      'v_lifetime',
      'v_size',
      'v_alpha',
      'v_color',
      'v_gravity',
      'v_drag',
      'v_sortKey',
      'v_blendMode',
      'v_sizeStart',
      'v_sizeEnd',
      'v_alphaStart',
      'v_alphaEnd',
      'v_colorStart',
      'v_colorEnd',
      'v_textured'
    ],
    gl.INTERLEAVED_ATTRIBS
  )
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Failed to link transform-feedback update program: ${gl.getProgramInfoLog(program)}`
    )
  }
  return program
}

function createRenderProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertex = compileShader(
    gl,
    gl.VERTEX_SHADER,
    `#version 300 es
in vec2 a_position;
in float a_size;
in float a_alpha;
in vec4 a_color;
in float a_sortKey;
in float a_blendMode;
in float a_textured;

uniform mat4 u_viewProjection;
uniform float u_renderBlendMode;

out vec4 v_color;
out float v_blendMode;
out float v_textured;

void main() {
  gl_Position = u_viewProjection * vec4(a_position, a_sortKey * 0.0001, 1.0);
  gl_PointSize = max(1.0, a_size);
  v_color = vec4(a_color.rgb, a_color.a * a_alpha);
  v_blendMode = a_blendMode;
  v_textured = a_textured;
}`
  )
  const fragment = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    `#version 300 es
precision highp float;
in vec4 v_color;
in float v_blendMode;
in float v_textured;
out vec4 outColor;
void main() {
  if (abs(v_blendMode - u_renderBlendMode) > 0.25) {
    discard;
  }
  vec2 uv = gl_PointCoord * 2.0 - 1.0;
  float mask = v_textured > 0.5 ? 1.0 : smoothstep(1.0, 0.7, dot(uv, uv));
  outColor = vec4(v_color.rgb, v_color.a * mask);
}`
  )
  const program = gl.createProgram()
  if (!program) {
    throw new Error('Failed to create particle render program')
  }
  gl.attachShader(program, vertex)
  gl.attachShader(program, fragment)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(
      `Failed to link particle render program: ${gl.getProgramInfoLog(program)}`
    )
  }
  return program
}

function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) {
    throw new Error('Failed to create shader')
  }
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`)
  }
  return shader
}

/** Visual-only particle simulation state. */
export class VisualParticleWorld {
  readonly config: VisualParticleWorldConfig
  private readonly emitters = new Map<number, VisualEmitterState>()
  private readonly particles = new Map<number, SimulatedVisualParticle[]>()
  private lastGpuStats: GpuParticleStats = {
    activeParticles: 0,
    emittedThisFrame: 0
  }

  constructor(
    config?: Partial<VisualParticleWorldConfig> & {
      backend?: VisualParticleBackend
    },
    private readonly random: () => number = Math.random
  ) {
    this.config = { ...DEFAULT_VISUAL_PARTICLE_WORLD_CONFIG, ...config }
    this.backend = config?.backend
  }

  private readonly backend: VisualParticleBackend | undefined

  upsertEmitter(entity: EntityId, emitter: ParticleEmitter): void {
    const state = this.emitters.get(entity.index)
    if (!state) {
      if (this.emitters.size >= this.config.maxEmitters) return
      this.emitters.set(entity.index, {
        emitter: normalizeEmitter(emitter),
        carry: 0,
        burstUsed: false
      })
      this.particles.set(entity.index, [])
      return
    }
    state.emitter = normalizeEmitter(emitter)
    if (!state.emitter.active) state.burstUsed = false
  }

  pruneEmitters(activeEntityIndices: ReadonlySet<number>): void {
    for (const index of this.emitters.keys()) {
      if (activeEntityIndices.has(index)) continue
      this.emitters.delete(index)
      this.particles.delete(index)
    }
  }

  emitPresetBurst(
    preset: ParticleEmitterPresetName,
    position: Vec2f,
    burstCount?: number
  ): void {
    const emitter = createParticleEmitter(particleEmitterPresets[preset])
    emitter.position = { ...position }
    if (burstCount !== undefined)
      emitter.burstCount = Math.max(0, Math.floor(burstCount))
    this.spawnParticles(-1, emitter, Math.max(1, emitter.burstCount || 1))
  }

  step(dt: number): void {
    const delta = Math.max(0, dt)
    this.backend?.beginFrame()

    for (const [entityIndex, state] of this.emitters.entries()) {
      const emitter = state.emitter
      if (!emitter.active) continue

      if (emitter.burstCount > 0) {
        if (!state.burstUsed) {
          this.spawnParticles(entityIndex, emitter, emitter.burstCount)
          state.burstUsed = true
        }
      } else {
        const total = emitter.emissionRate * delta + state.carry
        const spawn = Math.floor(total)
        state.carry = total - spawn
        if (spawn > 0) this.spawnParticles(entityIndex, emitter, spawn)
      }
    }

    if (this.backend) {
      this.backend.step(delta)
      this.lastGpuStats = this.backend.endFrame()
      return
    }

    for (const [entityIndex, list] of this.particles.entries()) {
      const emitter = this.emitters.get(entityIndex)?.emitter
      const gravity = emitter?.gravity ?? { x: 0, y: 0 }
      const drag = emitter?.drag ?? 0
      const sizeCurve = emitter?.sizeOverLife ?? defaultCurve(1)
      const alphaCurve = emitter?.alphaOverLife ?? defaultCurve(1)
      const colorCurve =
        emitter?.colourOverLife ?? defaultGradient({ r: 1, g: 1, b: 1, a: 1 })

      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i]!
        p.age += delta
        if (p.age >= p.lifetime) {
          list.splice(i, 1)
          continue
        }

        p.velocity.x += gravity.x * delta
        p.velocity.y += gravity.y * delta

        const dragFactor = Math.max(0, 1 - drag * delta)
        p.velocity.x *= dragFactor
        p.velocity.y *= dragFactor

        p.position.x += p.velocity.x * delta
        p.position.y += p.velocity.y * delta

        const t = p.lifetime <= 0 ? 1 : p.age / p.lifetime
        p.size = evalCurve(sizeCurve, t)
        p.alpha = evalCurve(alphaCurve, t)
        p.color = evalGradient(colorCurve, t)
      }
    }
  }

  getParticles(): readonly SimulatedVisualParticle[] {
    if (this.backend) {
      return []
    }
    const out: SimulatedVisualParticle[] = []
    for (const list of this.particles.values()) out.push(...list)
    return out
  }

  getGpuStats(): GpuParticleStats {
    return this.lastGpuStats
  }

  getBackend(): VisualParticleBackend | undefined {
    return this.backend
  }

  private spawnParticles(
    entityIndex: number,
    emitter: ParticleEmitter,
    count: number
  ): void {
    if (this.backend) {
      this.backend.emit(entityIndex, emitter, count)
      return
    }

    let list = this.particles.get(entityIndex)
    if (!list) {
      list = []
      this.particles.set(entityIndex, list)
    }

    const available = Math.max(
      0,
      this.config.maxParticlesPerEmitter - list.length
    )
    const spawnCount = Math.min(available, Math.max(0, Math.floor(count)))

    for (let i = 0; i < spawnCount; i += 1) {
      const dx = floatRange(this.random, {
        min: emitter.initialVelocity.min.x,
        max: emitter.initialVelocity.max.x
      })
      const dy = floatRange(this.random, {
        min: emitter.initialVelocity.min.y,
        max: emitter.initialVelocity.max.y
      })
      const len = Math.hypot(dx, dy)
      const nx = len <= 0 ? 1 : dx / len
      const ny = len <= 0 ? 0 : dy / len

      const theta = (this.random() - 0.5) * emitter.spread
      const cs = Math.cos(theta)
      const sn = Math.sin(theta)
      const speed = floatRange(this.random, emitter.initialSpeed)

      const v = {
        x: (nx * cs - ny * sn) * speed,
        y: (nx * sn + ny * cs) * speed
      }
      const life = Math.max(0.001, floatRange(this.random, emitter.lifetime))

      list.push({
        position: { ...emitter.position },
        velocity: v,
        age: 0,
        lifetime: life,
        size: evalCurve(emitter.sizeOverLife, 0),
        alpha: evalCurve(emitter.alphaOverLife, 0),
        color: evalGradient(emitter.colourOverLife, 0),
        texture: emitter.texture,
        blendMode: emitter.blendMode,
        sortKey: emitter.sortKey
      })
    }
  }
}

export type ParticleEmitterPresetName =
  | 'fire'
  | 'smoke'
  | 'steam'
  | 'sparks'
  | 'dust'
  | 'splash'
  | 'embers'
  | 'explosion'
  | 'blood'
  | 'bubbles'

function defaultCurve(value: number): Curve {
  return {
    points: [
      { t: 0, value },
      { t: 1, value }
    ]
  }
}

function defaultGradient(color: RGBA): GradientCurve {
  return {
    points: [
      { t: 0, color: { ...color } },
      { t: 1, color: { ...color } }
    ]
  }
}

function normalizeEmitter(emitter: ParticleEmitter): ParticleEmitter {
  return {
    ...emitter,
    sizeOverLife:
      emitter.sizeOverLife.points.length === 0
        ? defaultCurve(1)
        : emitter.sizeOverLife,
    alphaOverLife:
      emitter.alphaOverLife.points.length === 0
        ? defaultCurve(1)
        : emitter.alphaOverLife,
    colourOverLife:
      emitter.colourOverLife.points.length === 0
        ? defaultGradient({ r: 1, g: 1, b: 1, a: 1 })
        : emitter.colourOverLife
  }
}

export function createParticleEmitter(
  partial: Partial<ParticleEmitter> = {}
): ParticleEmitter {
  return normalizeEmitter({
    position: partial.position ?? { x: 0, y: 0 },
    active: partial.active ?? true,
    emissionRate: partial.emissionRate ?? 8,
    burstCount: partial.burstCount ?? 0,
    initialVelocity: partial.initialVelocity ?? {
      min: { x: -1, y: 1 },
      max: { x: 1, y: 2 }
    },
    initialSpeed: partial.initialSpeed ?? { min: 0.5, max: 2.5 },
    spread: partial.spread ?? Math.PI / 4,
    lifetime: partial.lifetime ?? { min: 0.5, max: 1.5 },
    sizeOverLife: partial.sizeOverLife ?? defaultCurve(1),
    alphaOverLife: partial.alphaOverLife ?? defaultCurve(1),
    colourOverLife:
      partial.colourOverLife ?? defaultGradient({ r: 1, g: 1, b: 1, a: 1 }),
    gravity: partial.gravity ?? { x: 0, y: -2 },
    drag: partial.drag ?? 0,
    texture: partial.texture ?? null,
    blendMode: partial.blendMode ?? 'alpha',
    sortKey: partial.sortKey ?? 0
  })
}

export const particleEmitterPresets: Record<
  ParticleEmitterPresetName,
  Partial<ParticleEmitter>
> = {
  fire: {
    emissionRate: 24,
    spread: Math.PI / 6,
    lifetime: { min: 0.3, max: 0.9 },
    gravity: { x: 0, y: 0.6 },
    blendMode: 'additive'
  },
  smoke: {
    emissionRate: 14,
    spread: Math.PI / 8,
    lifetime: { min: 1.2, max: 2.4 },
    gravity: { x: 0, y: 1.2 },
    drag: 0.4
  },
  steam: {
    emissionRate: 28,
    spread: Math.PI / 5,
    lifetime: { min: 0.4, max: 1.2 },
    gravity: { x: 0, y: 1.8 },
    drag: 0.25
  },
  sparks: {
    emissionRate: 48,
    spread: Math.PI / 3,
    lifetime: { min: 0.1, max: 0.4 },
    initialSpeed: { min: 4, max: 9 },
    blendMode: 'additive'
  },
  dust: {
    emissionRate: 16,
    spread: Math.PI / 2,
    lifetime: { min: 0.4, max: 1.1 },
    gravity: { x: 0, y: 0.5 },
    drag: 0.8
  },
  splash: {
    emissionRate: 36,
    spread: Math.PI,
    lifetime: { min: 0.2, max: 0.8 },
    initialSpeed: { min: 2, max: 5 },
    gravity: { x: 0, y: -9.81 }
  },
  embers: {
    emissionRate: 10,
    spread: Math.PI / 5,
    lifetime: { min: 1, max: 2 },
    gravity: { x: 0, y: 0.7 },
    blendMode: 'additive'
  },
  explosion: {
    emissionRate: 0,
    burstCount: 120,
    spread: Math.PI * 2,
    initialSpeed: { min: 3, max: 12 },
    lifetime: { min: 0.2, max: 0.9 },
    blendMode: 'additive'
  },
  blood: {
    emissionRate: 20,
    spread: Math.PI / 1.5,
    lifetime: { min: 0.3, max: 1.1 },
    gravity: { x: 0, y: -8.2 }
  },
  bubbles: {
    emissionRate: 18,
    spread: Math.PI / 9,
    lifetime: { min: 0.8, max: 2.6 },
    gravity: { x: 0, y: 1.6 },
    drag: 0.2
  }
}

export interface ParticleRenderPass {
  name: string
  execute(world: VisualParticleWorld): ParticleRenderOutput
}

export interface ParticleRenderOutput {
  particles: readonly SimulatedVisualParticle[]
  gpu: GpuParticleStats
  drawMode: 'instanced-gpu' | 'cpu-fallback'
}

export const DEFAULT_PARTICLE_RENDER_PASS: ParticleRenderPass = {
  name: 'particles',
  execute(world) {
    world.getBackend()?.render()
    const particles = world.getParticles()
    return {
      particles,
      gpu: world.getGpuStats(),
      drawMode: particles.length === 0 ? 'instanced-gpu' : 'cpu-fallback'
    }
  }
}

export interface ParticlePipelineRenderContext extends RenderContextLike {
  particleWorld?: VisualParticleWorld
  viewProjection?: Float32Array
}

/** RenderGraph-compatible pass that executes the particle backend draw call. */
export class ParticleGraphPass implements RenderPassLike {
  readonly name = 'particles'
  readonly inputs: string[] = []
  readonly outputs: string[] = ['particles-color']

  constructor(private readonly world: VisualParticleWorld) {}

  execute(ctx: RenderContextLike): void {
    const typed = ctx as ParticlePipelineRenderContext
    const targetWorld = typed.particleWorld ?? this.world
    targetWorld.getBackend()?.render(typed.viewProjection)
  }
}

function makeSimParticleSystem(particleWorld: ParticleWorld): System {
  const obstructionBridge = new ParticleObstructionBridge()
  return {
    id: 'particles:sim',
    stage: 'FixedUpdate',
    order: -10,
    reads: [SIM_PARTICLE_REGION],
    writes: [],
    execute(ctx) {
      const world = ctx.world as unknown as {
        components: Map<unknown, unknown>
        spawnEntity: () => EntityId
        addComponent: (
          entity: EntityId,
          token: unknown,
          component: unknown
        ) => void
        destroy: (entity: EntityId) => void
        entities: { iterAlive: () => Iterable<EntityId> }
        getComponent: (entity: EntityId, token: unknown) => unknown
        query: () => {
          with: (...tokens: unknown[]) => {
            iter: () => Iterable<{
              entity: EntityId
              components: Map<unknown, unknown>
            }>
          }
        }
      }

      for (const q of world.query().with(SIM_PARTICLE_REGION).iter()) {
        const region = q.components.get(SIM_PARTICLE_REGION) as
          | SimParticleRegion
          | undefined
        if (region) particleWorld.ensureRegion(region)
      }
      particleWorld.step()
      obstructionBridge.sync(world, particleWorld.getObstructionAABBs())
      particleWorld.applyPhysicsInteractions(world)
    }
  }
}

function makeParticleSnapshotSyncSystem(particleWorld: ParticleWorld): System {
  let snapshotEntity: EntityId | undefined
  return {
    id: 'particles:snapshot-sync',
    stage: 'FixedUpdate',
    order: 1000,
    reads: [],
    writes: [PARTICLE_WORLD_SNAPSHOT],
    execute(ctx) {
      const world = ctx.world as unknown as {
        spawnEntity: () => EntityId
        addComponent: (
          entity: EntityId,
          token: unknown,
          component: unknown
        ) => void
      }

      const payload: ParticleWorldSnapshotComponent = {
        frozenRegions: particleWorld.getFrozenRegionSnapshots()
      }

      if (!snapshotEntity) {
        snapshotEntity = world.spawnEntity()
      }
      world.addComponent(snapshotEntity, PARTICLE_WORLD_SNAPSHOT, payload)
    }
  }
}

function makeSerializationRegistrationSystem(serializerToken: unknown): System {
  let registered = false
  return {
    id: 'particles:serialization-register',
    stage: 'Boot',
    order: 0,
    reads: [],
    writes: [],
    execute(ctx) {
      if (registered) {
        return
      }
      const world = ctx.world as unknown as {
        tryGetResource?: (token: unknown) => unknown
      }
      const serializer = world.tryGetResource?.(serializerToken) as
        | SerializerLike
        | undefined
      if (!serializer) {
        return
      }
      registerParticleSerialization(serializer)
      registered = true
    }
  }
}

function makeRenderPassRegistrationSystem(
  pass: ParticleGraphPass,
  resourceKeys: readonly unknown[]
): System {
  let attached = false
  return {
    id: 'particles:render-pass-register',
    stage: 'Boot',
    order: 5,
    reads: [],
    writes: [],
    execute(ctx) {
      if (attached) {
        return
      }
      const world = ctx.world as {
        tryGetResource?: (token: unknown) => unknown
      }
      if (!world.tryGetResource) {
        return
      }

      for (const key of resourceKeys) {
        const graph = world.tryGetResource(key) as RenderGraphLike | undefined
        if (!graph || typeof graph.addPass !== 'function') {
          continue
        }
        try {
          const order = graph.getExecutionOrder?.() ?? []
          if (!order.includes(pass.name)) {
            graph.addPass(pass)
          }
          graph.compile?.()
          attached = true
          return
        } catch (error) {
          const message = (error as { message?: string })?.message ?? ''
          if (message.includes('already exists')) {
            attached = true
            return
          }
        }
      }
    }
  }
}

function makeVisualParticleSystem(visualWorld: VisualParticleWorld): System {
  return {
    id: 'particles:visual',
    stage: 'Render',
    order: 50,
    reads: [PARTICLE_EMITTER],
    writes: [],
    execute(ctx) {
      const world = ctx.world as unknown as {
        query: () => {
          with: (...tokens: unknown[]) => {
            iter: () => Iterable<{
              entity: EntityId
              components: Map<unknown, unknown>
            }>
          }
        }
      }

      const present = new Set<number>()
      for (const q of world.query().with(PARTICLE_EMITTER).iter()) {
        const emitter = q.components.get(PARTICLE_EMITTER) as
          | ParticleEmitter
          | undefined
        if (!emitter) continue
        present.add(q.entity.index)
        visualWorld.upsertEmitter(q.entity, emitter)
      }
      visualWorld.pruneEmitters(present)
      visualWorld.step(ctx.deltaTime)
    }
  }
}

function resolveEntityWorldPosition(
  worldLike: unknown,
  entity: unknown,
  tokens: PhysicsTokenSet
): Vec2f | undefined {
  if (!tokens.rigidBody) {
    return undefined
  }
  const world = worldLike as {
    getComponent?: (entity: unknown, token: unknown) => unknown
  }
  const body = world.getComponent?.(entity, tokens.rigidBody) as
    | RigidBodyLike
    | undefined
  if (!body) {
    return undefined
  }
  return {
    x: Fixed.to(body.position.x),
    y: Fixed.to(body.position.y)
  }
}

function makeBridgeSystem(
  particleWorld: ParticleWorld,
  visualWorld: VisualParticleWorld
): System {
  return {
    id: 'particles:bridge',
    stage: 'RenderPrep',
    order: 25,
    reads: [],
    writes: [],
    execute(ctx) {
      const worldLike = ctx.world as {
        components?: Map<unknown, unknown>
      }
      const physicsTokens = resolvePhysicsTokens(worldLike)

      for (const event of particleWorld.drainEvents()) {
        if (event.preset) {
          visualWorld.emitPresetBurst(
            event.preset,
            { x: event.x, y: event.y },
            event.burstCount
          )
        }

        const material = particleWorld.getMaterial(event.material)
        if (!material?.visualEffects) {
          continue
        }
        for (const effect of material.visualEffects) {
          if (effect.event !== event.type) {
            continue
          }
          if (Math.random() > (effect.chance ?? 1)) {
            continue
          }
          visualWorld.emitPresetBurst(
            effect.preset,
            { x: event.x, y: event.y },
            effect.burstCount
          )
        }
      }

      const buffers = (ctx.events as { buffers?: Map<unknown, unknown[]> })
        .buffers
      if (!buffers) {
        return
      }
      for (const queue of buffers.values()) {
        for (const entry of queue) {
          const ctorName = (entry as { constructor?: { name?: string } })
            .constructor?.name
          const candidate = entry as {
            source?: { index?: number; generation?: number }
            fragments?: unknown[]
          }
          const position = candidate.source
            ? resolveEntityWorldPosition(
                worldLike,
                candidate.source,
                physicsTokens
              )
            : undefined
          if (ctorName === 'BodyFractured') {
            visualWorld.emitPresetBurst('splash', position ?? { x: 0, y: 0 }, 8)
            continue
          }
          if (!candidate.source || !Array.isArray(candidate.fragments)) {
            continue
          }
          visualWorld.emitPresetBurst('splash', position ?? { x: 0, y: 0 }, 6)
        }
      }
    }
  }
}

export function ParticlePlugin(options?: {
  world?: Partial<ParticleWorldConfig>
  visual?: Partial<VisualParticleWorldConfig> & {
    backend?: VisualParticleBackend
  }
  serializerToken?: unknown
  renderGraphResourceKeys?: readonly unknown[]
}): Plugin {
  return {
    id: 'qti-clockwork-particles',
    version: '1.0.0',
    depends: ['qti-clockwork-physics'],
    init(app: AppBuilder) {
      app.components.register(PARTICLE_EMITTER, {
        name: 'ParticleEmitter',
        version: 1,
        fields: [],
        serialize(component) {
          return new TextEncoder().encode(JSON.stringify(component))
        },
        deserialize(data) {
          return JSON.parse(new TextDecoder().decode(data)) as ParticleEmitter
        }
      })
      app.components.register(SIM_PARTICLE_REGION, {
        name: 'SimParticleRegion',
        version: 1,
        fields: [],
        serialize(component) {
          return new TextEncoder().encode(JSON.stringify(component))
        },
        deserialize(data) {
          return JSON.parse(new TextDecoder().decode(data)) as SimParticleRegion
        }
      })
      app.components.register(PARTICLE_WORLD_SNAPSHOT, {
        name: 'ParticleWorldSnapshot',
        version: 1,
        fields: [],
        serialize(component) {
          return new TextEncoder().encode(JSON.stringify(component))
        },
        deserialize(data) {
          return JSON.parse(
            new TextDecoder().decode(data)
          ) as ParticleWorldSnapshotComponent
        }
      })

      const particleWorld = new ParticleWorld(options?.world)
      const visualWorld = new VisualParticleWorld(options?.visual)
      const particlePass = new ParticleGraphPass(visualWorld)

      app.resources.insert(PARTICLE_WORLD_KEY, particleWorld)
      app.resources.insert(VISUAL_PARTICLE_WORLD_KEY, visualWorld)
      app.resources.insert(PARTICLE_RENDER_PASS_KEY, particlePass)

      app.systems.add('FixedUpdate', makeSimParticleSystem(particleWorld), {
        order: -10
      })
      app.systems.add(
        'FixedUpdate',
        makeParticleSnapshotSyncSystem(particleWorld),
        {
          order: 1000
        }
      )
      app.systems.add(
        'Boot',
        makeRenderPassRegistrationSystem(
          particlePass,
          options?.renderGraphResourceKeys ?? DEFAULT_RENDER_GRAPH_RESOURCE_KEYS
        ),
        { order: 5 }
      )
      if (options?.serializerToken !== undefined) {
        app.systems.add(
          'Boot',
          makeSerializationRegistrationSystem(options.serializerToken),
          { order: 0 }
        )
      }
      app.systems.add('Render', makeVisualParticleSystem(visualWorld), {
        order: 50
      })
    }
  }
}

export function ParticleVisualBridgePlugin(): Plugin {
  return {
    id: 'qti-clockwork-particles-visual-bridge',
    version: '1.0.0',
    depends: ['qti-clockwork-particles'],
    init(app: AppBuilder) {
      const particleWorld = app.resources.get<ParticleWorld>(PARTICLE_WORLD_KEY)
      const visualWorld = app.resources.get<VisualParticleWorld>(
        VISUAL_PARTICLE_WORLD_KEY
      )
      if (!particleWorld || !visualWorld) return
      app.systems.add(
        'RenderPrep',
        makeBridgeSystem(particleWorld, visualWorld),
        { order: 25 }
      )
    }
  }
}
