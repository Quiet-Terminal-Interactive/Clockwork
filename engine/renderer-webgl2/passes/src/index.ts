import type { BlendMode } from 'qti-clockwork-gl'
import type { AtlasRegion, Texture } from 'qti-clockwork-materials'

export const packageId = 'qti-clockwork-passes'

export interface Vec2 {
  x: number
  y: number
}

export interface Color {
  r: number
  g: number
  b: number
  a: number
}

export interface Transform2D {
  position: Vec2
  rotation: number
  scale: Vec2
  zIndex: number
  parent?: number
}

export interface WorldTransform2D {
  position: Vec2
  rotation: number
  scale: Vec2
  zIndex: number
}

export interface Camera2D {
  position: Vec2
  zoom: number
  viewport: { x: number; y: number; width: number; height: number }
  clearColor: Color
  layerMask: number
}

export interface CameraFollow {
  speed: number
}
export function computeWorldTransforms(
  transforms: ReadonlyMap<number, Transform2D>
): Map<number, WorldTransform2D> {
  const out = new Map<number, WorldTransform2D>()
  const visiting = new Set<number>()

  const solve = (id: number): WorldTransform2D => {
    const cached = out.get(id)
    if (cached) {
      return cached
    }

    const local = transforms.get(id)
    if (!local) {
      throw new Error(`Missing transform for entity ${id}`)
    }

    if (visiting.has(id)) {
      throw new Error(`Transform cycle detected at entity ${id}`)
    }

    visiting.add(id)
    let world: WorldTransform2D

    if (local.parent === undefined) {
      world = {
        position: { ...local.position },
        rotation: local.rotation,
        scale: { ...local.scale },
        zIndex: local.zIndex
      }
    } else {
      const parent = solve(local.parent)
      world = composeTransform(parent, local)
    }

    visiting.delete(id)
    out.set(id, world)
    return world
  }

  for (const id of transforms.keys()) {
    solve(id)
  }

  return out
}
export function updateCameraFollow(
  camera: Camera2D,
  target: Vec2,
  follow: CameraFollow,
  deltaTime: number
): void {
  const alpha =
    1 - Math.exp(-Math.max(0, follow.speed) * Math.max(0, deltaTime))
  camera.position.x += (target.x - camera.position.x) * alpha
  camera.position.y += (target.y - camera.position.y) * alpha
}
export function worldToScreen(camera: Camera2D, worldPos: Vec2): Vec2 {
  assertValidZoom(camera.zoom)
  const dx = worldPos.x - camera.position.x
  const dy = worldPos.y - camera.position.y
  const halfW = camera.viewport.width * 0.5
  const halfH = camera.viewport.height * 0.5

  // Screen Y grows downward, so world-space Y must flip sign at projection time.
  return {
    x: camera.viewport.x + halfW + dx * camera.zoom,
    y: camera.viewport.y + halfH - dy * camera.zoom
  }
}
export function screenToWorld(camera: Camera2D, screenPos: Vec2): Vec2 {
  assertValidZoom(camera.zoom)
  const halfW = camera.viewport.width * 0.5
  const halfH = camera.viewport.height * 0.5

  // Inverse of worldToScreen: undo viewport offset, then un-flip Y around the camera origin.
  return {
    x:
      camera.position.x +
      (screenPos.x - camera.viewport.x - halfW) / camera.zoom,
    y:
      camera.position.y -
      (screenPos.y - camera.viewport.y - halfH) / camera.zoom
  }
}

function composeTransform(
  parent: WorldTransform2D,
  local: Transform2D
): WorldTransform2D {
  const scaled = {
    x: local.position.x * parent.scale.x,
    y: local.position.y * parent.scale.y
  }

  const c = Math.cos(parent.rotation)
  const s = Math.sin(parent.rotation)
  const rotated = {
    x: scaled.x * c - scaled.y * s,
    y: scaled.x * s + scaled.y * c
  }

  return {
    position: {
      x: parent.position.x + rotated.x,
      y: parent.position.y + rotated.y
    },
    rotation: parent.rotation + local.rotation,
    scale: {
      x: parent.scale.x * local.scale.x,
      y: parent.scale.y * local.scale.y
    },
    zIndex: parent.zIndex + local.zIndex
  }
}

