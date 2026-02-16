export const packageId = '@clockwork/materials';
/** GPU texture wrapper with filter and mip control. */
export class Texture {
    gl;
    state;
    width;
    height;
    glTexture;
    constructor(gl, state, width, height, source) {
        this.gl = gl;
        this.state = state;
        this.width = width;
        this.height = height;
        const texture = gl.createTexture();
        if (!texture) {
            throw new Error('Failed to create texture');
        }
        this.glTexture = texture;
        this.bind(0);
        gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
        if (source) {
            this.upload(source);
        }
        else {
            gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        }
        this.setFilter('linear', 'linear');
    }
    bind(slot) {
        if (this.state) {
            this.state.bindTexture(slot, this.glTexture);
            return;
        }
        this.gl.activeTexture(this.gl.TEXTURE0 + slot);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.glTexture);
    }
    setFilter(min, mag) {
        this.bind(0);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.resolveFilter(min));
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.resolveFilter(mag));
    }
    generateMipmaps() {
        this.bind(0);
        this.gl.generateMipmap(this.gl.TEXTURE_2D);
    }
    upload(source) {
        this.bind(0);
        if (ArrayBuffer.isView(source.pixels)) {
            this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, source.width, source.height, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source.pixels);
            return;
        }
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, this.gl.RGBA, this.gl.UNSIGNED_BYTE, source.pixels);
    }
    destroy() {
        this.gl.deleteTexture(this.glTexture);
    }
    resolveFilter(filter) {
        return filter === 'nearest' ? this.gl.NEAREST : this.gl.LINEAR;
    }
}
/** Named atlas regions mapped to a single texture. */
export class TextureAtlas {
    texture;
    regions = new Map();
    constructor(texture, regions) {
        this.texture = texture;
        if (regions instanceof Map) {
            for (const [name, region] of regions) {
                this.regions.set(name, region);
            }
            return;
        }
        for (const [name, region] of Object.entries(regions)) {
            this.regions.set(name, region);
        }
    }
    getRegion(name) {
        return this.regions.get(name);
    }
    static fromAtlasJson(texture, atlas) {
        const regions = new Map();
        for (const [name, region] of Object.entries(atlas.regions)) {
            regions.set(name, {
                x: region.x,
                y: region.y,
                width: region.w,
                height: region.h,
                u0: region.x / texture.width,
                v0: region.y / texture.height,
                u1: (region.x + region.w) / texture.width,
                v1: (region.y + region.h) / texture.height
            });
        }
        return new TextureAtlas(texture, regions);
    }
}
/** Asset loader that decodes bytes and uploads textures to GPU. */
export class TextureLoader {
    gl;
    decoder;
    state;
    defaultFilter;
    extensions = ['.png', '.jpg', '.jpeg', '.webp'];
    constructor(gl, decoder, state, defaultFilter = {
        min: 'linear',
        mag: 'linear'
    }) {
        this.gl = gl;
        this.decoder = decoder;
        this.state = state;
        this.defaultFilter = defaultFilter;
    }
    async load(path, source) {
        const bytes = await source.fetch(path);
        const decoded = await this.decoder.decode(bytes);
        const texture = new Texture(this.gl, this.state, decoded.width, decoded.height, decoded);
        texture.setFilter(this.defaultFilter.min, this.defaultFilter.mag);
        return texture;
    }
    unload(texture) {
        texture.destroy();
    }
}
/** Atlas loader that converts JSON region boxes into normalized UVs. */
export class TextureAtlasLoader {
    decoder = new TextDecoder();
    async load(path, source) {
        const bytes = await source.readFile(path);
        const atlas = JSON.parse(this.decoder.decode(bytes));
        return { texture: atlas.texture, atlas };
    }
}
//# sourceMappingURL=index.js.map