import type { AppBuilder, Plugin } from 'qti-clockwork-app'
import type { System, SystemContext } from 'qti-clockwork-scheduler'
import type { Camera2D } from 'qti-clockwork-passes'
import { World, type ResourceToken } from 'qti-clockwork-ecs'
import {
  LightingWorld,
  LIGHTING_WORLD_KEY,
  LIGHTING_CAMERA_KEY,
} from './world.js'
import type { LightingConfig } from './config.js'
import { DEFAULT_LIGHTING_CONFIG } from './config.js'
import {
  POINT_LIGHT,
  SPOT_LIGHT,
  AMBIENT_LIGHT,
  EMISSIVE_SPRITE,
  SHADOW_OCCLUDER,
  type PointLight,
  type SpotLight,
  type AmbientLight,
  type ShadowOccluder,
  type EmissiveSprite,
  type Vec2,
} from './components.js'
import { ShadowMapPass } from './passes/shadow-map.js'
import { LightingAccumPass } from './passes/lighting-accum.js'
import { CompositePass } from './passes/composite.js'
import { PostProcessPass } from './passes/post-process.js'
import { OutputPass } from './passes/output.js'

export const LIGHTING_CONFIG_KEY = 'lighting:config'

const DEFAULT_RENDER_GRAPH_RESOURCE_KEYS: readonly unknown[] = ['render:graph', 'passes:graph']
const DEFAULT_GL_RESOURCE_KEYS: readonly unknown[] = ['renderer:gl', 'gl', 'webgl2:context']
const DEFAULT_VIEWPORT_RESOURCE_KEYS: readonly unknown[] = ['renderer:viewport', 'render:viewport']

interface RenderPassLike {
  name: string
}

interface RenderGraphLike {
  addPass(pass: unknown): void
  compile?(): void
  getExecutionOrder?(): readonly string[]
}

interface ViewportLike {
  width: number
  height: number
}

export interface LightingPluginOptions {
  config?: Partial<LightingConfig>
  renderGraphResourceKeys?: readonly unknown[]
  glResourceKeys?: readonly unknown[]
  viewportResourceKeys?: readonly unknown[]
  width?: number
  height?: number
}

function makeLightingPrepSystem(world: LightingWorld): System {
  return {
    id: 'lighting:prep',
    stage: 'RenderPrep',
    order: 0,
    reads: [POINT_LIGHT, SPOT_LIGHT, AMBIENT_LIGHT, EMISSIVE_SPRITE, SHADOW_OCCLUDER],
    writes: [],
    execute(ctx: SystemContext): void {
      world.clearFrame()

      const ecs = ctx.world as World
      const cam = ecs.tryGetResource<Camera2D>(LIGHTING_CAMERA_KEY)
      if (cam) {
        world.updateCamera(cam)
      }

      const occluderSegments: [Vec2, Vec2][] = []
      for (const entity of ecs.entities.iterAlive()) {
        const occ = ecs.getComponent(entity, SHADOW_OCCLUDER) as ShadowOccluder | undefined
        if (!occ) {
          continue
        }
        for (const seg of occ.segments) {
          occluderSegments.push(seg)
        }
      }

      for (const entity of ecs.entities.iterAlive()) {
        const light = ecs.getComponent(entity, POINT_LIGHT) as PointLight | undefined
        if (light) {
          world.addPointLight(light)
        }
      }

      for (const entity of ecs.entities.iterAlive()) {
        const light = ecs.getComponent(entity, SPOT_LIGHT) as SpotLight | undefined
        if (light) {
          world.addSpotLight(light)
        }
      }

      for (const entity of ecs.entities.iterAlive()) {
        const amb = ecs.getComponent(entity, AMBIENT_LIGHT) as AmbientLight | undefined
        if (amb) {
          world.setAmbientLight(amb)
          break
        }
      }

      for (const entity of ecs.entities.iterAlive()) {
        const em = ecs.getComponent(entity, EMISSIVE_SPRITE) as EmissiveSprite | undefined
        if (em && em.intensity > 0) {
          world.emissiveEntities.add(entity.index)
        }
      }

      world.cullLightsToCamera()
      world.computeShadowMaps(occluderSegments)
    },
  }
}

