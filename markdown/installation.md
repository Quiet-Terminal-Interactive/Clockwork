# Installation

This guide shows how to install Clockwork packages into your own project.

---

## Requirements

- **Node.js:** 22.x
- **Package manager:** npm, pnpm, yarn, or bun
- **OS:** Windows, macOS, or Linux

---

## Installation Steps

### 1. Create or open your project

```bash
mkdir my-game
cd my-game
npm init -y
```

If you already have a project, just `cd` into it.

### 2. Install Clockwork packages

Install the packages your app needs. Common starter set:

```bash
npm i qti-clockwork-app qti-clockwork-ecs qti-clockwork-scheduler qti-clockwork-events
```

Maven (`clockwork-jvm-core` — bridge, ECS, scheduler, math, events):

```xml
<dependency>
  <groupId>com.quietterminal</groupId>
  <artifactId>clockwork-jvm-core</artifactId>
  <version>1.0.0</version>
</dependency>
```

Gradle:

```gradle
dependencies {
    implementation("com.quietterminal:clockwork-jvm-core:1.0.0")
}
```

Renderer packages (optional):

```bash
npm i qti-clockwork-gl qti-clockwork-shaders qti-clockwork-materials qti-clockwork-passes
```

Maven (`clockwork-jvm-renderer` — LWJGL/OpenGL renderer, asset pipeline, input):

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

Other optional packages:

```bash
npm i qti-clockwork-assets qti-clockwork-serialization qti-clockwork-audio qti-clockwork-input qti-clockwork-tauri-bridge qti-clockwork-math qti-clockwork-physics qti-neon-client qti-clockwork-particles qti-clockwork-lighting
```

Maven (`clockwork-jvm-plugins` — PhysicsPlugin and NeonPlugin wrappers):

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

If you use pnpm/yarn/bun, swap `npm i` with your package manager equivalent.

---

## Verify Installation

Create `src/main.js` (or `src/main.ts`):

```js
import { AppBuilder, HeadlessRendererPlugin } from 'qti-clockwork-app'

const app = new AppBuilder().use(HeadlessRendererPlugin).build()

app.run()
await app.step(1 / 60)
await app.shutdown()
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;

ClockworkApp app = new ClockworkApp().build();
app.step(1.0 / 60.0);
app.shutdown();
```

Then run it with your normal JavaScript or TypeScript runtime/build flow.

---

## Package Selection

- Minimum runtime: `qti-clockwork-app`, `qti-clockwork-ecs`, `qti-clockwork-scheduler`
- Events: add `qti-clockwork-events`
- Assets: add `qti-clockwork-assets`
- Save/load: add `qti-clockwork-serialization`
- Deterministic fixed-point math: add `qti-clockwork-math`
- Rigid-body simulation: add `qti-clockwork-physics`
- Networking client: add `qti-neon-client`
- Simulation and visual particles: add `qti-clockwork-particles`
- Deferred lighting and post-process: add `qti-clockwork-lighting`
- WebGL rendering: add renderer packages (`gl`, `shaders`, `materials`, `passes`)

See [Packages Overview](packages.md) for full details.

---

## Troubleshooting

### `Cannot find module 'qti-clockwork-*'`

Reinstall dependencies:

```bash
npm install
```

### TypeScript or JavaScript import/module errors

- If using TypeScript, confirm `typescript` is installed in your project
- Confirm `moduleResolution` and ESM/CJS settings match your runtime
- Run your project typecheck command (commonly `npm run typecheck`)

### JavaScript module errors

- Confirm your runtime supports ESM imports, or configure CJS-compatible imports
- Check `type` in `package.json` (`module` vs `commonjs`) and align with your toolchain

### Node version issues

Check Node version:

```bash
node -v
```

Use Node 22.x if your environment is older.

---

## Source Repository Setup (Maintainers)

If you are contributing to Clockwork itself (not consuming published packages), use the source repo workflow in `CONTRIBUTING.md`.

## Next Steps

- **[Quick Start](quickstart.md)** - Build and run a minimal app loop
- **[Getting Started](getting-started.md)** - Understand runtime architecture and plugins
- **[Packages Overview](packages.md)** - Choose the right package set
- **[Math Package](math.md)** - Use fixed-point scalar/vector math helpers
- **[Physics Package](physics.md)** - Add deterministic rigid-body simulation
- **[Neon Package](neon.md)** - Add Neon networking client integration
- **[Particles Package](particles.md)** - Add simulation and visual particle systems
- **[Lighting Package](lighting.md)** - Add deferred lighting and shadow pipeline