export interface Sprite {
  texture: Texture
  region?: string | AtlasRegion
  tint: Color
  pivot: Vec2
  flipX: boolean
  flipY: boolean
  blendMode: BlendMode
  visible: boolean
  size?: Vec2
}

export interface DrawSpriteInput {
  transform: WorldTransform2D | Transform2D
  sprite: Sprite
  regionLookup?: (name: string) => AtlasRegion | undefined
}

export interface BatchStats {
  spriteCount: number
  drawCalls: number
  vertexCount: number
  indexCount: number
}

const FLOATS_PER_VERTEX = 8
const VERTICES_PER_SPRITE = 4
const INDICES_PER_SPRITE = 6
const MAX_SPRITES_PER_BATCH = Math.floor(0xffff / VERTICES_PER_SPRITE)

interface SpriteCommand {
  input: DrawSpriteInput
  order: number
}
/** Texture-sorted sprite batcher that minimizes draw calls via state grouping. */
export class SpriteBatch {
  private readonly capacity: number
  private readonly commands: SpriteCommand[] = []
  private activeCamera: Camera2D | undefined

  private readonly verticesStore: Float32Array
  private readonly indicesStore: Uint16Array

  private vertexCount = 0
  private indexCount = 0
  private nextOrder = 0

  constructor(maxSprites = 2048) {
    if (!Number.isFinite(maxSprites) || maxSprites < 1) {
      throw new Error('SpriteBatch maxSprites must be a finite number >= 1')
    }
    this.capacity = Math.floor(maxSprites)
    if (this.capacity > MAX_SPRITES_PER_BATCH) {
      throw new Error(
        `SpriteBatch maxSprites exceeds Uint16 index capacity (${MAX_SPRITES_PER_BATCH})`
      )
    }
    this.verticesStore = new Float32Array(
      this.capacity * VERTICES_PER_SPRITE * FLOATS_PER_VERTEX
    )
    this.indicesStore = new Uint16Array(this.capacity * INDICES_PER_SPRITE)
  }

  begin(camera: Camera2D): void {
    this.activeCamera = camera
    this.commands.length = 0
    this.vertexCount = 0
    this.indexCount = 0
    this.nextOrder = 0
  }

  draw(transform: WorldTransform2D | Transform2D, sprite: Sprite): void {
    this.drawWithRegionResolver({ transform, sprite })
  }

  drawWithRegionResolver(input: DrawSpriteInput): void {
    if (!this.activeCamera) {
      throw new Error('SpriteBatch.begin must be called before draw')
    }
    if (!input.sprite.visible) {
      return
    }
    this.commands.push({ input, order: this.nextOrder++ })
  }

  flush(): BatchStats {
    const sorted = [...this.commands].sort((a, b) => {
      const az = a.input.transform.zIndex
      const bz = b.input.transform.zIndex
      if (az !== bz) {
        return az - bz
      }

      const at = getTextureKey(a.input.sprite.texture)
      const bt = getTextureKey(b.input.sprite.texture)
      if (at !== bt) {
        return at - bt
      }

      if (a.input.sprite.blendMode < b.input.sprite.blendMode) {
        return -1
      }
      if (a.input.sprite.blendMode > b.input.sprite.blendMode) {
        return 1
      }
      return a.order - b.order
    })

    let drawCalls = 0
    let currentTexture: Texture | undefined
    let currentBlend: BlendMode | undefined

    this.vertexCount = 0
    this.indexCount = 0

    for (const cmd of sorted) {
      const needsFlush =
        this.vertexCount + VERTICES_PER_SPRITE >
          this.capacity * VERTICES_PER_SPRITE ||
        currentTexture !== cmd.input.sprite.texture ||
        currentBlend !== cmd.input.sprite.blendMode

      if (needsFlush && this.indexCount > 0) {
        drawCalls += 1
        this.vertexCount = 0
        this.indexCount = 0
      }

      this.writeSprite(cmd.input)
      currentTexture = cmd.input.sprite.texture
      currentBlend = cmd.input.sprite.blendMode
    }

    if (this.indexCount > 0) {
      drawCalls += 1
    }

    return {
      spriteCount: sorted.length,
      drawCalls,
      vertexCount: sorted.length * VERTICES_PER_SPRITE,
      indexCount: sorted.length * INDICES_PER_SPRITE
    }
  }

