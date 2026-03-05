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

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.WorldApi;

ClockworkPlugin examplePlugin = new ClockworkPlugin() {
    @Override public String name() { return "example"; }
    @Override public void register(ClockworkApp app, WorldApi world) {
        world.resources().insert("example-config", true);
    }
    @Override public void shutdown(ClockworkApp app, WorldApi world) {
        // cleanup
    }
};
```

## 2. Register and Build

```js
const app = new AppBuilder().use(ExamplePlugin).build()
```

Clockwork JVM example:
```java
ClockworkApp app = new ClockworkApp().use(examplePlugin).build();
```

## 3. Run and Step

```js
app.run()
await app.step(1 / 60)
await app.shutdown()
```

Clockwork JVM example:
```java
app.step(1.0 / 60.0);
app.shutdown();
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

Clockwork JVM example:
```java
import com.quietterminal.clockwork.scheduler.Stage;

app.addSystem(Stage.UPDATE, ctx -> {
    // update logic
});
```

## 5. Validate

Run:

```bash
npm test
npm run typecheck
```
