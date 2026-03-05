# qti-clockwork-physics

`qti-clockwork-physics` provides deterministic 2D rigid-body simulation for Clockwork.

It includes:

- Rigid body and collider component schemas
- Broad-phase and narrow-phase collision detection
- Sequential impulse constraint solving
- Sleep/wake and collision lifecycle events
- Structural stress and fracture helpers

Clockwork JVM includes a matching physics plugin under `com.quietterminal.clockwork.plugins`.

---

## Install

JavaScript/TypeScript:

```bash
npm i qti-clockwork-physics
```

Maven (Clockwork JVM — physics plugin is in `clockwork-jvm-plugins`):

```xml
<dependency>
  <groupId>com.quietterminal</groupId>
  <artifactId>clockwork-jvm-plugins</artifactId>
  <version>1.0.0</version>
</dependency>
```

Gradle:

```gradle
dependencies {
    implementation("com.quietterminal:clockwork-jvm-plugins:1.0.0")
}
```

---

## Register the Plugin

TypeScript:

```ts
import { AppBuilder } from 'qti-clockwork-app'
import { Fixed, Vec2 } from 'qti-clockwork-math'
import { PhysicsPlugin } from 'qti-clockwork-physics'

const app = new AppBuilder()
  .use(
    PhysicsPlugin({
      gravity: Vec2.create(Fixed.from(0), Fixed.from(-9.81)),
      solverIterations: 8
    })
  )
  .build()

app.run()
await app.step(1 / 60)
await app.shutdown()
```

JavaScript:

```js
import { AppBuilder } from 'qti-clockwork-app'
import { Fixed, Vec2 } from 'qti-clockwork-math'
import { PhysicsPlugin } from 'qti-clockwork-physics'

const app = new AppBuilder()
  .use(
    PhysicsPlugin({
      gravity: Vec2.create(Fixed.from(0), Fixed.from(-9.81)),
      solverIterations: 8
    })
  )
  .build()

app.run()
await app.step(1 / 60)
await app.shutdown()
```

Clockwork JVM example:

```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.plugins.PhysicsConfig;
import com.quietterminal.clockwork.plugins.PhysicsPlugin;

ClockworkApp app = new ClockworkApp()
    .use(new PhysicsPlugin(
        PhysicsConfig.builder()
            .gravity(Fixed.from(-9.8))
            .solverIterations(8)
            .build()
    ))
    .build();

app.step(1.0 / 60.0);
app.shutdown();
```

---

## Components and Events

TypeScript:

```ts
import {
  RIGID_BODY,
  COLLIDER,
  CollisionStarted,
  type RigidBody,
  type Collider
} from 'qti-clockwork-physics'
import { World } from 'qti-clockwork-ecs'
import { Fixed, Vec2 } from 'qti-clockwork-math'

const body: RigidBody = {
  position: Vec2.create(Fixed.from(0), Fixed.from(10)),
  velocity: Vec2.create(Fixed.from(0), Fixed.from(0)),
  angle: Fixed.from(0),
  angularVelocity: Fixed.from(0),
  mass: Fixed.from(1),
  invMass: Fixed.from(1),
  inertia: Fixed.from(1),
  invInertia: Fixed.from(1),
  restitution: Fixed.from(0.3),
  friction: Fixed.from(0.5),
  linearDamping: Fixed.from(0.01),
  angularDamping: Fixed.from(0.01),
  isStatic: false,
  isSleeping: false,
  sleepTimer: 0
}

const collider: Collider = {
  shape: { type: 'circle', radius: Fixed.from(1) },
  offset: Vec2.create(Fixed.from(0), Fixed.from(0)),
  angle: Fixed.from(0)
}

const world = new World()
const entity = world.spawn().build()
world.addComponent(entity, RIGID_BODY, body)
world.addComponent(entity, COLLIDER, collider)

void CollisionStarted
```

JavaScript:

```js
import { RIGID_BODY, COLLIDER, CollisionStarted } from 'qti-clockwork-physics'
import { World } from 'qti-clockwork-ecs'
import { Fixed, Vec2 } from 'qti-clockwork-math'

const body = {
  position: Vec2.create(Fixed.from(0), Fixed.from(10)),
  velocity: Vec2.create(Fixed.from(0), Fixed.from(0)),
  angle: Fixed.from(0),
  angularVelocity: Fixed.from(0),
  mass: Fixed.from(1),
  invMass: Fixed.from(1),
  inertia: Fixed.from(1),
  invInertia: Fixed.from(1),
  restitution: Fixed.from(0.3),
  friction: Fixed.from(0.5),
  linearDamping: Fixed.from(0.01),
  angularDamping: Fixed.from(0.01),
  isStatic: false,
  isSleeping: false,
  sleepTimer: 0
}

const collider = {
  shape: { type: 'circle', radius: Fixed.from(1) },
  offset: Vec2.create(Fixed.from(0), Fixed.from(0)),
  angle: Fixed.from(0)
}

const world = new World()
const entity = world.spawn().build()
world.addComponent(entity, RIGID_BODY, body)
world.addComponent(entity, COLLIDER, collider)

void CollisionStarted
```

Clockwork JVM example:

```java
import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.plugins.ColliderComponent;
import com.quietterminal.clockwork.plugins.CollisionStartedEvent;
import com.quietterminal.clockwork.plugins.RigidBodyComponent;
import com.quietterminal.clockwork.ClockworkApp;

ClockworkApp app = new ClockworkApp().build();

RigidBodyComponent body = RigidBodyComponent.dynamic(new Vec2(Fixed.ZERO, Fixed.from(10.0)));
ColliderComponent collider = ColliderComponent.circle(Fixed.from(1.0), 0xFFFF);
Commands commands = app.world().commands();
commands.spawn().with(body).with(collider);
app.world().commit(commands);

// Listen for collision events through your event bus/listener system.
Class<CollisionStartedEvent> eventType = CollisionStartedEvent.class;
System.out.println(body.position() + " " + collider.shapeType() + " " + eventType.getSimpleName());
```

---

## Structural Helpers

TypeScript:

```ts
import { buildStructuralBody, type PhysicsMaterial } from 'qti-clockwork-physics'
import { Fixed } from 'qti-clockwork-math'

const pixels = new Uint8Array([
  1, 1, 1,
  1, 1, 1,
  1, 1, 1
])

const material: PhysicsMaterial = {
  density: Fixed.from(1),
  restitution: Fixed.from(0.3),
  friction: Fixed.from(0.5),
  tensileStrength: Fixed.from(10)
}

const structural = buildStructuralBody(
  pixels,
  new Uint8Array(pixels.length).fill(0),
  3,
  3,
  [material]
)
```

JavaScript:

```js
import { buildStructuralBody } from 'qti-clockwork-physics'
import { Fixed } from 'qti-clockwork-math'

const pixels = new Uint8Array([
  1, 1, 1,
  1, 1, 1,
  1, 1, 1
])

const material = {
  density: Fixed.from(1),
  restitution: Fixed.from(0.3),
  friction: Fixed.from(0.5),
  tensileStrength: Fixed.from(10)
}

const structural = buildStructuralBody(
  pixels,
  new Uint8Array(pixels.length).fill(0),
  3,
  3,
  [material]
)
```

Clockwork JVM equivalent:

```java
import com.quietterminal.clockwork.plugins.StructuralBodyComponent;
import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;

StructuralBodyComponent structural = new StructuralBodyComponent(
    9,
    false,
    new Vec2(Fixed.ZERO, Fixed.ZERO),
    Fixed.from(1.0),
    Fixed.from(1.0)
);
```

---

## Notes

- Physics uses `qti-clockwork-math` fixed-point types (`Fixed`, `Vec2`) for deterministic simulation.
- `PhysicsPlugin` installs a fixed-tick physics step system and physics world resource.
- Structural fracture helpers are available in JavaScript/TypeScript package APIs; Clockwork JVM currently exposes structural snapshot components and physics bridge integration.