  end(): BatchStats {
    const stats = this.flush()
    this.commands.length = 0
    this.activeCamera = undefined
    return stats
  }

  get vertices(): Float32Array {
    return this.verticesStore
  }

  get indices(): Uint16Array {
    return this.indicesStore
  }

  private writeSprite(cmd: DrawSpriteInput): void {
    const { sprite, transform } = cmd
    const region = resolveRegion(cmd)
    const size = sprite.size ?? {
      x: region.width,
      y: region.height
    }

    const pivotOffset = {
      x: sprite.pivot.x * size.x,
      y: sprite.pivot.y * size.y
    }

    const baseX = transform.position.x
    const baseY = transform.position.y
    const c = Math.cos(transform.rotation)
    const s = Math.sin(transform.rotation)

    const u0 = sprite.flipX ? region.u1 : region.u0
    const v0 = sprite.flipY ? region.v1 : region.v0
    const u1 = sprite.flipX ? region.u0 : region.u1
    const v1 = sprite.flipY ? region.v0 : region.v1

    const corners = [
      { x: -pivotOffset.x, y: -pivotOffset.y, u: u0, v: v0 },
      { x: size.x - pivotOffset.x, y: -pivotOffset.y, u: u1, v: v0 },
      { x: size.x - pivotOffset.x, y: size.y - pivotOffset.y, u: u1, v: v1 },
      { x: -pivotOffset.x, y: size.y - pivotOffset.y, u: u0, v: v1 }
    ]

    const vertexBase = this.vertexCount * FLOATS_PER_VERTEX
    for (const [i, local] of corners.entries()) {
      const worldX = baseX + local.x * c - local.y * s
      const worldY = baseY + local.x * s + local.y * c

      const offset = vertexBase + i * FLOATS_PER_VERTEX
      this.verticesStore[offset + 0] = worldX
      this.verticesStore[offset + 1] = worldY
      this.verticesStore[offset + 2] = local.u
      this.verticesStore[offset + 3] = local.v
      this.verticesStore[offset + 4] = sprite.tint.r
      this.verticesStore[offset + 5] = sprite.tint.g
      this.verticesStore[offset + 6] = sprite.tint.b
      this.verticesStore[offset + 7] = sprite.tint.a
    }

    const indexBaseVertex = this.vertexCount
    const indexBase = this.indexCount
    this.indicesStore[indexBase + 0] = indexBaseVertex + 0
    this.indicesStore[indexBase + 1] = indexBaseVertex + 1
    this.indicesStore[indexBase + 2] = indexBaseVertex + 2
    this.indicesStore[indexBase + 3] = indexBaseVertex + 0
    this.indicesStore[indexBase + 4] = indexBaseVertex + 2
    this.indicesStore[indexBase + 5] = indexBaseVertex + 3

    this.vertexCount += VERTICES_PER_SPRITE
    this.indexCount += INDICES_PER_SPRITE
  }
}

function resolveRegion(cmd: DrawSpriteInput): AtlasRegion {
  const region = cmd.sprite.region

  if (!region) {
    return {
      x: 0,
      y: 0,
      width: cmd.sprite.texture.width,
      height: cmd.sprite.texture.height,
      u0: 0,
      v0: 0,
      u1: 1,
      v1: 1
    }
  }

  if (typeof region !== 'string') {
    return region
  }

  const resolved = cmd.regionLookup?.(region)
  if (!resolved) {
    throw new Error(`Missing atlas region "${region}"`)
  }
  return resolved
}

let textureKeyCounter = 0
const textureKeys = new WeakMap<object, number>()

function getTextureKey(texture: Texture): number {
  const asObject = texture as unknown as object
  const cached = textureKeys.get(asObject)
  if (cached !== undefined) {
    return cached
  }
  textureKeyCounter += 1
  textureKeys.set(asObject, textureKeyCounter)
  return textureKeyCounter
}

