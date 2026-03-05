# ECS Resources

Resources are global typed runtime state managed by `ResourceMap`.

## ResourceType

```js
new ResourceType(id, { version, dependencies })
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;

record TimeState(double delta) {}

ClockworkApp app = new ClockworkApp().build();
app.world().resources().insert(TimeState.class, new TimeState(1.0 / 60.0));
app.world().resources().insert("rng.seed", 1234);

TimeState t = app.world().resources().get(TimeState.class).orElseThrow();
int seed = (int) app.world().resources().get("rng.seed").orElseThrow();
System.out.println(t.delta() + " / " + seed);

app.shutdown();
```

Features:

- version metadata
- dependency requirements on other resource types

## ResourceMap API

- `insert(type, value)`
- `get(type)`
- `tryGet(type)`
- `remove(type)`
- `has(type)`
- `getInstalledVersion(type)`
- `getRevision(type)`

## Dependency Enforcement

Insert validates required dependencies and minimum dependency versions.

## Token Conversion

`World.insertResource/getResource` accept tokens (`string`, `symbol`, ctor) and convert via `ResourceType.fromToken`.

## Builtin Resource Types

`BuiltinResourceTypes` includes:

- `Time`
- `Input`
- `Assets`
- `Renderer`
- `AudioContext`
- `Rng`
- `Config`
- `Profiler`
