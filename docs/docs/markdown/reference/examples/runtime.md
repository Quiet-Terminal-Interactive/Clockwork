# Runnable Examples: Runtime Composition

## Minimal Headless Loop

```js
import { AppBuilder, HeadlessRendererPlugin } from 'qti-clockwork-app'

const app = new AppBuilder().use(HeadlessRendererPlugin).build()

app.run()
await app.step(1 / 60)
await app.shutdown()
```

## Plugin With Resource + Update System

```js
import { AppBuilder } from 'qti-clockwork-app'

const TickCounter = Symbol('TickCounter')

const TickPlugin = {
  id: 'tick-counter',
  version: '1.0.0',
  init(builder) {
    builder.resources.insert(TickCounter, { ticks: 0 })

    builder.systems.add('Update', {
      id: 'tick-counter.update',
      stage: 'Update',
      order: 100,
      reads: [],
      writes: [],
      execute(ctx) {
        const state = ctx.world.resources.get<{ ticks: number }>({
          id: 'string:TickCounter',
          version: 1,
          dependencies: []
        })
        state.ticks += 1
      }
    })
  }
}

const app = new AppBuilder().use(TickPlugin).build()
app.run()
await app.step(1 / 60)
await app.shutdown()
```

Note: the example shows system registration shape; in real code prefer ECS token helpers for resource access consistency.

## Dependency-Ordered Plugins

```js
import { AppBuilder } from 'qti-clockwork-app'

const Core = {
  id: 'core',
  version: '1.0.0',
  init() {}
}

const Gameplay = {
  id: 'gameplay',
  version: '1.0.0',
  depends: ['core'],
  init() {}
}

new AppBuilder().use(Gameplay).use(Core).build()
```