function makePassAttachSystem(
  world: LightingWorld,
  options: LightingPluginOptions
): System {
  let attached = false
  return {
    id: 'lighting:render-pass-register',
    stage: 'Boot',
    order: 5,
    reads: [],
    writes: [],
    execute(ctx: SystemContext): void {
      if (attached) {
        return
      }
      const ecs = ctx.world as World
      const graph = findResource<RenderGraphLike>(
        ecs,
        options.renderGraphResourceKeys ?? DEFAULT_RENDER_GRAPH_RESOURCE_KEYS
      )
      if (!graph || typeof graph.addPass !== 'function') {
        return
      }

      const gl = findResource<WebGL2RenderingContext>(
        ecs,
        options.glResourceKeys ?? DEFAULT_GL_RESOURCE_KEYS
      )
      if (!gl) {
        return
      }

      const size = resolveSize(ecs, gl, options)
      if (!size) {
        return
      }

      const passes: RenderPassLike[] = [
        new ShadowMapPass(gl, world),
        new LightingAccumPass(gl, world, size.width, size.height),
        new CompositePass(gl, world, size.width, size.height),
        new PostProcessPass(gl, world, size.width, size.height),
        new OutputPass(gl, world, size.width, size.height),
      ]

      const existing = new Set(graph.getExecutionOrder?.() ?? [])
      for (const pass of passes) {
        if (!existing.has(pass.name)) {
          graph.addPass(pass)
        }
      }
      graph.compile?.()
      attached = true
    },
  }
}

function findResource<T>(world: World, keys: readonly unknown[]): T | undefined {
  for (const key of keys) {
    const value = world.tryGetResource<T>(key as ResourceToken<T>)
    if (value !== undefined) {
      return value
    }
  }
  return undefined
}

function resolveSize(
  world: World,
  gl: WebGL2RenderingContext,
  options: LightingPluginOptions
): { width: number; height: number } | null {
  if (Number.isFinite(options.width) && Number.isFinite(options.height)) {
    return { width: Number(options.width), height: Number(options.height) }
  }

  const viewport = findResource<ViewportLike>(
    world,
    options.viewportResourceKeys ?? DEFAULT_VIEWPORT_RESOURCE_KEYS
  )
  if (viewport) {
    return { width: viewport.width, height: viewport.height }
  }

  const canvas = gl.canvas as { width?: number; height?: number } | null
  if (canvas && Number.isFinite(canvas.width) && Number.isFinite(canvas.height)) {
    return { width: Number(canvas.width), height: Number(canvas.height) }
  }

  return null
}

function makeComponentSchema(name: string) {
  return {
    name,
    version: 1,
    fields: [],
    serialize(component: unknown): Uint8Array {
      return new TextEncoder().encode(JSON.stringify(component))
    },
    deserialize(data: Uint8Array): unknown {
      return JSON.parse(new TextDecoder().decode(data))
    },
  }
}

export function createLightingPlugin(options: LightingPluginOptions = {}): Plugin {
  return {
    id: 'qti-clockwork-lighting',
    version: '1.0.0',
    init(app: AppBuilder) {
      const config: LightingConfig = { ...DEFAULT_LIGHTING_CONFIG, ...(options.config ?? {}) }
      const world = new LightingWorld(config)

      app.components.register(POINT_LIGHT, makeComponentSchema('PointLight'))
      app.components.register(SPOT_LIGHT, makeComponentSchema('SpotLight'))
      app.components.register(AMBIENT_LIGHT, makeComponentSchema('AmbientLight'))
      app.components.register(EMISSIVE_SPRITE, makeComponentSchema('EmissiveSprite'))
      app.components.register(SHADOW_OCCLUDER, makeComponentSchema('ShadowOccluder'))

      app.resources.insert(LIGHTING_CONFIG_KEY, config)
      app.resources.insert(LIGHTING_WORLD_KEY, world)

      app.systems.add('Boot', makePassAttachSystem(world, options), { order: 5 })
      app.systems.add('RenderPrep', makeLightingPrepSystem(world), { order: 0 })
    },
  }
}

export const LightingPlugin: Plugin = createLightingPlugin()
