package com.quietterminal.clockwork.bridge;

import org.graalvm.polyglot.Value;

import java.util.Objects;

/** Typed helper around a GraalVM Value. */
public record PolyglotValue(Value value) {
    public PolyglotValue {
        Objects.requireNonNull(value, "value");
    }

    public boolean isNull() {
        return value.isNull();
    }

    public String asString() {
        return value.asString();
    }

    public int asInt() {
        return value.asInt();
    }

    public double asDouble() {
        return value.asDouble();
    }

    public boolean asBoolean() {
        return value.asBoolean();
    }

    public <T> T as(Class<T> type) {
        return value.as(type);
    }
}
