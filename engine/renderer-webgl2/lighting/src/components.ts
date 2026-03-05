export interface Vec2 {
  x: number
  y: number
}

export interface Vec3 {
  r: number
  g: number
  b: number
}

export type FalloffMode = 'linear' | 'quadratic' | 'inverse'

export interface PointLight {
  position: Vec2
  colour: Vec3
  intensity: number
  radius: number
  falloff: FalloffMode
  castsShadows: boolean
  /** 0 = hard pixel shadows, 1 = soft penumbra (4-sample Poisson). */
  shadowSoftness: number
  /** Shadow map resolution for this light. Default 512. */
  shadowResolution?: number
}

export interface SpotLight extends PointLight {
  direction: Vec2
  innerAngle: number
  outerAngle: number
}

export interface AmbientLight {
  colour: Vec3
  intensity: number
  skyColour: Vec3
  groundColour: Vec3
}

/** Marks a sprite as emissive; feeds into bloom. Not a positioned light source. */
export interface EmissiveSprite {
  intensity: number
}

/** World-space line segments that block light from shadow-casting lights. */
export interface ShadowOccluder {
  segments: [Vec2, Vec2][]
}

export const POINT_LIGHT = Symbol('lighting:point-light')
export const SPOT_LIGHT = Symbol('lighting:spot-light')
export const AMBIENT_LIGHT = Symbol('lighting:ambient-light')
export const EMISSIVE_SPRITE = Symbol('lighting:emissive-sprite')
export const SHADOW_OCCLUDER = Symbol('lighting:shadow-occluder')
