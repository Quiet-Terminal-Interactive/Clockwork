export const packageId = 'qti-clockwork-lighting'

export type { LightingConfig, TextureHandle } from './config.js'
export { DEFAULT_LIGHTING_CONFIG } from './config.js'

export type {
  Vec2,
  Vec3,
  FalloffMode,
  PointLight,
  SpotLight,
  AmbientLight,
  EmissiveSprite,
  ShadowOccluder,
} from './components.js'
export {
  POINT_LIGHT,
  SPOT_LIGHT,
  AMBIENT_LIGHT,
  EMISSIVE_SPRITE,
  SHADOW_OCCLUDER,
} from './components.js'

export { LightingWorld, LIGHTING_WORLD_KEY, LIGHTING_CAMERA_KEY } from './world.js'
export type { ActiveLight, AmbientLightData, LightType } from './world.js'

export { LightingPlugin, createLightingPlugin, LIGHTING_CONFIG_KEY } from './plugin.js'
export type { LightingPluginOptions } from './plugin.js'
