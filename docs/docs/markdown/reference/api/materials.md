# API Reference: qti-clockwork-materials

## Texture

| Method | Notes |
|---|---|
| `bind` | Binds texture on slot, optionally through `GLState`. |
| `setFilter` | Applies min/mag filtering (`nearest`/`linear`). |
| `generateMipmaps` | Calls `gl.generateMipmap`. |
| `upload` | Uploads pixels from `TexImageSource` or typed array. |
| `destroy` | Deletes GPU texture resource. |

Constructor validates width/height integer, positive, <= max GPU size.

## TextureAtlas

| Method | Notes |
|---|---|
| `getRegion` | Region lookup by name. |
| `fromAtlasJson` | Converts atlas JSON regions into UV-normalized region map. |

## Loaders

### TextureLoader

- Reads bytes via `AssetSource.fetch`
- Decodes with injected decoder
- Builds `Texture`
- `unload` destroys texture

### TextureAtlasLoader

- Reads atlas JSON via `readFile`
- Validates `texture` and `regions`
- Returns parsed atlas definition

## Gotchas

- Invalid dimensions or oversized textures throw at construction/upload.
- Atlas JSON requires object region entries with finite `x,y,w,h` values.
