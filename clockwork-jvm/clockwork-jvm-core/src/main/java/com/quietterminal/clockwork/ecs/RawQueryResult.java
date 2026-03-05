package com.quietterminal.clockwork.ecs;

import java.util.Map;

/** Untyped query result with dynamic component payloads. */
public record RawQueryResult(long entity, Map<Class<?>, Object> components) {
}
