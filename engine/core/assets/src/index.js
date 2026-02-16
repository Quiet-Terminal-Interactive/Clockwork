export const packageId = '@clockwork/assets';
export class Handle {
    id;
    version;
    resolve;
    constructor(id, version, resolve) {
        this.id = id;
        this.version = version;
        this.resolve = resolve;
    }
    get() {
        return this.resolve(this);
    }
    isLoaded() {
        return this.get() !== undefined;
    }
}
export class AssetCache {
    source;
    loaders = new Map();
    entries = new Map();
    constructor(source) {
        this.source = source;
    }
    registerLoader(loader) {
        for (const extension of loader.extensions) {
            this.loaders.set(this.normalizeExtension(extension), loader);
        }
    }
    load(id) {
        const entry = this.getOrCreateEntry(id);
        if (!entry.asset && !entry.inFlight) {
            this.startLoading(entry);
        }
        return new Handle(id, entry.version, (handle) => this.get(handle));
    }
    get(handle) {
        const entry = this.entries.get(handle.id);
        if (!entry || entry.version !== handle.version || entry.error) {
            return undefined;
        }
        return entry.asset;
    }
    async waitFor(handle) {
        const entry = this.entries.get(handle.id);
        if (!entry) {
            throw new Error(`Unknown asset "${handle.id}"`);
        }
        if (entry.inFlight) {
            await entry.inFlight;
        }
        const asset = this.get(handle);
        if (asset === undefined) {
            throw new Error(`Asset "${handle.id}" is unavailable for this handle`);
        }
        return asset;
    }
    unload(id) {
        const entry = this.entries.get(id);
        if (!entry) {
            return;
        }
        delete entry.inFlight;
        entry.error = undefined;
        entry.watchStop?.();
        delete entry.watchStop;
        this.unlinkDependencies(entry);
        this.disposeAsset(entry);
        this.entries.delete(id);
    }
    async reload(id) {
        await this.reloadInternal(id, new Set());
    }
    async reloadInternal(id, visited) {
        if (visited.has(id)) {
            return;
        }
        visited.add(id);
        const entry = this.entries.get(id);
        if (!entry) {
            return;
        }
        if (entry.inFlight) {
            await entry.inFlight;
        }
        this.disposeAsset(entry);
        this.unlinkDependencies(entry);
        entry.asset = undefined;
        entry.error = undefined;
        entry.version += 1;
        this.startLoading(entry);
        if (entry.inFlight) {
            await entry.inFlight;
        }
        const dependents = [...entry.dependents];
        for (const dependent of dependents) {
            await this.reloadInternal(dependent, visited);
        }
    }
    startLoading(entry) {
        const loader = this.getLoader(entry.id);
        const ctx = {
            dependOn: (dependencyId) => {
                const dependency = this.getOrCreateEntry(dependencyId);
                entry.dependencies.add(dependencyId);
                dependency.dependents.add(entry.id);
            },
            loadDependency: (dependencyId) => {
                ctx.dependOn(dependencyId);
                return this.load(dependencyId);
            }
        };
        entry.inFlight = (async () => {
            const loaded = await loader.load(entry.id, this.source, ctx);
            entry.asset = loaded;
            entry.error = undefined;
            if (!entry.watchStop && this.source.watch) {
                entry.watchStop = this.source.watch(entry.id, () => {
                    void this.reload(entry.id);
                });
            }
        })()
            .catch((error) => {
            entry.asset = undefined;
            entry.error = error;
        })
            .finally(() => {
            delete entry.inFlight;
        });
    }
    getLoader(id) {
        let match;
        let longest = -1;
        for (const [extension, loader] of this.loaders.entries()) {
            if (id.toLowerCase().endsWith(extension) && extension.length > longest) {
                match = loader;
                longest = extension.length;
            }
        }
        if (!match) {
            throw new Error(`No asset loader registered for "${id}"`);
        }
        return match;
    }
    getOrCreateEntry(id) {
        let entry = this.entries.get(id);
        if (!entry) {
            entry = {
                id,
                version: 1,
                dependencies: new Set(),
                dependents: new Set()
            };
            this.entries.set(id, entry);
        }
        return entry;
    }
    unlinkDependencies(entry) {
        for (const dependencyId of entry.dependencies) {
            const dependency = this.entries.get(dependencyId);
            dependency?.dependents.delete(entry.id);
        }
        entry.dependencies.clear();
    }
    disposeAsset(entry) {
        if (entry.asset === undefined) {
            return;
        }
        const loader = this.getLoader(entry.id);
        if (loader.unload) {
            loader.unload(entry.asset);
        }
        entry.asset = undefined;
    }
    normalizeExtension(extension) {
        const trimmed = extension.trim().toLowerCase();
        if (!trimmed.startsWith('.')) {
            return `.${trimmed}`;
        }
        return trimmed;
    }
}
export class TextureLoader {
    extensions = ['.png', '.jpg', '.jpeg', '.webp'];
    async load(path, source) {
        return source.readFile(path);
    }
}
export class AtlasLoader {
    extensions = ['.atlas.json'];
    decoder = new TextDecoder();
    async load(path, source, context) {
        const bytes = await source.readFile(path);
        const data = JSON.parse(this.decoder.decode(bytes));
        const texturePath = this.extractTexturePath(data, path);
        if (!texturePath || !context) {
            const result = { data };
            if (texturePath) {
                result.texturePath = texturePath;
            }
            return result;
        }
        const texture = context.loadDependency(texturePath);
        return { data, texturePath, texture };
    }
    extractTexturePath(data, atlasPath) {
        const direct = data.texture;
        if (typeof direct === 'string') {
            return this.resolveSibling(atlasPath, direct);
        }
        const meta = data.meta;
        if (meta && typeof meta === 'object') {
            const image = meta.image;
            if (typeof image === 'string') {
                return this.resolveSibling(atlasPath, image);
            }
        }
        const normalized = atlasPath.replaceAll('\\', '/');
        const sibling = normalized.replace(/\.atlas\.json$/i, '.png');
        return sibling;
    }
    resolveSibling(path, sibling) {
        const normalized = path.replaceAll('\\', '/');
        const separator = normalized.lastIndexOf('/');
        if (separator === -1) {
            return sibling;
        }
        return `${normalized.slice(0, separator + 1)}${sibling}`;
    }
}
export class AudioLoader {
    extensions = ['.mp3', '.ogg', '.wav'];
    async load(path, source) {
        return source.readFile(path);
    }
}
export class FontLoader {
    extensions = ['.ttf', '.otf'];
    async load(path, source) {
        return source.readFile(path);
    }
}
export class ShaderLoader {
    extensions = ['.vert', '.frag'];
    decoder = new TextDecoder();
    async load(path, source) {
        const bytes = await source.readFile(path);
        return this.decoder.decode(bytes);
    }
}
export class JsonLoader {
    extensions = ['.json'];
    decoder = new TextDecoder();
    async load(path, source) {
        const bytes = await source.readFile(path);
        return JSON.parse(this.decoder.decode(bytes));
    }
}
export class BinaryLoader {
    extensions = ['.bin'];
    async load(path, source) {
        return source.readFile(path);
    }
}
//# sourceMappingURL=index.js.map