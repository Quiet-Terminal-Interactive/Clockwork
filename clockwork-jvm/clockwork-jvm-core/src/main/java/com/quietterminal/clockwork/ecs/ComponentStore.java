package com.quietterminal.clockwork.ecs;

import java.util.Map;
import java.util.Optional;

/** Typed component access facade. */
public final class ComponentStore {
    private final Map<Long, Map<Class<?>, Object>> entities;

    public ComponentStore(Map<Long, Map<Class<?>, Object>> entities) {
        this.entities = entities;
    }

    public <T> Optional<T> get(long entity, Class<T> type) {
        Map<Class<?>, Object> components = entities.get(entity);
        if (components == null) {
            return Optional.empty();
        }
        Object value = components.get(type);
        if (value == null) {
            return Optional.empty();
        }
        return Optional.of(type.cast(value));
    }
}
