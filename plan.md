# Clockwork Engine – Step-by-Step Development Plan

## ~~Phase 0 – Project Foundation & TypeScript Setup~~ COMPLETE

### Goal

Establish clean TypeScript project structure with build tooling and module boundaries.

### Tasks

1. Initialize monorepo structure with package manager (pnpm/yarn workspaces)
2. Configure TypeScript with strict mode
3. Set up build pipeline (esbuild/vite)
4. Create module boundaries and import rules
5. Configure testing framework (vitest)
6. Set up linting and formatting (eslint, prettier)

### Project Structure

```
/clockwork
├── packages/
│   ├── core/
│   │   ├── ecs/
│   │   ├── scheduler/
│   │   ├── assets/
│   │   ├── events/
│   │   ├── input/
│   │   ├── audio/
│   │   └── serialization/
│   ├── renderer-webgl2/
│   │   ├── gl/
│   │   ├── passes/
│   │   ├── shaders/
│   │   └── materials/
│   ├── platform-tauri/
│   │   ├── src-tauri/
│   │   └── bridge/
│   └── plugins/
│       ├── physics/
│       ├── ui/
│       └── networking/
├── apps/
│   ├── tauri-shell/
│   └── examples/
└── tools/
    ├── schema-validator/
    └── asset-packer/
```

### Key Deliverables

- Working build system
- Module imports enforced (core never imports platform)
- Test runner operational
- TypeScript strict mode passing

### Testing Milestone

Run `npm test` and see green checkmarks.

---

## ~~Phase 1 – Core ECS Foundation~~ COMPLETE

### Goal

Implement the Entity Component System without any rendering or platform dependencies.

### Functionality

- Entity creation/destruction with generational indices
- Component registration and storage
- Basic query system
- Command buffer for deferred mutations

### Classes/Modules

#### `EntityManager`

```typescript
class EntityManager {
  create(): EntityId
  destroy(entity: EntityId): void
  isAlive(entity: EntityId): boolean
  getGeneration(entity: EntityId): number
}
```

#### `ComponentStore<T>`

```typescript
class ComponentStore<T> {
  add(entity: EntityId, component: T): void
  remove(entity: EntityId): void
  get(entity: EntityId): T | undefined
  has(entity: EntityId): boolean
  iter(): IterableIterator<[EntityId, T]>
}
```

#### `World`

```typescript
class World {
  entities: EntityManager
  components: Map<ComponentType, ComponentStore>
  resources: ResourceMap

  spawn(): EntityBuilder
  query<T>(): Query<T>
  commands(): CommandBuffer
}
```

#### `Query<T>`

```typescript
class Query<T> {
  with(...components: ComponentType[]): this
  without(...components: ComponentType[]): this
  optional(component: ComponentType): this
  changed(component: ComponentType): this
  iter(): IterableIterator<QueryResult<T>>
}
```

Query iteration must be deterministic (sorted by EntityId).

#### `CommandBuffer`

```typescript
class CommandBuffer {
  spawn(): EntityBuilder
  destroy(entity: EntityId): void
  addComponent<T>(entity: EntityId, component: T): void
  removeComponent<T>(entity: EntityId, type: ComponentType): void
  flush(): void
}
```

### Component Schema System

#### `ComponentSchema`

```typescript
interface ComponentSchema {
  name: string
  version: number
  fields: FieldDefinition[]
  serialize(component: any): Uint8Array
  deserialize(data: Uint8Array): any
  migrate?(from: number, to: number, data: any): any
}
```

### Testing Milestone

- Create 10,000 entities
- Add/remove components
- Query with filters
- Verify deterministic iteration order
- Measure performance (should handle 100k+ entities)

---

## ~~Phase 2 – Scheduler & Game Loop~~ COMPLETE

### Goal

Implement the fixed timestep game loop with stage-based system execution.

### Functionality

- Fixed timestep simulation
- Variable framerate rendering
- Stage management
- System registration and ordering
- Async system support (limited stages)

### Classes/Modules

#### `Scheduler`

```typescript
class Scheduler {
  addStage(stage: Stage): void
  addSystem(stageName: string, system: System, order?: number): void
  removeSystem(systemId: string): void
  step(dtReal: number): void
  run(): void
  pause(): void
  resume(): void
}
```

#### `Stage`

```typescript
class Stage {
  name: string
  systems: System[]
  allowAsync: boolean

  execute(world: World): void | Promise<void>
}
```

#### `System`

```typescript
interface System {
  id: string
  stage: string
  order: number
  reads: ComponentType[]
  writes: ComponentType[]
  runIf?: (world: World) => boolean
  execute(ctx: SystemContext): void | Promise<void>
}
```

#### `SystemContext`

```typescript
interface SystemContext {
  world: World
  deltaTime: number
  commands: CommandBuffer
  events: EventBus
  resources: ResourceMap
}
```

#### `TimeResource`

```typescript
class TimeResource {
  fixedDelta: number
  elapsed: number
  frameCount: number
  accumulator: number
  maxCatchUpSteps: number
}
```

### Built-in Stages

1. `Boot` (once at startup)
2. `PreUpdate`
3. `FixedUpdate` (0..n iterations per frame)
4. `Update` (once per frame)
5. `LateUpdate`
6. `RenderPrep`
7. `Render`
8. `PostRender`
9. `Shutdown` (once at exit)

### Fixed Timestep Algorithm