export interface GlyphInfo {
  char: string
  x: number
  y: number
  width: number
  height: number
  xOffset: number
  yOffset: number
  xAdvance: number
}

export type TextAlign = 'left' | 'center' | 'right'

export interface Text {
  content: string
  font: Font
  fontSize: number
  color: Color
  align: TextAlign
  wrapWidth?: number
}

export interface PositionedGlyph {
  glyph: GlyphInfo
  x: number
  y: number
  u0: number
  v0: number
  u1: number
  v1: number
}

export interface TextLayout {
  width: number
  height: number
  lines: number
  glyphs: PositionedGlyph[]
}
/** Bitmap font backed by a texture atlas with per-glyph metric lookup. */
export class Font {
  readonly glyphs = new Map<string, GlyphInfo>()

  constructor(
    readonly atlas: Texture,
    glyphs: ReadonlyMap<string, GlyphInfo> | Record<string, GlyphInfo>,
    readonly lineHeight: number,
    readonly baseline: number
  ) {
    if (glyphs instanceof Map) {
      for (const [char, glyph] of glyphs) {
        this.glyphs.set(char, glyph)
      }
      return
    }

    for (const [char, glyph] of Object.entries(glyphs)) {
      this.glyphs.set(char, glyph)
    }
  }

  getGlyph(char: string): GlyphInfo | undefined {
    return this.glyphs.get(char) ?? this.glyphs.get('?')
  }
}
export function layoutText(text: Text): TextLayout {
  const scale = text.fontSize / text.font.lineHeight
  const lines: Array<{
    glyphs: Array<{ glyph: GlyphInfo; x: number }>
    width: number
  }> = [{ glyphs: [], width: 0 }]

  let lineIndex = 0

  const pushLine = (): void => {
    lines.push({ glyphs: [], width: 0 })
    lineIndex += 1
  }

  for (const char of text.content) {
    if (char === '\n') {
      pushLine()
      continue
    }

    const glyph = text.font.getGlyph(char)
    if (!glyph) {
      continue
    }

    const current = lines[lineIndex]
    if (!current) {
      continue
    }
    const nextWidth = current.width + glyph.xAdvance * scale

    if (
      text.wrapWidth !== undefined &&
      current.glyphs.length > 0 &&
      nextWidth > text.wrapWidth
    ) {
      pushLine()
    }

    const target = lines[lineIndex]
    if (!target) {
      continue
    }
    target.glyphs.push({ glyph, x: target.width })
    target.width += glyph.xAdvance * scale
  }

  const maxWidth = lines.reduce((max, line) => Math.max(max, line.width), 0)
  const glyphs: PositionedGlyph[] = []

  for (const [i, line] of lines.entries()) {
    const alignOffset =
      text.align === 'center'
        ? (maxWidth - line.width) * 0.5
        : text.align === 'right'
          ? maxWidth - line.width
          : 0

    for (const item of line.glyphs) {
      const x = alignOffset + (item.x + item.glyph.xOffset * scale)
      const y = i * text.font.lineHeight * scale + item.glyph.yOffset * scale

      glyphs.push({
        glyph: item.glyph,
        x,
        y,
        u0: item.glyph.x / text.font.atlas.width,
        v0: item.glyph.y / text.font.atlas.height,
        u1: (item.glyph.x + item.glyph.width) / text.font.atlas.width,
        v1: (item.glyph.y + item.glyph.height) / text.font.atlas.height
      })
    }
  }

  return {
    width: maxWidth,
    height: lines.length * text.font.lineHeight * scale,
    lines: lines.length,
    glyphs
  }
}
export function drawText(
  batch: SpriteBatch,
  transform: WorldTransform2D | Transform2D,
  text: Text
): TextLayout {
  const layout = layoutText(text)
  const scale = text.fontSize / text.font.lineHeight

  for (const glyph of layout.glyphs) {
    batch.draw(
      {
        position: {
          x: transform.position.x + glyph.x,
          y: transform.position.y + glyph.y
        },
        rotation: transform.rotation,
        scale: transform.scale,
        zIndex: transform.zIndex
      },
      {
        texture: text.font.atlas,
        tint: text.color,
        pivot: { x: 0, y: 0 },
        flipX: false,
        flipY: false,
        blendMode: 'alpha',
        visible: true,
        size: { x: glyph.glyph.width * scale, y: glyph.glyph.height * scale },
        region: {
          x: glyph.glyph.x,
          y: glyph.glyph.y,
          width: glyph.glyph.width,
          height: glyph.glyph.height,
          u0: glyph.u0,
          v0: glyph.v0,
          u1: glyph.u1,
          v1: glyph.v1
        }
      }
    )
  }

  return layout
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface PrimitiveVertex {
  x: number
  y: number
  color: Color
}

export interface PrimitiveStats {
  vertexCount: number
  lineSegments: number
  triangleCount: number
}
/** Immediate-mode geometry collector for debug lines, rects, and circles. */
export class PrimitiveBatch {
  private readonly lines: PrimitiveVertex[] = []
  private readonly triangles: PrimitiveVertex[] = []

  drawLine(start: Vec2, end: Vec2, color: Color, thickness = 1): void {
    if (thickness <= 1) {
      this.lines.push({ x: start.x, y: start.y, color })
      this.lines.push({ x: end.x, y: end.y, color })
      return
    }

    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    if (length === 0) {
      return
    }
    // Thick lines are quads so this normal offsets each side by half thickness.
    const nx = (-dy / length) * (thickness * 0.5)
    const ny = (dx / length) * (thickness * 0.5)

    const a = { x: start.x - nx, y: start.y - ny }
    const b = { x: start.x + nx, y: start.y + ny }
    const c = { x: end.x + nx, y: end.y + ny }
    const d = { x: end.x - nx, y: end.y - ny }

    this.pushTriangle(a, b, c, color)
    this.pushTriangle(a, c, d, color)
  }

  drawRect(rect: Rect, color: Color, filled: boolean): void {
    const a = { x: rect.x, y: rect.y }
    const b = { x: rect.x + rect.width, y: rect.y }
    const c = { x: rect.x + rect.width, y: rect.y + rect.height }
    const d = { x: rect.x, y: rect.y + rect.height }

    if (filled) {
      this.pushTriangle(a, b, c, color)
      this.pushTriangle(a, c, d, color)
      return
    }

    this.drawLine(a, b, color)
    this.drawLine(b, c, color)
    this.drawLine(c, d, color)
    this.drawLine(d, a, color)
  }

  drawCircle(
    center: Vec2,
    radius: number,
    color: Color,
    segments = 24,
    filled = false
  ): void {
    const count = Math.max(3, Math.floor(segments))
    const points: Vec2[] = []

    for (let i = 0; i < count; i += 1) {
      const theta = (i / count) * Math.PI * 2
      points.push({
        x: center.x + Math.cos(theta) * radius,
        y: center.y + Math.sin(theta) * radius
      })
    }

    this.drawPolygon(points, color, filled)
  }

  drawPolygon(points: Vec2[], color: Color, filled: boolean): void {
    if (points.length < 2) {
      return
    }

    if (!filled) {
      for (let i = 0; i < points.length; i += 1) {
        const a = points[i]
        const b = points[(i + 1) % points.length]
        if (!a || !b) {
          continue
        }
        this.drawLine(a, b, color)
      }
      return
    }

    if (points.length < 3) {
      return
    }
    const root = points[0]
    if (!root) {
      return
    }

    // Triangle fan is O(n) and perfect for the convex debug polygons we draw here.
    for (let i = 1; i < points.length - 1; i += 1) {
      const b = points[i]
      const c = points[i + 1]
      if (!b || !c) {
        continue
      }
      this.pushTriangle(root, b, c, color)
    }
  }

  flush(): PrimitiveStats {
    return {
      vertexCount: this.lines.length + this.triangles.length,
      lineSegments: this.lines.length / 2,
      triangleCount: this.triangles.length / 3
    }
  }

  clear(): void {
    this.lines.length = 0
    this.triangles.length = 0
  }

  getLineVertices(): readonly PrimitiveVertex[] {
    return this.lines
  }

  getTriangleVertices(): readonly PrimitiveVertex[] {
    return this.triangles
  }

  private pushTriangle(a: Vec2, b: Vec2, c: Vec2, color: Color): void {
    this.triangles.push(
      { x: a.x, y: a.y, color },
      { x: b.x, y: b.y, color },
      { x: c.x, y: c.y, color }
    )
  }
}

export interface RenderPass {
  name: string
  inputs: string[]
  outputs: string[]
  setup?(graph: RenderGraph): void
  execute(ctx: RenderContext): void
}

export interface RenderContext {
  graph: RenderGraph
  targets: ReadonlyMap<string, RenderTarget>
}
export class RenderTarget {
  constructor(
    readonly texture: Texture | undefined,
    readonly width: number,
    readonly height: number,
    readonly framebuffer?: WebGLFramebuffer
  ) {}
}
/** Dependency-driven render pass scheduler using topological sort. */
export class RenderGraph {
  private readonly passes = new Map<string, RenderPass>()
  private readonly targets = new Map<string, RenderTarget>()
  private executionOrder: RenderPass[] = []
  private compiled = false

  addPass(pass: RenderPass): void {
    if (this.passes.has(pass.name)) {
      throw new Error(`Render pass "${pass.name}" already exists`)
    }
    this.passes.set(pass.name, pass)
  }

  removePass(name: string): void {
    this.passes.delete(name)
    this.compiled = false
  }

  defineRenderTarget(name: string, target: RenderTarget): void {
    this.targets.set(name, target)
  }

  getRenderTarget(name: string): RenderTarget {
    const target = this.targets.get(name)
    if (!target) {
      throw new Error(`Unknown render target "${name}"`)
    }
    return target
  }

  compile(): void {
    const producedBy = new Map<string, string>()
    for (const pass of this.passes.values()) {
      for (const output of pass.outputs) {
        const previous = producedBy.get(output)
        if (previous && previous !== pass.name) {
          throw new Error(
            `Render target "${output}" is produced by multiple passes ("${previous}" and "${pass.name}")`
          )
        }
        producedBy.set(output, pass.name)
      }
    }

    const edges = new Map<string, Set<string>>()
    const indegree = new Map<string, number>()

    for (const pass of this.passes.values()) {
      edges.set(pass.name, new Set<string>())
      indegree.set(pass.name, 0)
    }

    for (const pass of this.passes.values()) {
      for (const input of pass.inputs) {
        const producer = producedBy.get(input)
        if (!producer || producer === pass.name) {
          continue
        }
        edges.get(producer)?.add(pass.name)
      }
    }

    for (const [from, tos] of edges.entries()) {
      void from
      for (const to of tos) {
        indegree.set(to, (indegree.get(to) ?? 0) + 1)
      }
    }

    const queue = [...this.passes.keys()].filter(
      (name) => (indegree.get(name) ?? 0) === 0
    )
    const order: RenderPass[] = []

    while (queue.length > 0) {
      const name = queue.shift()
      if (!name) {
        continue
      }
      const pass = this.passes.get(name)
      if (!pass) {
        continue
      }
      pass.setup?.(this)
      order.push(pass)

      for (const dependent of edges.get(name) ?? []) {
        const next = (indegree.get(dependent) ?? 0) - 1
        indegree.set(dependent, next)
        if (next === 0) {
          queue.push(dependent)
        }
      }
    }

    if (order.length !== this.passes.size) {
      throw new Error('Render graph contains cyclic dependencies')
    }

    this.executionOrder = order
    this.compiled = true
  }

  execute(): void {
    if (!this.compiled && this.passes.size > 0) {
      throw new Error('RenderGraph.execute requires compile() before execution')
    }

    const context: RenderContext = {
      graph: this,
      targets: this.targets
    }

    for (const pass of this.executionOrder) {
      pass.execute(context)
    }
  }

  getExecutionOrder(): readonly string[] {
    return this.executionOrder.map((pass) => pass.name)
  }
}

function assertValidZoom(zoom: number): void {
  if (!Number.isFinite(zoom) || zoom === 0) {
    throw new Error('Camera zoom must be a finite, non-zero number')
  }
}

