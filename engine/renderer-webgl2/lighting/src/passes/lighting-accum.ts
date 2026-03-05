import type { RenderPass, RenderContext, RenderGraph } from 'qti-clockwork-passes'
import { RenderTarget } from 'qti-clockwork-passes'
import type { LightingWorld } from '../world.js'
import { compileProgram, makeQuadVAO } from './util.js'

// Shared vertex shader for all full-screen passes.
const VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() {
    v_uv = a_pos * 0.5 + 0.5;
    gl_Position = vec4(a_pos, 0.0, 1.0);
}
`

const FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
precision highp sampler2D;

uniform sampler2D u_normal;
uniform sampler2D u_shadowAtlas;
uniform highp sampler2D u_lightData;

uniform int u_lightCount;
uniform float u_ambientR;
uniform float u_ambientG;
uniform float u_ambientB;
uniform float u_ambientIntensity;
uniform float u_skyR;
uniform float u_skyG;
uniform float u_skyB;
uniform float u_groundR;
uniform float u_groundG;
uniform float u_groundB;

// Camera uniforms for world-pos reconstruction.
uniform vec2 u_cameraPos;
uniform float u_cameraZoom;
uniform vec2 u_viewportSize;

uniform bool u_pixelSnapShadows;

in vec2 v_uv;
out vec4 fragColor;

// Reconstruct world position from screen UV.
// World Y is up; screen NDC Y is up in WebGL's default framebuffer.
vec2 uvToWorld(vec2 uv) {
    vec2 ndc = uv * 2.0 - 1.0;
    return u_cameraPos + ndc * (u_viewportSize * 0.5) / u_cameraZoom;
}

// Read one vec4 from the packed light data texture (8 texels wide, one row per light).
vec4 lightTexel(int lightIdx, int col) {
    return texelFetch(u_lightData, ivec2(col, lightIdx), 0);
}

float falloffLinear(float t) { return clamp(1.0 - t, 0.0, 1.0); }
float falloffQuadratic(float t) { return clamp(1.0 - t * t, 0.0, 1.0); }
// Inverse square with soft knee so it doesn't blow up at center.
float falloffInverse(float t) { return clamp(1.0 / (1.0 + 4.0 * t * t), 0.0, 1.0); }

float computeFalloff(float dist, float radius, float falloffCode) {
    float t = dist / radius;
    if (falloffCode < 0.5) return falloffLinear(t);
    if (falloffCode < 1.5) return falloffQuadratic(t);
    return falloffInverse(t);
}

vec2 safeNormalize(vec2 v) {
    float len = length(v);
    if (len <= 1e-6) return vec2(0.0, 1.0);
    return v / len;
}

// Sample the 1D shadow map for light i at the angle toward fragWorld.
// Returns 1.0 = lit, 0.0 = shadowed.
float sampleShadow(vec2 shadowWorld, vec4 d0, vec4 d4, float radius) {
    vec2 delta = shadowWorld - d0.xy;
    float fragDist = length(delta) / radius;

    float angle = atan(delta.y, delta.x);
    float normAngle = angle / (2.0 * 3.14159265358979) + 0.5;

    float u = d4.x + fract(normAngle) * d4.z;
    float v = d4.y;
    float mapDist = texture(u_shadowAtlas, vec2(u, v)).r;

    float lit = fragDist < mapDist + 0.001 ? 1.0 : 0.0;
    return lit;
}

// 4-sample Poisson disk in angle space for soft penumbra.
float sampleShadowSoft(vec2 shadowWorld, vec4 d0, vec4 d4, float radius, float softness) {
    vec2 delta = shadowWorld - d0.xy;
    float fragDist = length(delta) / radius;
    float baseAngle = atan(delta.y, delta.x);
    float spread = softness * 0.05;

    // Poisson disk offsets (angles in radians, spread scaled by softness).
    const float offsets[4] = float[4](-1.0, -0.33, 0.33, 1.0);
    float sum = 0.0;
    for (int j = 0; j < 4; j++) {
        float angle = baseAngle + offsets[j] * spread;
        float normAngle = angle / (2.0 * 3.14159265358979) + 0.5;
        float u = d4.x + fract(normAngle) * d4.z;
        float mapDist = texture(u_shadowAtlas, vec2(u, d4.y)).r;
        sum += fragDist < mapDist + 0.001 ? 1.0 : 0.0;
    }
    return sum * 0.25;
}

void main() {
    vec2 fragWorld = uvToWorld(v_uv);
    vec2 snappedUv = (floor(v_uv * u_viewportSize) + 0.5) / u_viewportSize;
    vec2 snappedWorld = uvToWorld(snappedUv);

    vec2 normalRG = texture(u_normal, v_uv).rg;
    // Unpack from [0,1] storage to [-1,1] normal. Missing normal map → (0,0) → upward flat.
    vec2 normal2D = normalRG * 2.0 - 1.0;

    // Hemisphere ambient: lerp between ground and sky colour based on surface facing.
    float upFacing = dot(normal2D, vec2(0.0, 1.0)) * 0.5 + 0.5;
    vec3 skyC = vec3(u_skyR, u_skyG, u_skyB);
    vec3 groundC = vec3(u_groundR, u_groundG, u_groundB);
    vec3 ambientC = vec3(u_ambientR, u_ambientG, u_ambientB);
    vec3 lightAccum = mix(groundC, skyC, upFacing) * ambientC * u_ambientIntensity;

    for (int i = 0; i < u_lightCount; i++) {
        vec4 d0 = lightTexel(i, 0); // posX, posY, dirX, dirY
        vec4 d1 = lightTexel(i, 1); // colR, colG, colB, intensity
        vec4 d2 = lightTexel(i, 2); // radius, falloff, innerAngle, outerAngle
        vec4 d3 = lightTexel(i, 3); // shadowSoftness, lightType, castsShadows, _
        vec4 d4 = lightTexel(i, 4); // atlasU0, atlasV0, atlasUWidth, _

        vec2 lightPos = d0.xy;
        vec2 delta = fragWorld - lightPos;
        float dist = length(delta);
        float radius = d2.x;

        if (dist >= radius) { continue; }

        float falloff = computeFalloff(dist, radius, d2.y);

        // Spot light cone attenuation.
        float spotFactor = 1.0;
        if (d3.y > 0.5) { // lightType == spot
            vec2 lightDir = d0.zw;
            float fragAngle = atan(delta.y, delta.x);
            float lightAngle = atan(lightDir.y, lightDir.x);
            float angleDiff = abs(fragAngle - lightAngle);
            // Handle ±π wrap-around so the cone doesn't split at the seam.
            angleDiff = min(angleDiff, 2.0 * 3.14159265 - angleDiff);
            float inner = d2.z * 0.5;
            float outer = d2.w * 0.5;
            spotFactor = 1.0 - smoothstep(inner, outer, angleDiff);
        }

        // Shadow occlusion.
        float shadow = 1.0;
        if (d3.z > 0.5) { // castsShadows
            float softness = d3.x;
            vec2 shadowWorld = u_pixelSnapShadows && softness <= 0.0 ? snappedWorld : fragWorld;
            if (softness <= 0.0) {
                shadow = sampleShadow(shadowWorld, d0, d4, radius);
            } else {
                shadow = sampleShadowSoft(shadowWorld, d0, d4, radius, softness);
            }
        }

        vec2 lightDir = safeNormalize(-delta);
        vec2 viewDir = safeNormalize(u_cameraPos - fragWorld);
        vec2 halfDir = safeNormalize(lightDir + viewDir);

        // Diffuse: use NdotL only when a normal map is present (indicated by non-zero normal).
        float nDotL = dot(normal2D, lightDir);
        float hasNormal = step(0.01, dot(normal2D, normal2D));
        float diffuse = mix(1.0, max(nDotL, 0.0), hasNormal);
        float specular = pow(max(dot(normal2D, halfDir), 0.0), 16.0) * 0.2 * hasNormal;

        float attenuation = d1.w * falloff * spotFactor * shadow;
        attenuation *= diffuse + specular;
        lightAccum += d1.rgb * attenuation;
    }

    fragColor = vec4(lightAccum, 1.0);
}
`

