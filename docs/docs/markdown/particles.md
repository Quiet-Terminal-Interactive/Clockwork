# qti-clockwork-particles

`qti-clockwork-particles` provides deterministic simulation particles and visual particle rendering integration for Clockwork.

It includes:

- Chunked simulation particle world with builtin materials/reactions
- Visual particle emitters and preset-driven burst effects
- Physics coupling hooks for buoyancy, pressure, and structural erosion
- Optional GPU transform-feedback visual backend
- Plugin systems for simulation, visual update, snapshot sync, and render pass registration

Clockwork JVM equivalent uses renderer queue particle draw calls and render-stage systems.

---

## Install

JavaScript/TypeScript:

```bash
npm i qti-clockwork-particles
```

Maven (Clockwork JVM — renderer is in `clockwork-jvm-renderer`):

```xml
<dependency>
  <groupId>com.quietterminal</groupId>
  <artifactId>clockwork-jvm-renderer</artifactId>
  <version>1.0.0</version>
</dependency>
```

Gradle:

```gradle
dependencies {
    implementation("com.quietterminal:clockwork-jvm-renderer:1.0.0")
}
```

---

## Register the Plugin

TypeScript:

```ts
import { AppBuilder } from 'qti-clockwork-app'
import { PhysicsPlugin } from 'qti-clockwork-physics'
import { ParticlePlugin, ParticleVisualBridgePlugin } from 'qti-clockwork-particles'

const app = new AppBuilder()
  .use(PhysicsPlugin())
  .use(ParticlePlugin())
  .use(ParticleVisualBridgePlugin())
  .build()
```

JavaScript:

```js
import { AppBuilder } from 'qti-clockwork-app'
import { PhysicsPlugin } from 'qti-clockwork-physics'
import { ParticlePlugin, ParticleVisualBridgePlugin } from 'qti-clockwork-particles'

const app = new AppBuilder()
  .use(PhysicsPlugin())
  .use(ParticlePlugin())
  .use(ParticleVisualBridgePlugin())
  .build()
```

Clockwork JVM example:

```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.renderer.ClockworkRendererPlugin;
import com.quietterminal.clockwork.renderer.WindowConfig;

ClockworkApp app = new ClockworkApp()
    .use(new ClockworkRendererPlugin(WindowConfig.builder().build()))
    .build();
```

> ClockworkJVM has no native ParticlePlugin equivalent — particle effects are submitted directly as draw calls via RenderQueue.

---

## Emitters and Regions

TypeScript:

```ts
import { createParticleEmitter, PARTICLE_EMITTER, SIM_PARTICLE_REGION } from 'qti-clockwork-particles'

const regionOwner = app.world.spawnEntity()
app.world.addComponent(regionOwner, SIM_PARTICLE_REGION, {
  origin: { x: 0, y: 0 },
  size: { width: 64, height: 64 },
  active: true,
  seed: 1234
})

const emitterEntity = app.world.spawnEntity()
app.world.addComponent(
  emitterEntity,
  PARTICLE_EMITTER,
  createParticleEmitter({
    position: { x: 8, y: 8 },
    emissionRate: 24
  })
)
```

JavaScript:

```js
import { createParticleEmitter, PARTICLE_EMITTER, SIM_PARTICLE_REGION } from 'qti-clockwork-particles'

const regionOwner = app.world.spawnEntity()
app.world.addComponent(regionOwner, SIM_PARTICLE_REGION, {
  origin: { x: 0, y: 0 },
  size: { width: 64, height: 64 },
  active: true,
  seed: 1234
})

const emitterEntity = app.world.spawnEntity()
app.world.addComponent(
  emitterEntity,
  PARTICLE_EMITTER,
  createParticleEmitter({
    position: { x: 8, y: 8 },
    emissionRate: 24
  })
)
```

Clockwork JVM equivalent:

```java
import com.quietterminal.clockwork.scheduler.Stage;
import com.quietterminal.clockwork.renderer.ClockworkRendererPlugin;
import com.quietterminal.clockwork.renderer.RenderQueue;

app.addSystem(Stage.RENDER, ctx -> {
    RenderQueue queue = (RenderQueue) ctx.resources()
        .get(ClockworkRendererPlugin.RENDER_QUEUE_KEY)
        .orElseThrow();
    queue.particles().add(new RenderQueue.ParticleDrawCall(8.0f, 8.0f, 4.0f));
});
```

---

## World and Render Access

TypeScript:

```ts
import {
  PARTICLE_WORLD_KEY,
  VISUAL_PARTICLE_WORLD_KEY,
  PARTICLE_RENDER_PASS_KEY,
  type ParticleWorld,
  type VisualParticleWorld
} from 'qti-clockwork-particles'

const particleWorld = app.world.getResource(PARTICLE_WORLD_KEY) as ParticleWorld
const visualWorld = app.world.getResource(VISUAL_PARTICLE_WORLD_KEY) as VisualParticleWorld
const pass = app.world.getResource(PARTICLE_RENDER_PASS_KEY)

void particleWorld
void visualWorld
void pass
```

JavaScript:

```js
import { PARTICLE_WORLD_KEY, VISUAL_PARTICLE_WORLD_KEY, PARTICLE_RENDER_PASS_KEY } from 'qti-clockwork-particles'

const particleWorld = app.world.getResource(PARTICLE_WORLD_KEY)
const visualWorld = app.world.getResource(VISUAL_PARTICLE_WORLD_KEY)
const pass = app.world.getResource(PARTICLE_RENDER_PASS_KEY)

void particleWorld
void visualWorld
void pass
```

Clockwork JVM equivalent:

```java
import com.quietterminal.clockwork.renderer.ClockworkRendererPlugin;
import com.quietterminal.clockwork.renderer.RenderQueue;

RenderQueue queue = (RenderQueue) app.world().resources()
    .get(ClockworkRendererPlugin.RENDER_QUEUE_KEY)
    .orElseThrow();
System.out.println(queue.snapshot().particles().size());
```

---

## Notes

- `ParticlePlugin` depends on `qti-clockwork-physics`; register physics first.
- Simulation particles and visual particles are separate worlds bridged by event mapping.
- `ParticleVisualBridgePlugin` converts simulation events (fracture/explosion/ignite/erode) into visual bursts.
