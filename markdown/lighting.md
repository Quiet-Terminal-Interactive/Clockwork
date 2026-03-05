# qti-clockwork-lighting

`qti-clockwork-lighting` provides a deferred 2D lighting pipeline for Clockwork WebGL2 renderer stacks.

It includes:

- Point/spot/ambient light component schemas
- Shadow occluder support with CPU-generated shadow atlas strips
- Deferred light accumulation and composite passes
- Post-processing stages (bloom, vignette, colour LUT)
- Render graph integration via plugin-managed pass registration

Clockwork JVM equivalent uses renderer queue light draw calls and render-stage systems.

---

## Install

JavaScript/TypeScript:

```bash
npm i qti-clockwork-lighting
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
import { createLightingPlugin } from 'qti-clockwork-lighting'

const app = new AppBuilder()
  .use(
    createLightingPlugin({
      config: {
        bloomEnabled: true,
        shadowAtlasSize: 2048,
        maxLights: 64
      }
    })
  )
  .build()
```

JavaScript:

```js
import { AppBuilder } from 'qti-clockwork-app'
import { createLightingPlugin } from 'qti-clockwork-lighting'

const app = new AppBuilder()
  .use(
    createLightingPlugin({
      config: {
        bloomEnabled: true,
        shadowAtlasSize: 2048,
        maxLights: 64
      }
    })
  )
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

---

## Light Components

TypeScript:

```ts
import {
  POINT_LIGHT,
  SPOT_LIGHT,
  AMBIENT_LIGHT,
  SHADOW_OCCLUDER
} from 'qti-clockwork-lighting'

const point = app.world.spawnEntity()
app.world.addComponent(point, POINT_LIGHT, {
  position: { x: 8, y: 6 },
  colour: { r: 1, g: 0.9, b: 0.7 },
  intensity: 2.0,
  radius: 12,
  falloff: 'quadratic',
  castsShadows: true,
  shadowSoftness: 0.5
})

const ambient = app.world.spawnEntity()
app.world.addComponent(ambient, AMBIENT_LIGHT, {
  colour: { r: 0.1, g: 0.1, b: 0.15 },
  intensity: 1.0,
  skyColour: { r: 0.14, g: 0.14, b: 0.2 },
  groundColour: { r: 0.04, g: 0.04, b: 0.05 }
})

const occluder = app.world.spawnEntity()
app.world.addComponent(occluder, SHADOW_OCCLUDER, {
  segments: [
    [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    [{ x: 10, y: 0 }, { x: 10, y: 5 }]
  ]
})
```

JavaScript:

```js
import { POINT_LIGHT, AMBIENT_LIGHT, SHADOW_OCCLUDER } from 'qti-clockwork-lighting'

const point = app.world.spawnEntity()
app.world.addComponent(point, POINT_LIGHT, {
  position: { x: 8, y: 6 },
  colour: { r: 1, g: 0.9, b: 0.7 },
  intensity: 2.0,
  radius: 12,
  falloff: 'quadratic',
  castsShadows: true,
  shadowSoftness: 0.5
})

const ambient = app.world.spawnEntity()
app.world.addComponent(ambient, AMBIENT_LIGHT, {
  colour: { r: 0.1, g: 0.1, b: 0.15 },
  intensity: 1.0,
  skyColour: { r: 0.14, g: 0.14, b: 0.2 },
  groundColour: { r: 0.04, g: 0.04, b: 0.05 }
})

const occluder = app.world.spawnEntity()
app.world.addComponent(occluder, SHADOW_OCCLUDER, {
  segments: [
    [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    [{ x: 10, y: 0 }, { x: 10, y: 5 }]
  ]
})
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
    queue.lights().add(new RenderQueue.LightDrawCall(8.0f, 6.0f, 12.0f, 2.0f));
});
```

---

## World Resources

TypeScript:

```ts
import { LIGHTING_WORLD_KEY, LIGHTING_CONFIG_KEY, type LightingWorld } from 'qti-clockwork-lighting'

const lightingWorld = app.world.getResource(LIGHTING_WORLD_KEY) as LightingWorld
const lightingConfig = app.world.getResource(LIGHTING_CONFIG_KEY)

void lightingWorld
void lightingConfig
```

JavaScript:

```js
import { LIGHTING_WORLD_KEY, LIGHTING_CONFIG_KEY } from 'qti-clockwork-lighting'

const lightingWorld = app.world.getResource(LIGHTING_WORLD_KEY)
const lightingConfig = app.world.getResource(LIGHTING_CONFIG_KEY)

void lightingWorld
void lightingConfig
```

Clockwork JVM equivalent:

```java
import com.quietterminal.clockwork.renderer.ClockworkRendererPlugin;
import com.quietterminal.clockwork.renderer.RenderQueue;

RenderQueue queue = (RenderQueue) app.world().resources()
    .get(ClockworkRendererPlugin.RENDER_QUEUE_KEY)
    .orElseThrow();
System.out.println(queue.snapshot().lights().size());
```

---

## Notes

- The plugin registers a deferred pass chain (`shadowMap`, `lightingAccum`, `composite`, `postProcess`, `output`) into the render graph.
- `SHADOW_OCCLUDER` segments are ray-cast on CPU, then uploaded to the shadow atlas texture for shading.
- `LIGHTING_CAMERA_KEY` (`renderer:camera`) should be present so light culling and world-space reconstruction are accurate.
