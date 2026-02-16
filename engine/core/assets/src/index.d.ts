export declare const packageId = "@clockwork/assets";
export type AssetId = string;
export interface AssetSource {
    fetch(url: string): Promise<ArrayBuffer>;
    readFile(path: string): Promise<Uint8Array>;
    watch?(path: string, callback: () => void): () => void;
}
export interface AssetLoader<T> {
    extensions: string[];
    load(path: string, source: AssetSource): Promise<T>;
    unload?(asset: T): void;
}
interface LoaderContext {
    dependOn(id: AssetId): void;
    loadDependency<T>(id: AssetId): Handle<T>;
}
export declare class Handle<T> {
    readonly id: AssetId;
    readonly version: number;
    private readonly resolve;
    constructor(id: AssetId, version: number, resolve: (handle: Handle<T>) => T | undefined);
    get(): T | undefined;
    isLoaded(): boolean;
}
export interface AtlasAsset {
    texturePath?: string;
    texture?: Handle<unknown>;
    data: Record<string, unknown>;
}
export declare class AssetCache {
    private readonly source;
    private readonly loaders;
    private readonly entries;
    constructor(source: AssetSource);
    registerLoader<T>(loader: AssetLoader<T>): void;
    load<T>(id: AssetId): Handle<T>;
    get<T>(handle: Handle<T>): T | undefined;
    waitFor<T>(handle: Handle<T>): Promise<T>;
    unload(id: AssetId): void;
    reload(id: AssetId): Promise<void>;
    private reloadInternal;
    private startLoading;
    private getLoader;
    private getOrCreateEntry;
    private unlinkDependencies;
    private disposeAsset;
    private normalizeExtension;
}
export declare class TextureLoader implements AssetLoader<Uint8Array> {
    readonly extensions: string[];
    load(path: string, source: AssetSource): Promise<Uint8Array>;
}
export declare class AtlasLoader implements AssetLoader<AtlasAsset> {
    readonly extensions: string[];
    private readonly decoder;
    load(path: string, source: AssetSource, context?: LoaderContext): Promise<AtlasAsset>;
    private extractTexturePath;
    private resolveSibling;
}
export declare class AudioLoader implements AssetLoader<Uint8Array> {
    readonly extensions: string[];
    load(path: string, source: AssetSource): Promise<Uint8Array>;
}
export declare class FontLoader implements AssetLoader<Uint8Array> {
    readonly extensions: string[];
    load(path: string, source: AssetSource): Promise<Uint8Array>;
}
export declare class ShaderLoader implements AssetLoader<string> {
    readonly extensions: string[];
    private readonly decoder;
    load(path: string, source: AssetSource): Promise<string>;
}
export declare class JsonLoader implements AssetLoader<unknown> {
    readonly extensions: string[];
    private readonly decoder;
    load(path: string, source: AssetSource): Promise<unknown>;
}
export declare class BinaryLoader implements AssetLoader<Uint8Array> {
    readonly extensions: string[];
    load(path: string, source: AssetSource): Promise<Uint8Array>;
}
export {};
//# sourceMappingURL=index.d.ts.map