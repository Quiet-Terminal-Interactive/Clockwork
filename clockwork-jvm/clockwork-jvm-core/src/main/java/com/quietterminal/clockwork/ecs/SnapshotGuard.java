package com.quietterminal.clockwork.ecs;

import com.quietterminal.clockwork.exceptions.ClockworkEcsException;

/** Enforces immutable query snapshots. */
final class SnapshotGuard {
    private SnapshotGuard() {
    }

    static Object enforceImmutable(Object value, Class<?> type) {
        if (value == null) {
            return null;
        }
        Class<?> actualType = value.getClass();
        if (isImmutable(actualType)) {
            return value;
        }
        throw new ClockworkEcsException(
            "Component snapshot for " + type.getName()
                + " is mutable (" + actualType.getName() + "). "
                + "Use immutable value types (records/enums/boxed primitives/String)."
        );
    }

    private static boolean isImmutable(Class<?> type) {
        return type.isPrimitive()
            || type.isRecord()
            || type.isEnum()
            || Number.class.isAssignableFrom(type)
            || type == String.class
            || type == Boolean.class
            || type == Character.class;
    }
}
