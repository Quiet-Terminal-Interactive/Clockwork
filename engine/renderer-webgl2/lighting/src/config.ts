/** WebGL texture handle (2D or 3D depending on context). */
export type TextureHandle = WebGLTexture | null

export interface LightingConfig {
  ambientColour: { r: number; g: number; b: number }
  ambientIntensity: number
  maxLights: number
  shadowAtlasSize: number
  bloomEnabled: boolean
  bloomThreshold: number
  bloomIntensity: number
  bloomRadius: number
  vignetteEnabled: boolean
  vignetteIntensity: number
  vignetteRadius: number
  /** 32×32×32 RGB8 3D LUT texture, or null for identity. */
  colourLUT: TextureHandle
  pixelSnapShadows: boolean
}

export const DEFAULT_LIGHTING_CONFIG: LightingConfig = {
  ambientColour: { r: 0.05, g: 0.05, b: 0.1 },
  ambientIntensity: 1.0,
  maxLights: 128,
  shadowAtlasSize: 4096,
  bloomEnabled: true,
  bloomThreshold: 1.0,
  bloomIntensity: 0.5,
  bloomRadius: 1.0,
  vignetteEnabled: false,
  vignetteIntensity: 0.4,
  vignetteRadius: 0.75,
  colourLUT: null,
  pixelSnapShadows: true,
}