```typescript
function step(dtReal: number) {
  time.accumulator += dtReal

  let steps = 0
  while (time.accumulator >= time.fixedDelta && steps < time.maxCatchUpSteps) {
    runStage('FixedUpdate', time.fixedDelta)
    time.accumulator -= time.fixedDelta
    steps++
  }

  runStage('Update', dtReal)
  runStage('LateUpdate', dtReal)
  runStage('Render', dtReal)
}
```

### Testing Milestone

- Fixed timestep runs at 60 TPS regardless of frame rate
- Systems execute in declared order
- Async systems work in allowed stages
- `runIf` predicates prevent unnecessary execution

---

## ~~Phase 3 – Event & Messaging System~~ COMPLETE

### Goal

Type-safe event system with buffered and immediate dispatch.

### Functionality

- Typed event channels
- Frame-based event clearing
- Immediate vs buffered events
- Event listeners

### Classes/Modules

#### `EventBus`

```typescript
class EventBus {
  send<T>(event: T): void
  sendImmediate<T>(event: T): void
  listen<T>(type: EventType<T>): Events<T>
  clear(): void
}
```

#### `Events<T>`

```typescript
class Events<T> {
  iter(): IterableIterator<T>
  isEmpty(): boolean
  len(): number
}
```

#### Event Types

```typescript
class CollisionEvent {
  entityA: EntityId
  entityB: EntityId
  point: Vec2
}

class DamageEvent {
  target: EntityId
  amount: number
  source?: EntityId
}

class InputEvent {
  key: string
  action: 'pressed' | 'released'
}
```

### Event Lifecycle

- Events sent during frame are buffered
- Systems read events via `events.listen(EventType)`
- Events cleared at stage boundaries (configurable)
- Immediate events bypass buffer (use sparingly)

### Testing Milestone

- Send 1000 events, verify all received
- Clear events between stages
- Immediate events trigger listeners instantly
- Type safety enforced at compile time

---

## ~~Phase 4 – Plugin System~~ COMPLETE

### Goal

Modular plugin architecture allowing third-party extensions.

### Functionality

- Plugin registration
- Dependency resolution
- Plugin lifecycle hooks
- Hot reload support (dev mode)

### Classes/Modules

#### `Plugin`

```typescript
interface Plugin {
  id: string
  version: string
  depends?: string[]

  init(app: AppBuilder): void
  shutdown?(app: App): void
  reload?(): void
}
```

#### `PluginManager`

```typescript
class PluginManager {
  register(plugin: Plugin): void
  unregister(pluginId: string): void
  reload(pluginId: string): void
  get(pluginId: string): Plugin | undefined

  private resolveDependencies(): Plugin[]
}
```

#### `AppBuilder`

```typescript
class AppBuilder {
  use(plugin: Plugin): this

  components: ComponentRegistry
  systems: SystemRegistry
  resources: ResourceRegistry
  assets: AssetRegistry

  build(): App
}
```

#### `App`

```typescript
class App {
  world: World
  scheduler: Scheduler
  plugins: PluginManager

  run(): void
  step(dt: number): void
  shutdown(): void
}
```

### Plugin Capabilities

Plugins can register:

- Component schemas
- Systems + stages
- Resources
- Asset loaders
- Render passes
- Event types
- Serialization handlers

### Example Plugin

```typescript
const PhysicsPlugin: Plugin = {
  id: 'physics',
  version: '1.0.0',
  depends: ['core'],

  init(app) {
    app.components.register(RigidBody, rigidBodySchema)
    app.components.register(Collider, colliderSchema)

    app.systems.add('FixedUpdate', physicsSystem, { order: 10 })

    app.resources.insert(PhysicsWorld, new PhysicsWorld())
  }
}
```

### Testing Milestone

