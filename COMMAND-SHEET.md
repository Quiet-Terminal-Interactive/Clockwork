# Clockwork Command Cheat Sheet

Run these from repo root.

## Setup

```bash
corepack pnpm install
```

## Quality checks

```bash
corepack pnpm lint
corepack pnpm typecheck
corepack pnpm test
```

## Build everything

```bash
corepack pnpm build
```

## Run web shell in dev mode

```bash
corepack pnpm dev
```

## Formatting

```bash
corepack pnpm format        # writes changes
corepack pnpm format:check  # check only
```

## Run one package only (examples)

```bash
corepack pnpm --filter @clockwork/ecs test
corepack pnpm --filter @clockwork/ecs build
corepack pnpm --filter @clockwork/tauri-shell-web dev
```

## Typical pre-commit flow

```bash
corepack pnpm lint && corepack pnpm format && corepack pnpm typecheck && corepack pnpm test && corepack pnpm build
```
