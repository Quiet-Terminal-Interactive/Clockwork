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

Renderer packages (optional):

```bash
npm i qti-clockwork-gl qti-clockwork-shaders qti-clockwork-materials qti-clockwork-passes
```

Other optional packages:

```bash
npm i qti-clockwork-assets qti-clockwork-serialization qti-clockwork-audio qti-clockwork-input qti-clockwork-tauri-bridge
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

Then run it with your normal JavaScript or TypeScript runtime/build flow.

---

## Package Selection

- Minimum runtime: `qti-clockwork-app`, `qti-clockwork-ecs`, `qti-clockwork-scheduler`
- Events: add `qti-clockwork-events`
- Assets: add `qti-clockwork-assets`
- Save/load: add `qti-clockwork-serialization`
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
