export const packageId = '@clockwork/gl';
/** WebGL2 context owner and basic draw helpers. */
export class RendererContext {
    gl;
    canvas;
    init(canvas) {
        const gl = canvas.getContext('webgl2');
        if (!gl) {
            throw new Error('WebGL2 is unavailable in this environment');
        }
        this.canvas = canvas;
        this.gl = gl;
        this.setViewport(0, 0, canvas.width, canvas.height);
    }
    setViewport(x, y, width, height) {
        this.assertInitialized();
        this.gl.viewport(x, y, width, height);
    }
    setClearColor(r, g, b, a) {
        this.assertInitialized();
        this.gl.clearColor(r, g, b, a);
    }
    clear(mask) {
        this.assertInitialized();
        const clearMask = mask ?? this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT;
        this.gl.clear(clearMask);
    }
    drawTriangles(vertexCount, firstVertex = 0) {
        this.assertInitialized();
        this.gl.drawArrays(this.gl.TRIANGLES, firstVertex, vertexCount);
    }
    getError() {
        this.assertInitialized();
        return this.gl.getError();
    }
    shutdown() {
        if (!this.gl) {
            return;
        }
        this.gl.bindVertexArray(null);
        this.gl.useProgram(null);
        this.canvas = undefined;
    }
    assertInitialized() {
        if (!this.gl) {
            throw new Error('RendererContext has not been initialized');
        }
    }
}
/** Cached GL state transitions to avoid redundant driver calls. */
export class GLState {
    gl;
    blendMode = null;
    depthEnabled = null;
    cullEnabled = null;
    boundTextures = new Map();
    boundVao = null;
    program = null;
    constructor(gl) {
        this.gl = gl;
    }
    setBlendMode(mode) {
        if (this.blendMode === mode) {
            return;
        }
        this.blendMode = mode;
        if (mode === 'opaque') {
            this.gl.disable(this.gl.BLEND);
            return;
        }
        this.gl.enable(this.gl.BLEND);
        if (mode === 'alpha') {
            this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);
            return;
        }
        this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);
    }
    setDepthTest(enabled) {
        if (this.depthEnabled === enabled) {
            return;
        }
        this.depthEnabled = enabled;
        if (enabled) {
            this.gl.enable(this.gl.DEPTH_TEST);
        }
        else {
            this.gl.disable(this.gl.DEPTH_TEST);
        }
    }
    setCullFace(enabled) {
        if (this.cullEnabled === enabled) {
            return;
        }
        this.cullEnabled = enabled;
        if (enabled) {
            this.gl.enable(this.gl.CULL_FACE);
        }
        else {
            this.gl.disable(this.gl.CULL_FACE);
        }
    }
    bindTexture(slot, texture) {
        if (this.boundTextures.get(slot) === texture) {
            return;
        }
        this.boundTextures.set(slot, texture);
        this.gl.activeTexture(this.gl.TEXTURE0 + slot);
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
    }
    bindVAO(vao) {
        if (this.boundVao === vao) {
            return;
        }
        this.boundVao = vao;
        this.gl.bindVertexArray(vao);
    }
    useProgram(program) {
        if (this.program === program) {
            return;
        }
        this.program = program;
        this.gl.useProgram(program);
    }
}
//# sourceMappingURL=index.js.map