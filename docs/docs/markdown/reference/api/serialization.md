# API Reference: qti-clockwork-serialization

## WorldSerializer

| Method | Signature | Notes |
|---|---|---|
| `register` | `(type, schema) => void` | Schema version must be integer >= 1; id collisions throw. |
| `serialize` | `(world) => Uint8Array` | Encodes world snapshot JSON bytes. |
| `deserialize` | `(data) => World` | Validates payload, resolves schemas, applies migrations if needed. |

## ComponentSerializationSchema<T>

| Field | Notes |
|---|---|
| `version` | Required schema version. |
| `typeId` | Optional explicit component id for stability/collision avoidance. |
| `serialize` | Component -> snapshot payload. |
| `deserialize` | Snapshot payload -> component. |
| `migrate` | Required when reading older/newer versions mismatch. |

## Gotchas

- Missing migration function on version mismatch throws.
- Plain-symbol-derived auto ids can collide; use explicit `typeId` for long-term safety.
- Unknown component types in snapshot are skipped when type mapping is absent.
