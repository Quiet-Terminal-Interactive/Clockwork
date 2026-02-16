import type { AssetLoader, AssetSource } from '@clockwork/assets';
import type { GLState } from '@clockwork/gl';
export declare const packageId = "@clockwork/materials";
export type FilterMode = 'nearest' | 'linear';
export interface AtlasRegion {
    x: number;
    y: number;
    width: number;
    height: number;
    u0: number;
    v0: number;
    u1: number;
    v1: number;
}
export interface AtlasJsonRegion {
    x: number;
    y: number;
    w: number;
    h: number;
}
export interface AtlasJson {
    texture: string;
    regions: Record<string, AtlasJsonRegion>;
}
export interface TextureUploadSource {
    width: number;
    height: number;
    pixels: TexImageSource | ArrayBufferView;
}
/** GPU texture wrapper with filter and mip control. */
export declare class Texture {
    private readonly gl;
    private readonly state;
    readonly width: number;
    readonly height: number;
    readonly glTexture: WebGLTexture;
    constructor(gl: WebGL2RenderingContext, state: GLState | undefined, width: number, height: number, source?: TextureUploadSource);
    bind(slot: number): void;
    setFilter(min: FilterMode, mag: FilterMode): void;
    generateMipmaps(): void;
    upload(source: TextureUploadSource): void;
    destroy(): void;
    private resolveFilter;
}
/** Named atlas regions mapped to a single texture. */
export declare class TextureAtlas {
    readonly texture: Texture;
    readonly regions: Map<string, AtlasRegion>;
    constructor(texture: Texture, regions: ReadonlyMap<string, AtlasRegion> | Record<string, AtlasRegion>);
    getRegion(name: string): AtlasRegion | undefined;
    static fromAtlasJson(texture: Texture, atlas: AtlasJson): TextureAtlas;
}
export interface TextureDecoder {
    decode(buffer: ArrayBuffer): Promise<TextureUploadSource>;
}
/** Asset loader that decodes bytes and uploads textures to GPU. */
export declare class TextureLoader implements AssetLoader<Texture> {
    private readonly gl;
    private readonly decoder;
    private readonly state?;
    private readonly defaultFilter;
    readonly extensions: string[];
    constructor(gl: WebGL2RenderingContext, decoder: TextureDecoder, state?: GLState | undefined, defaultFilter?: {
        min: FilterMode;
        mag: FilterMode;
    });
    load(path: string, source: AssetSource): Promise<Texture>;
    unload(texture: Texture): void;
}
export interface AtlasDefinition {
    texture: string;
    atlas: AtlasJson;
}
/** Atlas loader that converts JSON region boxes into normalized UVs. */
export declare class TextureAtlasLoader {
    private readonly decoder;
    load(path: string, source: AssetSource): Promise<AtlasDefinition>;
}
//# sourceMappingURL=index.d.ts.map