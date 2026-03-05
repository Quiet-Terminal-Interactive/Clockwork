# World Serializer

`qti-clockwork-serialization` provides versioned world snapshot serialization.

## Serializer

`WorldSerializer` implements:

- `serialize(world): Uint8Array`
- `deserialize(bytes): World`

Snapshot format is JSON bytes with top-level:

- `version`
- `entities[]`

## Component Schemas

Register component behavior with:

```js
register(type, {
  version,
  typeId?,
  serialize,
  deserialize,
  migrate?
})
```

Clockwork JVM example:
```java
import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.WorldApi;

ClockworkApp app = new ClockworkApp().build();
WorldApi world = app.world();

Object snapshot = world.serialize();
world.restore(snapshot);

app.shutdown();
```

## Version Migration

During deserialize:

- if stored component version != current schema version
- `migrate(from, to, data)` is required
- missing migration throws

## Type IDs and Collisions

Default type IDs derive from token.

Potential symbol-description collisions can occur. Use explicit `typeId` for stability.

## Validation

Deserializer validates snapshot shape and component metadata, and throws descriptive errors for malformed payloads.
