package com.quietterminal.clockwork.events;

import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Resource registry keyed by class or string. */
public final class ResourceStore {
    private final Map<Object, Object> values = new ConcurrentHashMap<>();

    public <T> void insert(Class<T> key, T value) {
        values.put(Objects.requireNonNull(key, "key"), Objects.requireNonNull(value, "value"));
    }

    public void insert(String key, Object value) {
        values.put(Objects.requireNonNull(key, "key"), Objects.requireNonNull(value, "value"));
    }

    public <T> Optional<T> get(Class<T> key) {
        Objects.requireNonNull(key, "key");
        Object value = values.get(key);
        if (value == null) {
            return Optional.empty();
        }
        return Optional.of(key.cast(value));
    }

    public Optional<Object> get(String key) {
        Objects.requireNonNull(key, "key");
        return Optional.ofNullable(values.get(key));
    }
}
