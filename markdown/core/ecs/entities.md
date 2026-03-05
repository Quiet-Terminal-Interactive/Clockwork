# ECS Entities

Entities are represented as:

```js
const entityId = {
  index: 0,
  generation: 0
}
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ecs.Commands;

ClockworkApp app = new ClockworkApp().build();

Commands c1 = app.world().commands();
long first = c1.spawn().id();
app.world().commit(c1);

Commands c2 = app.world().commands();
c2.despawn(first);
app.world().commit(c2);

Commands c3 = app.world().commands();
long second = c3.spawn().id();
app.world().commit(c3);

System.out.println("first=" + first + ", second=" + second);
app.shutdown();
```

## Allocation Model

`EntityManager` uses:

- `generations[]`
- `alive[]`
- `freeIndices[]`

Destroyed indices are reused, generation increments on destroy.

## Safety Model

`isAlive(entity)` validates both index and generation.

Stale entity handles fail safely.

## Iteration

`iterAlive()` yields only living entity IDs.

## Notes

- `aliveCount` tracks current live entities.
- Reuse behavior is covered by tests for generation bump correctness.
