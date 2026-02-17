# Testing

## Overview

Clockwork packages are tested upstream with Vitest. In your project, test your own systems/plugins that use Clockwork APIs.

Recommended test layout:

- `src/**/*.test.ts` or `src/**/*.test.js`
- `tests/**/*.test.ts` or `tests/**/*.test.js`

## Run Tests in Your Project

```bash
npm test
```

## Typical Validation Commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Example Runtime Smoke Test

```js
import { describe, it } from 'vitest'
import { AppBuilder, HeadlessRendererPlugin } from 'qti-clockwork-app'

describe('clockwork runtime', () => {
  it('runs one frame', async () => {
    const app = new AppBuilder().use(HeadlessRendererPlugin).build()
    app.run()
    await app.step(1 / 60)
    await app.shutdown()
  })
})
```

## CI Guidance

Use the same commands in CI that you run locally (`lint`, `typecheck`, `test`, `build`).

## Notes

- If your tests use path aliases, mirror alias config between `tsconfig.json`/`jsconfig.json` and your test runner.
- If you consume ESM builds, ensure your test runtime supports your module format.

## Maintainer Note

The Clockwork source repository has additional workspace-level Vitest configuration for package development.

If tests fail due to module resolution, verify alias entries in your Vitest config (`vitest.config.ts` or `vitest.config.js`).
