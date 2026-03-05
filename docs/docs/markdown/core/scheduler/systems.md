# Scheduler Systems

Systems run through `Scheduler.addSystem(stage, system, order?)`.

## System Contract

```js
const system = {
  id: 'example.system',
  stage: 'Update',
  order: 100,
  reads: [],
  writes: [],
  runIf(world) {
    return true
  },
  execute(ctx) {}
}
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.WorldApi;
import com.quietterminal.clockwork.scheduler.Stage;

ClockworkApp app = new ClockworkApp()
    .use(new ClockworkPlugin() {
        @Override public String name() { return "example.system"; }
        @Override public void register(ClockworkApp app, WorldApi world) {
            app.addSystem(Stage.UPDATE, ctx -> {
                System.out.println("tick=" + ctx.tick() + " dt=" + ctx.deltaTime());
            });
        }
    })
    .build();

app.step(1.0 / 60.0);
app.shutdown();
```

## Context

`execute(ctx)` receives:

- `world`
- `deltaTime`
- `commands`
- `events`
- `resources`

## Lifecycle Control

- `run()` starts stepping behavior
- `pause()`/`resume()` gate stepping
- `shutdown()` runs shutdown stage and stops scheduler

## Utility Types

- `Profiler` for runtime timings
- `SeededRng` for deterministic randomness
- `DeterminismValidator` for risk checks
