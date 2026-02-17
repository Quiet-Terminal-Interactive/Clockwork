# Welcome to Clockwork

## What is Clockwork?

Clockwork is a TypeScript/JavaScript-first modular game engine package ecosystem focused on ECS runtime systems, deterministic scheduling, and a WebGL2 renderer stack. Core runtime systems (ECS, scheduler, events, serialization, assets, app/plugin runtime) are isolated from platform and renderer concerns, so teams can install only the pieces they need.

---

## Key Features

- **Modular Packages** - Install only the engine modules your project needs
- **ECS Runtime Core** - Generational entities, component stores, queries, command buffering, and resources
- **Deterministic Scheduler** - Fixed-step update loop with ordered stages and determinism checks
- **Event and Asset Pipelines** - Typed event bus plus asset loading, dependency tracking, and hot-reload support
- **Plugin-Driven App Runtime** - App builder, plugin lifecycle management, and ownership-safe registries
- **WebGL2 Renderer Stack** - Dedicated renderer packages for GL, shaders, materials, and render passes

---

## Quick Example

```js
import { AppBuilder, HeadlessRendererPlugin } from 'qti-clockwork-app'

const app = new AppBuilder().use(HeadlessRendererPlugin).build()

app.run()
await app.step(1 / 60)
await app.shutdown()
```

---

## Getting Started

New to Clockwork? Start here:

1. **[Installation Guide](installation.md)** - Install `qti-clockwork-*` packages in your project
2. **[Quick Start](quickstart.md)** - Run your first engine loop
3. **[Getting Started](getting-started.md)** - Learn core runtime concepts and package layout

---

## Documentation Structure

### Core Concepts
- [Getting Started](getting-started.md) - Architecture, package groups, and runtime flow
- [Architecture Overview](architecture/overview.md) - Layered design and package responsibilities
- [Runtime Lifecycle](architecture/runtime-lifecycle.md) - Build, run, step, and shutdown phases
- [Plugin System](architecture/plugin-system.md) - Dependency ordering and registry ownership
- [Runtime Sequences](architecture/sequences.md) - Sequence diagrams for build, frame, and reload flows

### Package Reference
- [Packages Overview](packages.md) - Core, renderer, platform, and app package map
- [Reference: Packages](reference/packages.md) - Package-by-package runtime summary
- [Reference: API Map](reference/api-map.md) - Main exported classes and where they live
- [Reference: Configuration](reference/configuration-reference.md) - Tooling config reference
- [Reference: API Index](reference/api/index.md) - Method-level API tables for each package
- [Reference: Runnable Examples](reference/examples/index.md) - Copy-paste examples by subsystem
- [Reference: Error Catalog](reference/errors/index.md) - Error signatures, causes, and fixes

### Tooling
- [Configuration](configuration.md) - `tsconfig`/`jsconfig`, Vitest aliases, ESLint, and Prettier
- [Installation](installation.md) - Environment setup and package installation
- [Testing](testing.md) - Testing Clockwork-based code in your project
- [Quick Start](quickstart.md) - Fastest way to run Clockwork in your app

### Workflows
- [Quick Start](quickstart.md) - First runtime loop in your project
- [Installation](installation.md) - First-time setup and troubleshooting
- [Guide: Create First Plugin](guides/create-first-plugin.md) - End-to-end plugin starter
- [Guide: Mod Manifests](guides/mod-manifests.md) - Mod schema and loading lifecycle
- [Guide: Testing and CI](guides/testing-and-ci.md) - Validation workflow by package
- [Guide: Publishing](guides/publishing.md) - Package publish workflow
- [Guide: Gotchas](guides/gotchas.md) - Known pitfalls and failure modes by subsystem
- [Decision Guide: ECS Queries](guides/decisions/ecs-queries.md) - Query filter and performance choices
- [Decision Guide: Scheduler Stages](guides/decisions/scheduler-stages.md) - Stage placement strategy
- [Decision Guide: Asset Loading](guides/decisions/assets.md) - Load/wait/reload/unload choices
- [Decision Guide: Rendering](guides/decisions/rendering.md) - Batch/pass pipeline decisions
- [Contributing](contributing.md) - Contribution process and project policies

### Policies
- [Contributing](contributing.md) - Pull request and contribution guidance
- [Code of Conduct](../CODE_OF_CONDUCT.md) - Community expectations
- [Security](../SECURITY.md) - Vulnerability reporting process
- [License](../LICENSE) - MIT license details

---

## Community

- **Issues** - [GitHub Issues](https://github.com/kohanmathers/clockwork/issues)
- **Discussions** - [GitHub Discussions](https://github.com/kohanmathers/clockwork/discussions)
- **Contributing** - [Contribution Guide](../CONTRIBUTING.md)

---

## Version Information

**Current Version:** 1.0.0

Clockwork is actively evolving. Core APIs exist and are tested, while some planned modules are still intentionally stubbed.

---

## License

Clockwork is licensed under the [MIT License](../LICENSE).

---

*Created with care by Kohan Mathers*
