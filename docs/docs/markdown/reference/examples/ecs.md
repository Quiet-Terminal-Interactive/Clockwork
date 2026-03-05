# Runnable Examples: ECS

## Spawn, Component Add, Query

```js
import { World } from 'qti-clockwork-ecs'

const Position = Symbol('Position')

const world = new World()
const entity = world.spawn().build()
world.addComponent(entity, Position, { x: 10, y: 20 })

for (const result of world.query().with(Position).iter()) {
  const p = result.components.get(Position)
  console.log(result.entity.index, p.x, p.y)
}
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.QueryResult;

record Position(int x, int y) {}

ClockworkApp app = new ClockworkApp().build();
Commands commands = app.world().commands();
long entity = commands.spawn().with(new Position(10, 20)).id();
app.world().commit(commands);

for (QueryResult<Position, Void, Void, Void> row : app.world().query(Position.class)) {
    System.out.println(row.entity() + " " + row.a().x() + " " + row.a().y());
}
app.shutdown();
```

## Changed Query Pattern

```js
const q = world.query().with(Position).changed(Position)
console.log([...q.iter()].length) // first pass
console.log([...q.iter()].length) // 0 until changed again
world.addComponent(entity, Position, { x: 11, y: 20 })
console.log([...q.iter()].length) // 1
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.QueryResult;

record Position(int x, int y) {}

Commands c = app.world().commands();
long entity = c.spawn().with(new Position(10, 20)).id();
app.world().commit(c);

Position before = app.world().query(Position.class).iterator().next().a();
Commands update = app.world().commands();
update.addComponent(entity, new Position(11, 20));
app.world().commit(update);
Position after = app.world().query(Position.class).iterator().next().a();

System.out.println(before + " -> " + after);
```

## Deferred Commands

```js
const commands = world.commands()
commands.spawn().with(Position, { x: 0, y: 0 })
commands.flush()
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ecs.Commands;

record Position(int x, int y) {}

Commands commands = app.world().commands();
commands.spawn().with(new Position(0, 0));
app.world().commit(commands);
```

## Resources

```js
const rngToken = 'rng'
world.insertResource(rngToken, () => Math.random())
const rng = world.getResource(rngToken)
console.log(rng())
```

Clockwork JVM example:
```java
import java.util.Random;

app.world().resources().insert("rng", new Random());
Random rng = (Random) app.world().resources().get("rng").orElseThrow();
System.out.println(rng.nextDouble());
```
