import { type AppBuilder, type Plugin } from 'qti-clockwork-app'
import { PhysicsWorld, PHYSICS_WORLD_KEY, type PhysicsConfig } from './world.js'
import { makePhysicsStepSystem } from './systems/step.js'
import { makePhysicsDebugSystem } from './systems/debug.js'

/** Clockwork plugin that registers the physics simulation in the fixed tick. */
export function PhysicsPlugin(config?: Partial<PhysicsConfig>): Plugin {
  return {
    id: 'qti-clockwork-physics',
    version: '1.0.0',
    init(app: AppBuilder) {
      const physicsWorld = new PhysicsWorld(config)
      app.resources.insert(PHYSICS_WORLD_KEY, physicsWorld)
      app.systems.add('FixedUpdate', makePhysicsStepSystem(physicsWorld), {
        order: 0
      })
    }
  }
}

/** Optional debug overlay plugin — add only in dev builds. Requires PhysicsPlugin. */
export function PhysicsDebugPlugin(): Plugin {
  return {
    id: 'qti-clockwork-physics-debug',
    version: '1.0.0',
    depends: ['qti-clockwork-physics'],
    init(app: AppBuilder) {
      const physicsWorld = app.resources.get<PhysicsWorld>(PHYSICS_WORLD_KEY)
      if (!physicsWorld) {
        // PhysicsPlugin wasn't registered first. No crash, just no debug.
        return
      }
      app.systems.add('Render', makePhysicsDebugSystem(physicsWorld), {
        order: 9999
      })
    }
  }
}
