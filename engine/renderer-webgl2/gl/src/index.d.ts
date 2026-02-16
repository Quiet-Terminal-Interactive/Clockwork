export declare const packageId = "@clockwork/gl";
export type BlendMode = 'opaque' | 'alpha' | 'additive';
/** WebGL2 context owner and basic draw helpers. */
export declare class RendererContext {
    gl: WebGL2RenderingContext;
    private canvas;
    init(canvas: HTMLCanvasElement): void;
    setViewport(x: number, y: number, width: number, height: number): void;
    setClearColor(r: number, g: number, b: number, a: number): void;
    clear(mask?: number): void;
    drawTriangles(vertexCount: number, firstVertex?: number): void;
    getError(): number;
    shutdown(): void;
    private assertInitialized;
}
/** Cached GL state transitions to avoid redundant driver calls. */
export declare class GLState {
    private readonly gl;
    private blendMode;
    private depthEnabled;
    private cullEnabled;
    private readonly boundTextures;
    private boundVao;
    private program;
    constructor(gl: WebGL2RenderingContext);
    setBlendMode(mode: BlendMode): void;
    setDepthTest(enabled: boolean): void;
    setCullFace(enabled: boolean): void;
    bindTexture(slot: number, texture: WebGLTexture | null): void;
    bindVAO(vao: WebGLVertexArrayObject | null): void;
    useProgram(program: WebGLProgram | null): void;
}
//# sourceMappingURL=index.d.ts.map