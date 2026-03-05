# Runnable Examples: Scheduler

## Ordered Systems

```js
import { Scheduler } from 'qti-clockwork-scheduler'

const calls = []
const mk = (id, order) => ({
  id,
  stage: 'Update',
  order,
  reads: [],
  writes: [],
  execute() {
    calls.push(id)
  }
})

const scheduler = new Scheduler()
scheduler.addSystem('Update', mk('A', 20))
scheduler.addSystem('Update', mk('B', 10))
scheduler.run()
await scheduler.step(1 / 60)
console.log(calls) // ['B', 'A']
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.WorldApi;
import com.quietterminal.clockwork.scheduler.Stage;
import java.util.ArrayList;
import java.util.List;

List<String> calls = new ArrayList<>();
ClockworkApp app = new ClockworkApp()
    .use(new ClockworkPlugin() {
        @Override public String name() { return "ordered"; }
        @Override public void register(ClockworkApp app, WorldApi world) {
            app.addSystem(Stage.UPDATE, ctx -> calls.add("A"));
            app.addSystem(Stage.UPDATE, ctx -> calls.add("B"));
        }
    })
    .build();

app.step(1.0 / 60.0);
System.out.println(calls); // [A, B]
app.shutdown();
```

## Fixed-Step Configuration

```js
const scheduler = new Scheduler({
  time: { fixedDelta: 1 / 120, maxCatchUpSteps: 8 }
})
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;

ClockworkApp app = new ClockworkApp().build();
app.step(1.0 / 120.0); // 120 Hz fixed-step style pacing from caller
app.shutdown();
```

## Determinism Report

```js
import { DeterminismValidator } from 'qti-clockwork-scheduler'

const report = new DeterminismValidator(scheduler).report()
console.log(report.score, report.violations)
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;

ClockworkApp app = new ClockworkApp().build();
app.step(1.0 / 60.0);
String report = app.diagnostics();
System.out.println(report);
app.shutdown();
```
