# qti-clockwork-math

`qti-clockwork-math` provides deterministic fixed-point math primitives used across Clockwork systems.

It includes:

- `Fixed` (Q16.16 scalar math)
- `Vec2` (fixed-point 2D vector helpers)
- `AABB` (axis-aligned bounding box helpers)

Clockwork JVM includes matching fixed-point math types in `clockwork-jvm-core` under `com.quietterminal.clockwork.math`.

---

## Install

JavaScript/TypeScript:

```bash
npm i qti-clockwork-math
```

Maven (Clockwork JVM — math is included in `clockwork-jvm-core`):

```xml
<dependency>
  <groupId>com.quietterminal</groupId>
  <artifactId>clockwork-jvm-core</artifactId>
  <version>1.0.0</version>
</dependency>
```

Gradle:

```gradle
dependencies {
    implementation("com.quietterminal:clockwork-jvm-core:1.0.0")
}
```

---

## `Fixed` Basics

TypeScript:

```ts
import { Fixed } from 'qti-clockwork-math'

const speed = Fixed.from(3.5)
const dt = Fixed.from(1 / 60)
const distance = Fixed.mul(speed, dt)

console.log(Fixed.to(distance))
```

JavaScript:

```js
import { Fixed } from 'qti-clockwork-math'

const speed = Fixed.from(3.5)
const dt = Fixed.from(1 / 60)
const distance = Fixed.mul(speed, dt)

console.log(Fixed.to(distance))
```

Clockwork JVM example:

```java
import com.quietterminal.clockwork.math.Fixed;

Fixed speed = Fixed.from(3.5);
Fixed dt = Fixed.from(1.0 / 60.0);
Fixed distance = Fixed.mul(speed, dt);

System.out.println(Fixed.to(distance));
```

---

## `Vec2` Basics

TypeScript:

```ts
import { Fixed, Vec2, FIXED_HALF_PI } from 'qti-clockwork-math'

const velocity = Vec2.create(Fixed.from(10), Fixed.from(0))
const rotated = Vec2.rotate(velocity, FIXED_HALF_PI)
const unit = Vec2.norm(rotated)

console.log(Fixed.to(unit.x), Fixed.to(unit.y))
```

JavaScript:

```js
import { Fixed, Vec2, FIXED_HALF_PI } from 'qti-clockwork-math'

const velocity = Vec2.create(Fixed.from(10), Fixed.from(0))
const rotated = Vec2.rotate(velocity, FIXED_HALF_PI)
const unit = Vec2.norm(rotated)

console.log(Fixed.to(unit.x), Fixed.to(unit.y))
```

Clockwork JVM example:

```java
import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;

Vec2 velocity = Vec2.create(Fixed.from(10.0), Fixed.ZERO);
Vec2 rotated = Vec2.rotate(velocity, Fixed.FIXED_HALF_PI);
Vec2 unit = Vec2.norm(rotated);

System.out.println(Fixed.to(unit.x()) + ", " + Fixed.to(unit.y()));
```

---

## `AABB` Helpers

TypeScript:

```ts
import { AABB, Fixed, Vec2 } from 'qti-clockwork-math'

const player = AABB.create(
  Vec2.create(Fixed.from(0), Fixed.from(0)),
  Vec2.create(Fixed.from(1), Fixed.from(1))
)

const wall = AABB.create(
  Vec2.create(Fixed.from(0.5), Fixed.from(0.5)),
  Vec2.create(Fixed.from(2), Fixed.from(2))
)

console.log(AABB.overlaps(player, wall))
```

JavaScript:

```js
import { AABB, Fixed, Vec2 } from 'qti-clockwork-math'

const player = AABB.create(
  Vec2.create(Fixed.from(0), Fixed.from(0)),
  Vec2.create(Fixed.from(1), Fixed.from(1))
)

const wall = AABB.create(
  Vec2.create(Fixed.from(0.5), Fixed.from(0.5)),
  Vec2.create(Fixed.from(2), Fixed.from(2))
)

console.log(AABB.overlaps(player, wall))
```

Clockwork JVM equivalent:

```java
import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;

record Box(Vec2 min, Vec2 max) {}

boolean overlaps(Box a, Box b) {
    return a.min().x().compareTo(b.max().x()) <= 0 &&
           a.max().x().compareTo(b.min().x()) >= 0 &&
           a.min().y().compareTo(b.max().y()) <= 0 &&
           a.max().y().compareTo(b.min().y()) >= 0;
}
```

---

## Notes

- Use `Fixed.from(...)` / `Fixed.to(...)` when crossing float/fixed boundaries.
- Prefer `Vec2` operations over manual `x/y` math when possible.
- `AABB` is currently provided in `qti-clockwork-math`; Clockwork JVM currently exposes `Fixed` and `Vec2` and can compose box helpers directly.
