# Materials and Textures

`qti-clockwork-materials` provides texture abstractions, atlas data structures, and loader helpers.

## Texture

`Texture` wraps a `WebGLTexture` and supports:

- initial upload
- runtime upload updates
- filtering (`nearest` / `linear`)
- mipmap generation
- destruction

Texture dimensions are validated against `MAX_TEXTURE_SIZE`.

## TextureAtlas

Maps named regions to normalized UVs.

Can be built from raw region map or `AtlasJson` metadata.

## Loaders

### TextureLoader

Loads binary image data via `AssetSource.fetch`, decodes through injected decoder, and builds `Texture`.

### TextureAtlasLoader

Reads atlas JSON (`texture`, `regions`) and validates region entries.

Malformed JSON payloads throw descriptive errors.