/** Deferred lighting accumulation pass. Reads G-buffer, outputs HDR light buffer. */
export class LightingAccumPass implements RenderPass {
  readonly name = 'lightingAccum'
  readonly inputs = ['normal', 'shadowAtlas']
  readonly outputs = ['lightBuffer']

  private program: WebGLProgram | null = null
  private vao: WebGLVertexArrayObject | null = null

  constructor(
    private readonly gl: WebGL2RenderingContext,
    private readonly world: LightingWorld,
    private readonly width: number,
    private readonly height: number
  ) {}

  setup(graph: RenderGraph): void {
    const gl = this.gl
    this.program = compileProgram(gl, VERT_SRC, FRAG_SRC)
    this.vao = makeQuadVAO(gl, this.program)

    // Create light buffer framebuffer (RGBA16F for HDR light accumulation).
    const tex = gl.createTexture()!
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, this.width, this.height, 0, gl.RGBA, gl.FLOAT, null)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

    const fb = gl.createFramebuffer()!
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)

    this.world.lightBufferTex = tex
    this.world.lightBufferFb = fb

    graph.defineRenderTarget('lightBuffer', new RenderTarget(undefined, this.width, this.height, fb))
  }

  execute(ctx: RenderContext): void {
    const gl = this.gl
    const world = this.world
    const config = world.config

    // Read the normal map from the upstream G-buffer target.
    const normalTarget = ctx.targets.get('normal')
    if (normalTarget?.texture) {
      world.gbufferNormalTex = normalTarget.texture.glTexture
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, world.lightBufferFb)
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)

    if (!this.program || !this.vao) {
      return
    }

    gl.useProgram(this.program)
    gl.bindVertexArray(this.vao)

    // G-buffer normal (slot 0) — may be null if no upstream G-buffer exists yet.
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, world.gbufferNormalTex)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_normal'), 0)

    // Shadow atlas (slot 1).
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, world.shadowAtlasTex)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_shadowAtlas'), 1)

    // Light data texture (slot 2).
    gl.activeTexture(gl.TEXTURE2)
    gl.bindTexture(gl.TEXTURE_2D, world.lightDataTex)
    gl.uniform1i(gl.getUniformLocation(this.program, 'u_lightData'), 2)

    gl.uniform1i(gl.getUniformLocation(this.program, 'u_lightCount'), world.activeLights.length)

    // Ambient light params.
    const amb = world.activeAmbient
    const ac = amb?.colour ?? config.ambientColour
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_ambientR'), ac.r)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_ambientG'), ac.g)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_ambientB'), ac.b)
    gl.uniform1f(
      gl.getUniformLocation(this.program, 'u_ambientIntensity'),
      amb?.intensity ?? config.ambientIntensity
    )
    const sky = amb?.skyColour ?? { r: 0.1, g: 0.1, b: 0.15 }
    const ground = amb?.groundColour ?? { r: 0.05, g: 0.04, b: 0.04 }
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_skyR'), sky.r)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_skyG'), sky.g)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_skyB'), sky.b)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_groundR'), ground.r)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_groundG'), ground.g)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_groundB'), ground.b)

    // Camera uniforms for world-pos reconstruction.
    gl.uniform2f(gl.getUniformLocation(this.program, 'u_cameraPos'), world.cameraPos.x, world.cameraPos.y)
    gl.uniform1f(gl.getUniformLocation(this.program, 'u_cameraZoom'), world.cameraZoom)
    gl.uniform2f(
      gl.getUniformLocation(this.program, 'u_viewportSize'),
      world.viewportWidth,
      world.viewportHeight
    )
    gl.uniform1i(
      gl.getUniformLocation(this.program, 'u_pixelSnapShadows'),
      config.pixelSnapShadows ? 1 : 0
    )

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.BLEND)
    gl.drawArrays(gl.TRIANGLES, 0, 6)

    gl.bindVertexArray(null)
  }
}
