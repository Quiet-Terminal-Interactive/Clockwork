# Runtime and Plugins

## AppBuilder

`AppBuilder` is the runtime composition surface.

It exposes registries for:

- components
- systems
- resources
- assets

It also manages plugin registration through `.use(plugin)` and `.remove(pluginId)`.

## Plugin Lifecycle

Plugin contract (JavaScript shape; same fields apply in TypeScript):

```js
const plugin = {
  id: 'example',
  version: '1.0.0',
  depends: [],
  init(app) {},
  shutdown(app) {},
  reload() {}
}
```

Lifecycle behavior:

1. Resolve plugin dependencies
2. Initialize in dependency order
3. Shutdown in reverse order
4. Keep reload failures isolated to avoid runtime collapse

## Runtime Assembly

`builder.build()` creates:

- `World` (`qti-clockwork-ecs`)
- `EventBus` (`qti-clockwork-events`)
- `Scheduler` (`qti-clockwork-scheduler`)
- `App` wrapper containing all three plus plugin manager

## Registry Ownership Model

During plugin init, `AppBuilder` tracks active plugin ownership.

If plugin A registered a key, plugin B cannot mutate/remove it. This prevents accidental cross-plugin registry mutation.

## Mod Manager (Current State)

`ModManager` currently handles:

- mod discovery from a configured path
- loading basic `mod.json` manifests
- builder plugin registration for loaded mods
- watch callbacks for reload hooks

Manifest validation includes required:

- `id` (string)
- `version` (string)

And optional:

- `entry` (string)
- `assets` (string array, safe relative paths only)
