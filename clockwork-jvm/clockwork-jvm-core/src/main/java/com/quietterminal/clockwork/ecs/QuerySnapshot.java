package com.quietterminal.clockwork.ecs;

import java.util.Map;

/** Snapshot row returned by the world backend. */
public record QuerySnapshot(long entity, Map<Class<?>, Object> components) {
}
