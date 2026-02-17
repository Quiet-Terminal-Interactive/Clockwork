# Quick Start

Welcome to Clockwork. This guide walks through a minimal runtime flow inside your own project.

## Introduction

This quick start assumes you have completed [Installation](installation.md). You will:

- Install the runtime package
- Build a minimal app using `qti-clockwork-app`
- Execute one frame manually

## Step 1: Install the package

```bash
npm i qti-clockwork-app
```

If you use another package manager, install the same package with that tool.

## Step 2: Create a Minimal App

Use this minimal example:

```js
import { AppBuilder, HeadlessRendererPlugin } from 'qti-clockwork-app'

const app = new AppBuilder().use(HeadlessRendererPlugin).build()

app.run()
await app.step(1 / 60)
await app.shutdown()
```

What this does:

- Creates an `AppBuilder`
- Registers a renderer plugin
- Builds an `App` with a `World`, `Scheduler`, and plugin graph
- Runs one frame (`1/60`) and shuts down cleanly

## Step 3: Run It

Run `src/main.js` (or `src/main.ts`) with your project runtime (for example `node`, `tsx`, Vite, or your existing app bootstrap).

## Step 4: Validate in Your Project

Use your project scripts:

```bash
npm test
npm run typecheck
```

If your project does not have scripts yet, you can skip this for now and add tests later.

## Next Steps

- Read [Getting Started](getting-started.md) for architecture and concepts
- Review [Packages Overview](packages.md) for package responsibilities
- Check [Reference: API Index](reference/api/index.md) for method-level API details
