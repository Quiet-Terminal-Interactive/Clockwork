# API Map

Quick map from feature areas to primary classes.

Detailed method tables: [API Reference Index](api/index.md)

## Runtime Composition

- `AppBuilder`
- `App`
- `PluginManager`
- `ComponentRegistry`
- `SystemRegistry`
- `ResourceRegistry`
- `AssetRegistry`

## ECS

- `World`
- `EntityManager`
- `ComponentStore`
- `Query`
- `CommandBuffer`
- `ResourceMap`
- `ResourceType`

## Scheduling

- `Scheduler`
- `Stage`
- `TimeResource`
- `Profiler`
- `SeededRng`
- `DeterminismValidator`

## Events

- `EventBus`
- `Events<T>`

## Assets

- `AssetCache`
- `Handle<T>`
- built-in loaders

## Serialization

- `WorldSerializer`

## Renderer

- `RendererContext`
- `GLState`
- `ShaderCompiler`
- `Shader`
- `Texture`
- `TextureAtlas`
- `SpriteBatch`
- `PrimitiveBatch`
- `RenderGraph`

## Platform

- `MemoryFileSystem`
- `BrowserFileSystem`
- `TauriFileSystem`
- `HeadlessWindow`
- `BrowserWindowAdapter`
- `TauriWindowAdapter`
- `RuntimeConfigLoader`
- `CrashReportingLogger`
