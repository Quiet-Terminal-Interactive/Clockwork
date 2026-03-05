# ECS Command Buffer

`CommandBuffer` batches world mutations for deferred application.

## Buffered Operations

- spawn entity (with initial components)
- destroy entity
- add component
- remove component

## Usage

```js
const commands = world.commands()
commands.spawn().with(Position, { x: 1, y: 2 })
commands.flush()
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ecs.Commands;

record Position(int x, int y) {}

ClockworkApp app = new ClockworkApp().build();
Commands commands = app.world().commands();
long e = commands.spawn().with(new Position(1, 2)).id();
app.world().commit(commands);

Commands destroy = app.world().commands();
destroy.despawn(e);
app.world().commit(destroy);

app.shutdown();
```

## Deferred Entity Resolution

Spawn operations create deferred entities that resolve to real `EntityId` during `flush()`.

## Why Use It

- avoids mutable-iteration hazards during system execution
- centralizes write timing
- aligns with stage-level flush in scheduler
