# Runnable Examples: Runtime Composition

## Minimal Headless Loop

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

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.WorldApi;
import com.quietterminal.clockwork.scheduler.Stage;

ClockworkApp app = new ClockworkApp()
    .use(new ClockworkPlugin() {
        @Override public String name() { return "tick-counter"; }
        @Override public void register(ClockworkApp app, WorldApi world) {
            world.resources().insert("ticks", 0);
            app.addSystem(Stage.UPDATE, ctx -> {
                int ticks = (int) ctx.resources().get("ticks").orElse(0);
                ctx.resources().insert("ticks", ticks + 1);
            });
        }
    })
    .build();

app.step(1.0 / 60.0);
app.shutdown();
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

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;

ClockworkPlugin core = new ClockworkPlugin() {
    @Override public String name() { return "core"; }
    @Override public void register(ClockworkApp app, com.quietterminal.clockwork.WorldApi world) {}
};

ClockworkPlugin gameplay = new ClockworkPlugin() {
    @Override public String name() { return "gameplay"; }
    @Override public String[] depends() { return new String[] { "core" }; }
    @Override public void register(ClockworkApp app, com.quietterminal.clockwork.WorldApi world) {}
};

new ClockworkApp().use(gameplay).use(core).build().shutdown();
```