- Load plugins in dependency order
- Reject circular dependencies
- Hot reload a plugin without crashing
- Verify plugin isolation (one can't corrupt another)

---

## ~~Phase 5 – Resource System (Global Singletons)~~ COMPLETE

### Goal

Type-safe global state management with versioning.

### Functionality

- Resource registration
- Type-safe access
- Version tracking for hot reload
- Resource dependencies

### Classes/Modules

#### `ResourceMap`

```typescript
class ResourceMap {
  insert<T>(type: ResourceType<T>, resource: T): void
  get<T>(type: ResourceType<T>): T
  tryGet<T>(type: ResourceType<T>): T | undefined
  remove<T>(type: ResourceType<T>): void
  has<T>(type: ResourceType<T>): boolean
}
```

#### `ResourceType<T>`

```typescript
class ResourceType<T> {
  id: string
  version: number
}
```

### Built-in Resources

- `Time` (delta, elapsed, frame count)
- `Input` (keyboard, mouse, gamepad state)
- `Assets` (asset cache)
- `Renderer` (render context)
- `AudioContext` (audio engine)
- `Rng` (seeded random number generator)
- `Config` (user settings)
- `Profiler` (performance metrics)

### Resource Access in Systems

```typescript
function movementSystem(ctx: SystemContext) {
  const time = ctx.resources.get(Time)
  const input = ctx.resources.get(Input)

  // use resources...
}
```

### Testing Milestone

- Insert/retrieve resources type-safely
- Detect missing resource access
- Swap resource versions without breaking systems

---

## ~~Phase 6 – Asset System Foundation~~ COMPLETE

### Goal

Abstract asset loading with caching and hot reload.

### Functionality

- Asset handles
- Loader registration
- Async loading
- Dependency tracking
- Cache management

### Classes/Modules

#### `Handle<T>`

```typescript
class Handle<T> {
  id: AssetId
  version: number

  get(): T | undefined
  isLoaded(): boolean
}
```

#### `AssetId`

```typescript
type AssetId = string // e.g., "textures/player.png"
```

#### `AssetCache`

```typescript
class AssetCache {
  load<T>(id: AssetId): Handle<T>
  unload(id: AssetId): void
  get<T>(handle: Handle<T>): T | undefined
  reload(id: AssetId): Promise<void>
}
```

#### `AssetLoader<T>`

```typescript
interface AssetLoader<T> {
  extensions: string[]
  load(path: string, source: AssetSource): Promise<T>
  unload?(asset: T): void
}
```

#### `AssetSource`

```typescript
interface AssetSource {
  fetch(url: string): Promise<ArrayBuffer>
  readFile(path: string): Promise<Uint8Array>
  watch?(path: string, callback: () => void): () => void
}
```

### Loaders

- `TextureLoader` (.png, .jpg, .webp)
- `AtlasLoader` (.atlas.json)
- `AudioLoader` (.mp3, .ogg, .wav)
- `FontLoader` (.ttf, .otf)
- `ShaderLoader` (.vert, .frag)
- `JsonLoader` (.json)
- `BinaryLoader` (.bin)

### Dependency Tracking

```typescript
// Atlas depends on texture
const atlasHandle = assets.load<Atlas>('sprites/atlas.json')
// Automatically loads 'sprites/atlas.png' as dependency
```

### Testing Milestone

- Load 100 assets concurrently
- Verify handle validity
- Hot reload an asset without restart
- Unload and verify memory freed

---

## Phase 7 – Platform Abstraction Layer

### Goal

Abstract platform-specific functionality so core remains pure.

### Functionality

- File I/O abstraction
- Window management interface
- Input abstraction
- Time source abstraction

### Interfaces

#### `FileSystem`

```typescript
interface FileSystem {
  readFile(path: string): Promise<Uint8Array>
  writeFile(path: string, data: Uint8Array): Promise<void>
  listDir(path: string): Promise<string[]>
  watch(path: string, callback: () => void): () => void
}
```

#### `Window`

```typescript
interface Window {
  getSize(): { width: number; height: number }
  setSize(width: number, height: number): void
  setTitle(title: string): void
  isFullscreen(): boolean
  setFullscreen(enabled: boolean): void
  close(): void
}
```

#### `TimeSource`

```typescript
interface TimeSource {
  now(): number // high-resolution timestamp
}
```

### Platform Implementations

- **Tauri**: uses native file APIs, window controls
- **Web**: uses fetch, DOM APIs
- **Headless**: mock implementations for testing

### Testing Milestone

- Run core tests in headless mode
- Swap platforms without changing core code

---

## Phase 8 – Input System

### Goal

Cross-platform input handling with action mapping.

### Functionality

- Keyboard, mouse, gamepad support
- Input state snapshots
- Action mapping system
- Rebindable controls

### Classes/Modules

#### `InputManager`

```typescript
class InputManager {
  isKeyDown(key: string): boolean
  wasKeyPressed(key: string): boolean
  wasKeyReleased(key: string): boolean

  getMousePosition(): Vec2
  getMousePositionWorld(camera: Camera2D): Vec2
  isMouseButtonDown(button: number): boolean

  getGamepadAxis(gamepad: number, axis: number): number
  isGamepadButtonDown(gamepad: number, button: number): boolean
}
```

#### `ActionMap`

```typescript
class ActionMap {
  bind(action: string, binding: InputBinding): void
  unbind(action: string): void
  isActionPressed(action: string): boolean
  getActionValue(action: string): number
}
```

#### `InputBinding`

```typescript
type InputBinding =
  | { type: 'key'; key: string }
  | { type: 'mouse'; button: number }
  | { type: 'gamepad'; button: number }
  | { type: 'axis'; gamepad: number; axis: number }
```

### Action Mapping Example

```typescript
const actionMap = new ActionMap()
actionMap.bind('jump', { type: 'key', key: 'Space' })
actionMap.bind('jump', { type: 'gamepad', button: 0 }) // A button

if (actionMap.isActionPressed('jump')) {
  // handle jump
}
```

### Input State Lifecycle

- Capture raw input events
- Update state snapshot
- Clear "pressed/released" flags after Update stage

### Testing Milestone

- Simulate keyboard input, verify state
- Map multiple bindings to one action
- Rebind controls at runtime

---

## Phase 9 – WebGL2 Renderer Foundation

### Goal

Initialize WebGL2 context and basic rendering pipeline.

### Functionality

- Context creation
- Viewport management
- Clear color
- Basic draw commands

### Classes/Modules

#### `RendererContext`

```typescript
class RendererContext {
  gl: WebGL2RenderingContext

  init(canvas: HTMLCanvasElement): void
  setViewport(x: number, y: number, width: number, height: number): void
  setClearColor(r: number, g: number, b: number, a: number): void
  clear(): void

  shutdown(): void
}
```

#### `GLState`

```typescript
class GLState {
  // Cache GL state to avoid redundant calls
  setBlendMode(mode: BlendMode): void
  setDepthTest(enabled: boolean): void
  setCullFace(enabled: boolean): void
  bindTexture(slot: number, texture: WebGLTexture): void
  bindVAO(vao: WebGLVertexArrayObject): void
  useProgram(program: WebGLProgram): void
}
```

### WebGL2 Features Used

- Vertex Array Objects (VAO)
- Uniform Buffer Objects (UBO)
- Instanced rendering
- Float textures for data storage
- Multiple render targets (MRT)

### Testing Milestone

- Initialize GL context
- Clear screen to color
- Render a single triangle
- Verify no GL errors

---

## Phase 10 – Shader System

### Goal

Compile, cache, and manage GLSL shaders.

### Functionality

- Shader compilation with error reporting
- Uniform management
- Shader caching
- Include system for shared code

### Classes/Modules

#### `Shader`

```typescript
class Shader {
  program: WebGLProgram
  uniforms: Map<string, WebGLUniformLocation>

  use(): void
  setUniform(name: string, value: any): void
  setUniformBlock(name: string, binding: number): void
}
```

#### `ShaderCompiler`

```typescript
class ShaderCompiler {
  compile(vertSrc: string, fragSrc: string): Shader
  compileWithIncludes(vertPath: string, fragPath: string): Shader
  getError(): string | null
}
```

#### Shader Include System

```glsl
// common.glsl
vec3 linearToSRGB(vec3 color) {
  return pow(color, vec3(1.0/2.2));
}

// sprite.frag
#include "common.glsl"

void main() {
  vec3 color = texture(uTexture, vTexCoord).rgb;
  gl_FragColor = vec4(linearToSRGB(color), 1.0);
}
```

### Error Reporting

```typescript
try {
  const shader = compiler.compile(vertSrc, fragSrc)
} catch (error) {
  console.error(`Shader compilation failed:
${error.message}
Line ${error.line}: ${error.snippet}`)
}
```

### Built-in Shaders

- `sprite.vert/frag` (basic textured quad)
- `text.vert/frag` (SDF text rendering)
- `primitive.vert/frag` (lines, rects, circles)
- `post.vert/frag` (fullscreen post-processing)

### Testing Milestone

- Compile valid shader successfully
- Detect syntax errors with line numbers
- Resolve includes correctly
- Cache compiled shaders

---

## Phase 11 – Texture & Atlas System

### Goal

Load and manage textures and sprite atlases.

### Functionality

- Texture loading from images
- Texture atlas packing
- Filtering modes (nearest, linear)
- Mipmapping
- GPU upload

### Classes/Modules

#### `Texture`

```typescript
class Texture {
  glTexture: WebGLTexture
  width: number
  height: number

  bind(slot: number): void
  setFilter(min: FilterMode, mag: FilterMode): void
  generateMipmaps(): void
}
```

#### `TextureAtlas`

```typescript
class TextureAtlas {
  texture: Texture
  regions: Map<string, AtlasRegion>

  getRegion(name: string): AtlasRegion | undefined
}
```

#### `AtlasRegion`

```typescript
interface AtlasRegion {
  x: number
  y: number
  width: number
  height: number

  // Normalized UV coordinates
  u0: number
  v0: number
  u1: number
  v1: number
}
```

#### `TextureLoader`

```typescript
class TextureLoader implements AssetLoader<Texture> {
  extensions = ['.png', '.jpg', '.webp']

  async load(path: string, source: AssetSource): Promise<Texture> {
    const buffer = await source.fetch(path)
    const image = await decodeImage(buffer)
    return uploadTexture(gl, image)
  }
}
```

### Atlas JSON Format

```json
{
  "texture": "sprites/atlas.png",
  "regions": {
    "player_idle": { "x": 0, "y": 0, "w": 32, "h": 32 },
    "enemy_walk": { "x": 32, "y": 0, "w": 32, "h": 32 }
  }
}
```

### Testing Milestone

- Load PNG texture
- Load atlas with multiple regions
- Verify UV coordinates calculated correctly
- Render sprite from atlas

---

## Phase 12 – Camera & Transform System

### Goal

2D camera with transform hierarchy.

### Functionality

- Orthographic camera
- Camera following
- Transform components with parent/child relationships
- World-to-screen coordinate conversion

### Components

#### `Transform2D`

```typescript
interface Transform2D {
  position: Vec2
  rotation: number // radians
  scale: Vec2
  zIndex: number
  parent?: EntityId
}
```

#### `Camera2D`

```typescript
interface Camera2D {
  position: Vec2
  zoom: number
  viewport: { x: number; y: number; width: number; height: number }
  clearColor: Color
  layerMask: number
}
```

### Systems

#### `TransformSystem`

```typescript
function transformSystem(ctx: SystemContext) {
  // Compute world transforms from local + parent
  // Update transform matrices
  // Handle parent/child relationships
}
```

#### `CameraFollowSystem`

```typescript
function cameraFollowSystem(ctx: SystemContext) {
  const query = ctx.world
    .query<[Camera2D, CameraFollow]>()
    .with(Camera2D, CameraFollow)

  for (const [entity, camera, follow] of query.iter()) {
    const targetPos = getTransform(follow.target).position
    camera.position = lerp(camera.position, targetPos, follow.speed)
  }
}
```

### Coordinate Conversion

```typescript
function screenToWorld(camera: Camera2D, screenPos: Vec2): Vec2 {
  // Convert screen coordinates to world coordinates
}

function worldToScreen(camera: Camera2D, worldPos: Vec2): Vec2 {
  // Convert world coordinates to screen coordinates
}
```

### Testing Milestone

- Create camera, move it, verify viewport changes
- Follow target smoothly
- Convert screen click to world position accurately
- Handle nested transform hierarchies

---

## Phase 13 – Sprite Batch Renderer

### Goal

Efficient 2D sprite rendering with batching and instancing.

### Functionality

- Batch sprites by texture
- Automatic flushing
- Z-ordering
- Color tinting
- Blend modes

### Components

#### `Sprite`

```typescript
interface Sprite {
  texture: Handle<Texture>
  region?: string // atlas region name
  tint: Color
  pivot: Vec2
  flipX: boolean
  flipY: boolean
  blendMode: BlendMode
  visible: boolean
}
```

### Classes/Modules

#### `SpriteBatch`

```typescript
class SpriteBatch {
  private vertices: Float32Array
  private indices: Uint16Array
  private vertexCount: number
  private indexCount: number

  begin(camera: Camera2D): void
  draw(transform: Transform2D, sprite: Sprite): void
  flush(): void
  end(): void
}
```

### Vertex Format

```
struct SpriteVertex {
  position: vec2  // 8 bytes
  texCoord: vec2  // 8 bytes
  color: vec4     // 16 bytes (RGBA float)
}
// Total: 32 bytes per vertex
```

### Batching Strategy

1. Sort sprites by:
   - Texture (minimize texture binds)
   - Z-index (back to front)
   - Blend mode
2. Accumulate quads into vertex buffer
3. Flush when:
   - Buffer full
   - Texture changes
   - Blend mode changes
   - Manual flush requested

### Render System

```typescript
function spriteRenderSystem(ctx: SystemContext) {
  const renderer = ctx.resources.get(Renderer)
  const batch = renderer.spriteBatch

  const query = ctx.world
    .query<[Transform2D, Sprite]>()
    .with(Transform2D, Sprite)

  const sprites = Array.from(query.iter())
    .filter(([_, __, sprite]) => sprite.visible)
    .sort(sortByZIndex)

  batch.begin(renderer.camera)

  for (const [entity, transform, sprite] of sprites) {
    batch.draw(transform, sprite)
  }

  batch.end()
}
```

### Testing Milestone

- Render 10,000 sprites at 60 FPS
- Verify batching (should be <10 draw calls)
- Test Z-ordering
- Verify tinting and blend modes

---

## Phase 14 – Text Rendering (SDF)

### Goal

Render crisp text using signed distance fields.

### Functionality

- SDF font atlas generation
- Dynamic text rendering
- Text alignment
- Text wrapping

### Components

#### `Text`

```typescript
interface Text {
  content: string
  font: Handle<Font>
  fontSize: number
  color: Color
  align: 'left' | 'center' | 'right'
  wrapWidth?: number
}
```

#### `Font`

```typescript
class Font {
  atlas: Texture
  glyphs: Map<string, GlyphInfo>
  lineHeight: number
  baseline: number
}
```

#### `GlyphInfo`

```typescript
interface GlyphInfo {
  char: string
  x: number
  y: number
  width: number
  height: number
  xOffset: number
  yOffset: number
  xAdvance: number
}
```

### SDF Shader

```glsl
// text.frag
uniform sampler2D uFontAtlas;
uniform vec4 uColor;

in vec2 vTexCoord;

void main() {
  float distance = texture(uFontAtlas, vTexCoord).a;
  float alpha = smoothstep(0.5 - fwidth(distance), 0.5 + fwidth(distance), distance);
  gl_FragColor = vec4(uColor.rgb, uColor.a * alpha);
}
```

### Text Layout

```typescript
function layoutText(text: Text, font: Font): TextLayout {
  const lines: Line[] = []
  let currentLine: Glyph[] = []
  let x = 0,
    y = 0

  for (const char of text.content) {
    if (char === '\n') {
      lines.push({ glyphs: currentLine, width: x })
      currentLine = []
      x = 0
      y += font.lineHeight
      continue
    }

    const glyph = font.glyphs.get(char)
    if (glyph) {
      currentLine.push({ ...glyph, x, y })
      x += glyph.xAdvance
    }
  }

  return { lines, totalWidth: max(lines.map((l) => l.width)), totalHeight: y }
}
```

### Testing Milestone

- Render crisp text at various sizes
- Test text wrapping
- Verify alignment (left, center, right)
- Support Unicode characters

---

## Phase 15 – Primitive Rendering

### Goal

Render basic 2D shapes for debugging and UI.

### Functionality

- Lines
- Rectangles (filled and outlined)
- Circles
- Custom polygons

### Classes/Modules

#### `PrimitiveBatch`

```typescript
class PrimitiveBatch {
  drawLine(start: Vec2, end: Vec2, color: Color, thickness: number): void
  drawRect(rect: Rect, color: Color, filled: boolean): void
  drawCircle(center: Vec2, radius: number, color: Color, segments: number): void
  drawPolygon(points: Vec2[], color: Color, filled: boolean): void
}
```

### Primitive Shader

Uses vertex colors, no textures.

```glsl
// primitive.vert
in vec2 aPosition;
in vec4 aColor;

out vec4 vColor;

uniform mat4 uProjection;

void main() {
  vColor = aColor;
  gl_Position = uProjection * vec4(aPosition, 0.0, 1.0);
}

// primitive.frag
in vec4 vColor;

void main() {
  gl_FragColor = vColor;
}
```

### Testing Milestone

- Draw 1000 lines per frame
- Render filled and outlined rectangles
- Draw smooth circles with configurable segments
- Verify colors

---

## Phase 16 – Render Graph & Passes

### Goal

Flexible render pipeline with multiple passes and post-processing.

### Functionality

- Define render passes
- Pass dependencies
- Render targets
- Post-processing chain

### Classes/Modules

#### `RenderPass`

```typescript
interface RenderPass {
  name: string
  inputs: string[]
  outputs: string[]
  setup?(graph: RenderGraph): void
  execute(ctx: RenderContext): void
}
```

#### `RenderGraph`

```typescript
class RenderGraph {
  addPass(pass: RenderPass): void
  removePass(name: string): void
  compile(): void
  execute(): void

  getRenderTarget(name: string): RenderTarget
}
```

#### `RenderTarget`

```typescript
class RenderTarget {
  framebuffer: WebGLFramebuffer
  texture: Texture
  width: number
  height: number

  bind(): void
  unbind(): void
}
```

### Example Render Graph

```typescript
const graph = new RenderGraph()

graph.addPass({
  name: 'scene',
  outputs: ['sceneColor'],
  execute(ctx) {
    // Render sprites, text, primitives to sceneColor
  }
})

graph.addPass({
  name: 'bloom',
  inputs: ['sceneColor'],
  outputs: ['bloomColor'],
  execute(ctx) {
    // Apply bloom filter to sceneColor, output to bloomColor
  }
})

graph.addPass({
  name: 'composite',
  inputs: ['sceneColor', 'bloomColor'],
  outputs: ['final'],
  execute(ctx) {
    // Blend sceneColor + bloomColor to final
  }
})

graph.compile()
graph.execute()
```

### Built-in Passes

- `ScenePass` (main rendering)
- `BlurPass` (Gaussian blur)
- `BloomPass` (bloom filter)
- `ToneMappingPass` (HDR to LDR)
- `CRTPass` (CRT scanline effect)

### Testing Milestone

- Execute multi-pass rendering
- Verify pass order respects dependencies
- Render to texture and sample in next pass
- Apply post-processing effects

---

## Phase 17 – Audio System (WebAudio)

### Goal

Audio playback with spatial sound and mixer buses.

### Functionality

- Audio clip loading
- Play/pause/stop
- Looping
- Volume control
- Mixer buses

### Components

#### `AudioSource`

```typescript
interface AudioSource {
  clip: Handle<AudioClip>
  volume: number
  pitch: number
  loop: boolean
  playing: boolean
  bus: string // 'master', 'music', 'sfx', 'ui'
}
```

### Classes/Modules

#### `AudioEngine`

```typescript
class AudioEngine {
  context: AudioContext
  buses: Map<string, AudioBus>

  play(clip: AudioClip, bus: string, options?: AudioOptions): AudioInstance
  stop(instance: AudioInstance): void
  setBusVolume(bus: string, volume: number): void
  setMasterVolume(volume: number): void
}
```

#### `AudioBus`

```typescript
class AudioBus {
  name: string
  gain: GainNode
  volume: number
  muted: boolean

  setVolume(volume: number): void
  setMuted(muted: boolean): void
}
```

#### `AudioClip`

```typescript
class AudioClip {
  buffer: AudioBuffer
  duration: number
}
```

### Audio System

```typescript
function audioSystem(ctx: SystemContext) {
  const audio = ctx.resources.get(AudioEngine)

  const query = ctx.world
    .query<[AudioSource]>()
    .with(AudioSource)
    .changed(AudioSource)

  for (const [entity, source] of query.iter()) {
    if (source.playing && !source.instance) {
      source.instance = audio.play(source.clip.get(), source.bus, {
        volume: source.volume,
        loop: source.loop
      })
    } else if (!source.playing && source.instance) {
      audio.stop(source.instance)
      source.instance = null
    }
  }
}
```

### Testing Milestone

- Play audio clip
- Loop audio
- Adjust volume per bus
- Mute/unmute buses

---

## Phase 18 – Serialization System

### Goal

Serialize/deserialize world state and components.

### Functionality

- Component serialization via schemas
- World snapshots
- Save/load game state
- Version migration

### Classes/Modules

#### `Serializer`

```typescript
interface Serializer {
  serialize(world: World): Uint8Array
  deserialize(data: Uint8Array): World
}
```

#### Component Serialization

Each component schema provides:

```typescript
interface ComponentSchema {
  serialize(component: any): any // JSON-serializable
  deserialize(data: any): any
  migrate?(fromVersion: number, toVersion: number, data: any): any
}
```

### Binary Format (Optional)

Use MessagePack or custom binary format for efficiency.

### Example: Save World

```typescript
const serializer = new Serializer()
const data = serializer.serialize(world)
await fs.writeFile('save.dat', data)
```

### Example: Load World

```typescript
const data = await fs.readFile('save.dat')
const world = serializer.deserialize(data)
```

### Migration

```typescript
// Component version 1 -> 2
const schema: ComponentSchema = {
  version: 2,
  migrate(from, to, data) {
    if (from === 1 && to === 2) {
      // Add new field with default value
      data.newField = 0
    }
    return data
  }
}
```

### Testing Milestone

- Serialize world with 1000 entities
- Deserialize and verify integrity
- Migrate component from v1 to v2
- Measure serialization speed

---

## Phase 19 – Tauri Integration

### Goal

Embed engine in Tauri desktop app with native file access.

### Functionality

- Tauri bridge for file I/O
- Window controls
- Save data directory
- Crash logging

### Tauri Commands

#### File I/O

```rust
// src-tauri/src/main.rs
#[tauri::command]
async fn read_file(path: String) -> Result<Vec<u8>, String> {
    std::fs::read(path).map_err(|e| e.to_string())
}

#[tauri::command]
async fn write_file(path: String, data: Vec<u8>) -> Result<(), String> {
    std::fs::write(path, data).map_err(|e| e.to_string())
}

#[tauri::command]
async fn list_dir(path: String) -> Result<Vec<String>, String> {
    // Implementation
}
```

#### Bridge (TypeScript)

```typescript
import { invoke } from '@tauri-apps/api/tauri'

class TauriFileSystem implements FileSystem {
  async readFile(path: string): Promise<Uint8Array> {
    const data = await invoke<number[]>('read_file', { path })
    return new Uint8Array(data)
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    await invoke('write_file', { path, data: Array.from(data) })
  }
}
```

### App Data Directory

```typescript
import { appDataDir } from '@tauri-apps/api/path'

const dataDir = await appDataDir()
const savePath = `${dataDir}/saves/game.dat`
```

### Testing Milestone

- Read/write files via Tauri
- List directory contents
- Open native file dialog
- Package app for distribution

---

## Phase 20 – Determinism Features

### Goal

Make gameplay deterministic for replays and netcode.

### Functionality

- Fixed timestep enforcement
- Seeded RNG
- Stable iteration order
- Determinism validation

### Classes/Modules

#### `SeededRng`

```typescript
class SeededRng {
  seed: number
  state: number

  constructor(seed: number) {
    this.seed = seed
    this.state = seed
  }

  next(): number {
    // Xorshift or similar PRNG
  }

  nextFloat(): number {
    return this.next() / 0xffffffff
  }

  nextRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min)
  }
}
```

#### `DeterminismValidator`

```typescript
class DeterminismValidator {
  checkSystemOrder(): boolean
  checkQueryOrder(): boolean
  checkRngUsage(): boolean

  report(): DeterminismReport
}
```

#### `DeterminismReport`

```typescript
interface DeterminismReport {
  score: number // 0-100
  warnings: string[]
  violations: string[]
}
```

### Rules for Determinism

1. All RNG must use `SeededRng` resource
2. Queries iterate in sorted order (by EntityId)
3. Systems run in declared order
4. No async in FixedUpdate stage
5. No Date.now() or performance.now()

### Testing Milestone

- Run simulation twice with same seed, verify identical output
- Detect determinism violations
- Generate determinism report

---

## Phase 21 – Debug & Profiling API

### Goal

Introspection and performance analysis without GUI.

### Functionality

- World inspection
- System profiling
- Asset tracking
- Performance metrics

### Classes/Modules

#### `EngineInspector`

```typescript
class EngineInspector {
  world: WorldInspector
  systems: SystemInspector
  assets: AssetInspector
  profiler: Profiler
}
```

#### `WorldInspector`

```typescript
class WorldInspector {
  getEntityCount(): number
  getComponentCounts(): Map<string, number>
  getArchetypeStats(): ArchetypeStats[]
  dumpEntities(): EntityDump[]
}
```

#### `SystemInspector`

```typescript
class SystemInspector {
  getStageOrder(): string[]
  getSystemRuntime(systemId: string): RuntimeStats
  getAverageRuntime(systemId: string): number
}
```

#### `Profiler`

```typescript
class Profiler {
  begin(label: string): void
  end(label: string): void
  getTimings(): Map<string, Timing>
  reset(): void
}
```

### HTTP Debug Endpoint (Tauri)

```rust
// Expose debug API via HTTP in dev mode
#[tauri::command]
async fn get_debug_info() -> Result<DebugInfo, String> {
    // Return JSON with engine state
}
```

Access via `http://localhost:9000/debug`

### Testing Milestone

- Query entity count
- Measure system runtimes
- Track asset memory usage
- Export profiling data as JSON

---

## Phase 22 – Headless Mode

### Goal

Run engine without rendering for server/tests.

### Functionality

- Mock renderer
- Headless loop
- Automated testing

### Implementation

#### `HeadlessRenderer`

```typescript
class HeadlessRenderer implements Renderer {
  // No-op implementations
  init(): void {}
  render(): void {}
  shutdown(): void {}
}
```

#### Headless App

```typescript
const app = createApp()
  .use(CorePlugin)
  .use(HeadlessRendererPlugin) // Instead of WebGL2RendererPlugin
  .build()

// Manual stepping
for (let i = 0; i < 1000; i++) {
  app.step(1 / 60)
}
```

### Testing Milestone

- Run full simulation without GPU
- Verify game logic identical to rendered version
- Run automated tests in CI

---

## Phase 23 – Documentation & Examples

### Goal

Complete API documentation and example projects.

### Deliverables

#### API Documentation

- Auto-generated from TypeScript (TSDoc)
- Plugin development guide
- Component schema guide
- System writing best practices

#### Example Projects

- `hello-triangle` (minimal render)
- `sprite-demo` (sprite rendering)
- `platformer` (simple game)
- `particle-system` (effects)
- `multiplayer-pong` (networking)

#### Tutorials

- "Getting Started"
- "Building a Plugin"
- "Creating Custom Components"
- "Writing Deterministic Systems"

### Testing Milestone

- New developer can follow tutorial and build working game
- All examples run without errors

---

## Phase 24 – Performance Optimization

### Goal

Achieve target performance: 10,000+ entities at 60 FPS.

### Techniques

#### Memory Pooling

```typescript
class EntityPool {
  private freeList: EntityId[]

  allocate(): EntityId {
    return this.freeList.pop() ?? createNewEntity()
  }

  free(entity: EntityId): void {
    this.freeList.push(entity)
  }
}
```

#### Archetype Storage (Optional)

Group entities by component signature for cache efficiency.

#### SIMD Operations

Use typed arrays and vectorized math where possible.

#### WebGL Optimizations

- Reduce draw calls via batching
- Use instancing for repeated geometry
- Minimize state changes

#### Profiling

- Identify bottlenecks
- Optimize hot paths
- Reduce allocations

### Testing Milestone

- Benchmark: 10,000 entities with Transform + Sprite at 60 FPS
- Measure memory usage
- Verify no memory leaks

---

## Phase 25 – Plugin Ecosystem Bootstrap

### Goal

Build essential plugins to demonstrate extensibility.

### Core Plugins

#### `PhysicsPlugin`

- Rigid body physics
- Collision detection
- Constraints/joints

#### `UIPlugin`

- UI components (button, text input, panel)
- Layout system
- Event handling

#### `ParticlePlugin`

- Particle emitters
- Particle pools
- GPU particles (optional)

#### `TilemapPlugin`

- Tilemap rendering
- Chunking for large maps
- Collision layers

#### `NetworkingPlugin`

- Client-server sync
- Packet serialization
- Lag compensation

### Plugin Registry

- NPM packages: `@clockwork/physics`, `@clockwork/ui`, etc.
- Documentation for each plugin
- Example usage

### Testing Milestone

- Install plugin via NPM
- Use plugin in example project
- Verify no conflicts between plugins

---

## Phase 26 – Mod Support & Hot Reload

### Goal

Enable game modding with live reloading.

### Functionality

- Mod discovery
- Mod loading/unloading
- Asset reloading
- Code hot reload (dev mode)

### Classes/Modules

#### `ModManager`

```typescript
class ModManager {
  loadMod(path: string): Promise<Mod>
  unloadMod(modId: string): void
  reloadMod(modId: string): Promise<void>
  getLoadedMods(): Mod[]
}
```

#### `Mod`

```typescript
interface Mod {
  id: string
  version: string
  assets: AssetManifest
  init(app: AppBuilder): void
}
```

#### Asset Hot Reload

```typescript
class AssetWatcher {
  watch(path: string, callback: () => void): void
  unwatch(path: string): void
}

// On file change:
assetCache.reload(assetId)
```

### Mod Structure

```
/mods
  /my-mod
    mod.json
    /assets
      /textures
      /audio
    /scripts
      init.ts
```

### Testing Milestone

- Load mod at runtime
- Hot reload texture without restart
- Unload mod cleanly

---

## Phase 27 – Continuous Integration & Testing

### Goal

Automated testing and CI pipeline.

### Setup

#### Unit Tests

```typescript
import { describe, it, expect } from 'vitest'

describe('ECS', () => {
  it('should create and destroy entities', () => {
    const world = new World()
    const entity = world.spawn().id()

    expect(world.entities.isAlive(entity)).toBe(true)

    world.entities.destroy(entity)

    expect(world.entities.isAlive(entity)).toBe(false)
  })
})
```

#### Integration Tests

Test full game loop, asset loading, serialization.

#### Performance Tests

Benchmark critical paths (ECS iteration, rendering).

#### CI Pipeline (GitHub Actions)

```yaml
name: CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm test
      - run: npm run build
```

### Testing Milestone

- All tests pass in CI
- Code coverage >80%
- Build artifacts generated

---

## Phase 28 – Release Preparation

### Goal

Prepare engine for public release.

### Tasks

#### Versioning

- Semantic versioning (1.0.0)
- Changelog

#### Package for NPM

```json
{
  "name": "@clockwork/engine",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": "./dist/index.js",
    "./renderer": "./dist/renderer.js"
  }
}
```

#### Distribution

- Publish to NPM
- GitHub releases
- Documentation site

### Testing Milestone

- Install engine via `npm install @clockwork/engine`
- Build example project successfully

---

## Phase 29 – Community & Ecosystem

### Goal

Build community around the engine.

### Activities

#### Discord Server

- Support channels
- Showcase projects
- Plugin development

#### Documentation Site

- API reference
- Tutorials
- Showcase gallery

#### Example Projects

- Community-contributed examples
- Game jams
- Templates

#### Plugin Marketplace

- Searchable plugin directory
- Ratings/reviews

### Testing Milestone

- First community plugin published
- First community game built with Clockwork

---

## Phase 30 – Post-Launch Roadmap

### Goal

Iterate based on feedback.

### Future Features

#### Advanced Rendering

- Lighting system (2D dynamic lights)
- Normal maps for sprites
- Shadows

#### Editor Tooling

- Visual scene editor (separate app)
- Asset pipeline tools
- Profiler GUI

#### Mobile Support

- Touch input
- Mobile-optimized renderer
- Capacitor integration

#### 3D Rendering

- 3D renderer plugin
- Perspective camera
- Basic 3D primitives
