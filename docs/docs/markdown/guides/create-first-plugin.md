# Guide: Create Your First Plugin

This guide creates a minimal plugin and runs one frame.

## 1. Define Plugin

```js
import { AppBuilder } from 'qti-clockwork-app'

const ExamplePlugin = {
  id: 'example',
  version: '1.0.0',
  init(app) {
    app.resources.insert('example-config', { enabled: true })
  },
  shutdown() {
    // cleanup
  }
}
```

## 2. Register and Build

```js
const app = new AppBuilder().use(ExamplePlugin).build()
```

## 3. Run and Step

```js
app.run()
await app.step(1 / 60)
await app.shutdown()
```

## 4. Add a System

Inside `init(app)`:

```js
app.systems.add('Update', {
  id: 'example.update',
  stage: 'Update',
  order: 100,
  reads: [],
  writes: [],
  execute(ctx) {
    void ctx
  }
})
```

## 5. Validate

Run:

```bash
npm test
npm run typecheck
```
