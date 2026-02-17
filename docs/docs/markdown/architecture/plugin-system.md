# Plugin System

Plugins are first-class runtime modules in `qti-clockwork-app`.

## Plugin Contract

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

## Dependency Resolution

`PluginManager` topologically sorts plugins by `depends`.

Failure cases:

- missing dependency
- circular dependency
- duplicate plugin id

## Ownership Isolation

Registries track active plugin ownership during `init`.

Owned keys cannot be modified by other plugins:

- component registry keys
- system ids
- resource keys
- asset loader keys

This prevents cross-plugin mutation bugs.

## Reload Behavior

`plugins.reload(pluginId)` is isolated:

- if plugin has `reload`, it executes
- reload exceptions are logged
- runtime remains alive

## Shutdown Behavior

`shutdownAll(app)` runs plugins in reverse init order.

## Catalog Pattern

`PluginCatalog` provides name-to-factory registration.

`createDefaultPluginCatalog()` includes placeholders:

- physics
- ui
- particle
- tilemap
- networking
