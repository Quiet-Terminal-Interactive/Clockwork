package com.quietterminal.clockwork.ecs;

import java.util.List;

/** Internal backend for ECS world operations. */
public interface WorldBackend {
    long reserveEntityId();

    void applyBatch(List<Commands.CommandOperation> operations);

    List<QuerySnapshot> query(List<Class<?>> required, List<Class<?>> optional, List<Class<?>> without);

    default Object snapshot() {
        throw new UnsupportedOperationException("World serialization is not supported by this backend.");
    }

    default void restore(Object snapshot) {
        throw new UnsupportedOperationException("World restore is not supported by this backend.");
    }
}
