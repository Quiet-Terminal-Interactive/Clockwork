# Guide: Mod Manifests

`ModManager` expects `mod.json` in each mod directory.

## Required Fields

- `id` (non-empty string)
- `version` (non-empty string)

## Optional Fields

- `entry` (string)
- `assets` (string array)

## Example

```json
{
  "id": "demo",
  "version": "1.0.0",
  "entry": "index.js",
  "assets": ["textures/player.png", "audio/theme.ogg"]
}
```

## Path Safety Rules

Asset paths must be safe relative paths.

Rejected:

- absolute paths
- drive-qualified paths
- `..` traversal segments

## Load Flow

1. read `mod.json`
2. validate fields
3. register plugin wrapper (`mod:<id>`)
4. add to loaded mods list

## Reload/Unload

- `reloadMod(modId, path)` unloads then loads
- `unloadMod(modId)` removes mod and watcher
