# Frequently Asked Questions

## General Questions

### What is Clockwork?

Clockwork is a TypeScript/JavaScript-first modular game engine package ecosystem with ECS runtime systems, a deterministic scheduler, and a WebGL2 renderer stack.

### Is Clockwork production-ready?

Core packages are implemented and tested. Some roadmap modules (for example full physics/particle systems) are still stubs.

### Which package manager can I use?

Any standard JS package manager works (`npm`, `pnpm`, `yarn`, or `bun`).

### What Node version is expected?

Node.js 22.x.

## Usage Questions

### Which package should I start with?

Start with `qti-clockwork-app`. Add `qti-clockwork-ecs` and `qti-clockwork-scheduler` for most runtime use cases.

### How do I add Clockwork to my project?

Install packages directly:

```bash
npm i qti-clockwork-app
```

Add additional `qti-clockwork-*` packages as needed by your app.

### How do I run my app locally?

Use your project's normal run command (`npm run dev`, `npm start`, etc.).

### How do I run tests?

Use your project's test command (commonly `npm test`).

## Architecture Questions

### What does `qti-clockwork-app` provide?

`AppBuilder`, plugin orchestration, registry ownership boundaries, and runtime assembly (`World` + `Scheduler` + plugins).

### How does the scheduler work?

It runs staged updates (`Boot` through `Shutdown`) and performs fixed-step sub-stepping in `FixedUpdate`.

### Is determinism considered?

Yes. The scheduler package includes `SeededRng` and a `DeterminismValidator` to surface common determinism risks.

### Can I use only one package?

Yes. Packages are modular and can be consumed independently where dependencies allow.

## Tooling Questions

### How are TypeScript and JavaScript configured across packages?

Clockwork packages ship typings and JS-compatible builds. Your project's `tsconfig.json` (if using TS) and runtime module settings control behavior.

### Why are there alias mappings in TypeScript/JavaScript tooling and Vitest?

If you use local aliases in your app, mirror them in your test runner config. This applies to both TS and JS projects.

### What formatter/linter rules should I follow?

Prettier with single quotes/no semicolons/trailing comma none, plus ESLint (`@typescript-eslint` when using TS, standard ESLint rules for JS-only projects).

### Does CI run the same checks locally available?

In the Clockwork source repository, yes. In your app, define CI checks that match your local scripts.

## Contribution Questions

### Where are contribution guidelines?

`CONTRIBUTING.md`

### Where should I report security issues?

`SECURITY.md`

### Is there a code of conduct?

Yes, see `CODE_OF_CONDUCT.md`.

### Is this project MIT licensed?

Yes. See `LICENSE`.
