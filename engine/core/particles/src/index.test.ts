import { describe, expect, it } from 'vitest'
import { AppBuilder } from 'qti-clockwork-app'
import { Fixed, Vec2 } from 'qti-clockwork-math'
import {
  packageId,
  PARTICLE_EMITTER,
  PARTICLE_WORLD_KEY,
  VISUAL_PARTICLE_WORLD_KEY,
  ParticleGraphPass,
  ParticlePlugin,
  ParticleVisualBridgePlugin,
  ParticleWorld,
  VisualParticleWorld,
  createParticleEmitter,
  deserializeParticleWorld,
  registerParticleSerialization,
  serializeParticleWorld,
  SIM_PARTICLE_REGION
} from './index.js'

const PhysicsStubPlugin = {
  id: 'qti-clockwork-physics',
  version: '1.0.0',
  init() {}
}

describe('particles package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-particles')
  })

  it('registers particle resources via plugin', () => {
    const app = new AppBuilder()
      .use(PhysicsStubPlugin)
      .use(ParticlePlugin())
      .build()

    expect(app.world.tryGetResource(PARTICLE_WORLD_KEY)).toBeInstanceOf(
      ParticleWorld
    )
    expect(app.world.tryGetResource(VISUAL_PARTICLE_WORLD_KEY)).toBeInstanceOf(
      VisualParticleWorld
    )
  })

  it('simulates builtin powder movement deterministically', () => {
    const world = new ParticleWorld({ seed: 1234 })
    world.ensureRegion({
      origin: { x: 0, y: 0 },
      size: { width: 8, height: 8 },
      active: true,
      seed: 9
    })
    world.setMaterial(3, 6, 1)

    world.step()

    const below = world.getCell(3, 5)
    expect(below.material).toBe(1)
  })

  it('freezes and thaws inactive regions with serialization snapshots', () => {
    const world = new ParticleWorld()
    world.ensureRegion({
      origin: { x: 0, y: 0 },
      size: { width: 4, height: 4 },
      active: true,
      seed: 7
    })
    world.setMaterial(1, 1, 1)
    world.ensureRegion({
      origin: { x: 0, y: 0 },
      size: { width: 4, height: 4 },
      active: false,
      seed: 7
    })

    const snapshot = world.serializeFrozenRegion('0:0')
    expect(snapshot).toBeDefined()
    expect(snapshot?.cells.some((cell) => cell.material === 1)).toBe(true)

    if (snapshot) {
      world.thawRegion(snapshot)
    }
    expect(world.getCell(1, 1).material).toBe(1)
  })

  it('serializes and restores particle world frozen chunks', () => {
    const world = new ParticleWorld()
    world.ensureRegion({
      origin: { x: 0, y: 0 },
      size: { width: 4, height: 4 },
      active: true,
      seed: 4
    })
    world.setMaterial(2, 2, 1)
    world.ensureRegion({
      origin: { x: 0, y: 0 },
      size: { width: 4, height: 4 },
      active: false,
      seed: 4
    })

    const bytes = serializeParticleWorld(world)
    const restored = new ParticleWorld()
    deserializeParticleWorld(restored, bytes)
    const snapshot = restored.serializeFrozenRegion('0:0')
    expect(snapshot).toBeDefined()
  })

  it('uses configured chunkSize when region dimensions are invalid', () => {
    const world = new ParticleWorld({ chunkSize: 6 })
    world.ensureRegion({
      origin: { x: 0, y: 0 },
      size: { width: 0, height: 0 },
      active: true,
      seed: 11
    })

    world.setMaterial(5, 5, 1)
    expect(world.getCell(5, 5).material).toBe(1)
  })

  it('applies particle physics coupling to rigid bodies and structural erosion', () => {
    const world = new ParticleWorld()
    world.ensureRegion({
      origin: { x: 0, y: 0 },
      size: { width: 8, height: 8 },
      active: true,
      seed: 1
    })
    world.setMaterial(3, 3, 3)
    world.setMaterial(4, 3, 8)
    world.setMaterial(3, 2, 11)

    const rigidBodyToken = Symbol('physics:RigidBody')
    const colliderToken = Symbol('physics:Collider')
    const structuralToken = Symbol('physics:StructuralBody')

    const body = {
      position: Vec2.create(Fixed.from(3), Fixed.from(3)),
      velocity: Vec2.create(Fixed.from(0), Fixed.from(0)),
      isStatic: false
    }
    const collider = {
      shape: { type: 'aabb', half: Vec2.create(Fixed.from(1), Fixed.from(1)) },
      offset: Vec2.create(Fixed.from(0), Fixed.from(0)),
      angle: Fixed.from(0)
    }
    const structural = {
      pixels: new Uint8Array(16).fill(1),
      width: 4,
      height: 4,
      stressMap: new Float32Array(16)
    }

    const entity = { index: 1, generation: 0 }
    const fakeWorld = {
      components: new Map([
        [rigidBodyToken, {}],
        [colliderToken, {}],
        [structuralToken, {}]
      ]),
      entities: {
        *iterAlive() {
          yield entity
        }
      },
      getComponent(target: typeof entity, token: unknown) {
        if (target.index !== entity.index) return undefined
        if (token === rigidBodyToken) return body
        if (token === colliderToken) return collider
        if (token === structuralToken) return structural
        return undefined
      }
    }

    const report = world.applyPhysicsInteractions(fakeWorld)
    expect(report.buoyancyApplications).toBeGreaterThan(0)
    expect(report.pressureApplications).toBeGreaterThan(0)
    expect(report.erosionApplications).toBeGreaterThan(0)
  })

  it('detonates explosives from pressure and propagates pressure wave', () => {
    const world = new ParticleWorld()
    world.ensureRegion({
      origin: { x: 0, y: 0 },
      size: { width: 8, height: 8 },
      active: true,
      seed: 3
    })

    const explosive = world.getCell(4, 4)
    explosive.material = 12
    explosive.pressure = Fixed.from(2.2)
    world.setCell(4, 4, explosive)
    world.setMaterial(5, 4, 5)

    world.step()

    expect(world.drainEvents().some((event) => event.type === 'explode')).toBe(
      true
    )
    expect(Fixed.to(world.getCell(5, 4).pressure)).toBeGreaterThan(0)
  })

  it('simulates visual particles from emitter components', async () => {
    const app = new AppBuilder()
      .use(PhysicsStubPlugin)
      .use(ParticlePlugin())
      .build()

    const emitter = createParticleEmitter({ emissionRate: 60 })
    const entity = app.world.spawnEntity()
    app.world.addComponent(entity, PARTICLE_EMITTER, emitter)

    app.scheduler.run()
    await app.scheduler.step(1 / 60)

    const visual = app.world.getResource(
      VISUAL_PARTICLE_WORLD_KEY
    ) as VisualParticleWorld
    expect(visual.getParticles().length).toBeGreaterThan(0)
  })

  it('supports gpu backend mode without cpu readback', () => {
    const backend = {
      beginFrame() {},
      emit() {},
      step() {},
      endFrame() {
        return { activeParticles: 12, emittedThisFrame: 4 }
      },
      render() {}
    }
    const visual = new VisualParticleWorld({ backend })
    visual.step(1 / 60)
    expect(visual.getParticles()).toHaveLength(0)
    expect(visual.getGpuStats().activeParticles).toBe(12)
  })

  it('integrates into render graph pass execution', () => {
    let rendered = 0
    const backend = {
      beginFrame() {},
      emit() {},
      step() {},
      endFrame() {
        return { activeParticles: 2, emittedThisFrame: 2 }
      },
      render() {
        rendered += 1
      }
    }
    const visual = new VisualParticleWorld({ backend })
    const pass = new ParticleGraphPass(visual)
    pass.execute({ graph: {} as never, targets: new Map() })
    expect(rendered).toBe(1)
  })

  it('registers particle render pass into a render graph resource', async () => {
    const added: string[] = []
    const graph = {
      addPass(pass: { name: string }) {
        added.push(pass.name)
      },
      compile() {},
      getExecutionOrder() {
        return [...added]
      }
    }

    const app = new AppBuilder()
      .use(PhysicsStubPlugin)
      .use(ParticlePlugin())
      .build()
    app.world.insertResource('render:graph', graph)

    app.scheduler.run()
    await app.scheduler.step(1 / 60)

    expect(added).toContain('particles')
  })

  it('bridges simulation events to visual bursts', async () => {
    const app = new AppBuilder()
      .use(PhysicsStubPlugin)
      .use(ParticlePlugin())
      .use(ParticleVisualBridgePlugin())
      .build()

    const regionOwner = app.world.spawnEntity()
    app.world.addComponent(regionOwner, SIM_PARTICLE_REGION, {
      origin: { x: 0, y: 0 },
      size: { width: 8, height: 8 },
      active: true,
      seed: 1
    })

    const particleWorld = app.world.getResource(
      PARTICLE_WORLD_KEY
    ) as ParticleWorld
    particleWorld.emit({
      type: 'explode',
      material: 12,
      x: 4,
      y: 4,
      intensity: 1,
      preset: 'explosion',
      burstCount: 8
    })

    app.scheduler.run()
    await app.scheduler.step(1 / 60)

    const visual = app.world.getResource(
      VISUAL_PARTICLE_WORLD_KEY
    ) as VisualParticleWorld
    expect(visual.getParticles().length).toBeGreaterThan(0)
  })

  it('bridges material visual effects without explicit event preset', async () => {
    const app = new AppBuilder()
      .use(PhysicsStubPlugin)
      .use(ParticlePlugin())
      .use(ParticleVisualBridgePlugin())
      .build()

    const particleWorld = app.world.getResource(
      PARTICLE_WORLD_KEY
    ) as ParticleWorld
    particleWorld.emit({
      type: 'explode',
      material: 12,
      x: 2,
      y: 2,
      intensity: 1
    })

    app.scheduler.run()
    await app.scheduler.step(1 / 60)

    const visual = app.world.getResource(
      VISUAL_PARTICLE_WORLD_KEY
    ) as VisualParticleWorld
    expect(visual.getParticles().length).toBeGreaterThan(0)
  })

  it('registers serializer schemas for particle components and world snapshots', () => {
    const schemas = new Map<string, unknown>()
    const serializer = {
      register(_type: unknown, schema: { typeId: string }) {
        schemas.set(schema.typeId, schema)
      }
    }
    expect(() => registerParticleSerialization(serializer)).not.toThrow()
    expect(schemas.has('particles:ParticleEmitter')).toBe(true)
    expect(schemas.has('particles:SimParticleRegion')).toBe(true)
    expect(schemas.has('particles:ParticleWorldSnapshot')).toBe(true)
  })

  it('auto-registers serialization when serializer token is provided', async () => {
    const schemas = new Map<string, unknown>()
    const serializer = {
      register(_type: unknown, schema: { typeId: string }) {
        schemas.set(schema.typeId, schema)
      }
    }
    const serializerToken = Symbol('serializer')

    const app = new AppBuilder()
      .use(PhysicsStubPlugin)
      .use(ParticlePlugin({ serializerToken }))
      .build()
    app.world.insertResource(serializerToken, serializer)

    app.scheduler.run()
    await app.scheduler.step(1 / 60)

    expect(schemas.has('particles:ParticleEmitter')).toBe(true)
  })
})
