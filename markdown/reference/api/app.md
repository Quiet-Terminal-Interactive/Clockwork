# API Reference: qti-clockwork-app

## AppBuilder

| Method | Signature | Notes |
|---|---|---|
| `use` | `(plugin: Plugin) => this` | Registers plugin by id; duplicate ids throw. |
| `remove` | `(pluginId: string) => this` | Unregisters plugin if possible; blocks removal when dependents exist. |
| `build` | `() => App` | Initializes plugins, creates `World`, `EventBus`, `Scheduler`, installs systems/resources. |
| `setActivePlugin` | `(pluginId?: string) => void` | Internal ownership context for registries. |

## App

| Method | Signature | Notes |
|---|---|---|
| `run` | `() => void` | Starts scheduler execution state. |
| `step` | `(dt: number) => Promise<void>` | Executes one frame/tick. |
| `shutdown` | `() => Promise<void>` | Runs scheduler shutdown then plugin shutdown in reverse order. |

## PluginManager

| Method | Signature | Notes |
|---|---|---|
| `register` | `(plugin: Plugin) => void` | Adds plugin; duplicate id throws. |
| `unregister` | `(pluginId: string) => void` | Stops/removes plugin; dependent plugins block removal. |
| `reload` | `(pluginId: string) => void` | Calls plugin reload if present; errors are logged and isolated. |
| `initialize` | `(builder: AppBuilder) => void` | Dependency-resolves and runs `init` in topological order. |
| `shutdownAll` | `(app: App) => void` | Executes `shutdown` in reverse initialization order. |
| `attachApp` | `(app: App) => void` | Links built app to manager for lifecycle operations. |

## Registries

### ComponentRegistry

| Method | Notes |
|---|---|
| `register/get/remove` | Ownership-safe component schema storage keyed by registry token. |
| `setActiveOwner` | Controls write ownership enforcement. |

### SystemRegistry

| Method | Notes |
|---|---|
| `add/remove` | Stores systems + stage + optional order. |
| `installTo` | Installs staged systems into scheduler. |

### ResourceRegistry

| Method | Notes |
|---|---|
| `insert/get/remove` | Ownership-safe resource registration. |
| `installTo` | Inserts registered resources into ECS world. |

### AssetRegistry

| Method | Notes |
|---|---|
| `register/get/remove` | Ownership-safe asset loader map by extension. |

## ModManager

| Method | Signature | Notes |
|---|---|---|
| `discoverMods` | `(path?) => Promise<string[]>` | Delegates directory listing through provided FS. |
| `loadMod` | `(path: string) => Promise<Mod>` | Reads `mod.json`, validates manifest, registers plugin wrapper. |
| `unloadMod` | `(modId: string) => void` | Unregisters plugin wrapper and stops watcher. |
| `reloadMod` | `(modId: string, path: string) => Promise<void>` | Unload + load sequence. |
| `watchMod` | `(modId, path, onReload) => void` | Registers watch callback with guarded error logging. |
| `getLoadedMods` | `() => Mod[]` | Returns current loaded mods snapshot. |

## Gotchas

- Plugin ownership enforcement means shared keys must be coordinated intentionally.
- Reload callback errors are logged, not thrown.
- Manifest `assets` paths reject traversal (`..`), absolute, and drive-qualified paths.
