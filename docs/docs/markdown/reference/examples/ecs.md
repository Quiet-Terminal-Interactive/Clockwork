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

## Changed Query Pattern

```js
const q = world.query().with(Position).changed(Position)
console.log([...q.iter()].length) // first pass
console.log([...q.iter()].length) // 0 until changed again
world.addComponent(entity, Position, { x: 11, y: 20 })
console.log([...q.iter()].length) // 1
```

## Deferred Commands

```js
const commands = world.commands()
commands.spawn().with(Position, { x: 0, y: 0 })
commands.flush()
```

## Resources

```js
const rngToken = 'rng'
world.insertResource(rngToken, () => Math.random())
const rng = world.getResource(rngToken)
console.log(rng())
```
