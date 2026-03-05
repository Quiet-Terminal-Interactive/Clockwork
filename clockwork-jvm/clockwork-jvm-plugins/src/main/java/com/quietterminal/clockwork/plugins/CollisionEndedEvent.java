package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when collision ends. */
public final class CollisionEndedEvent extends ClockworkEvent {
    private final long entityA;
    private final long entityB;

    public CollisionEndedEvent(long entityA, long entityB) {
        this.entityA = entityA;
        this.entityB = entityB;
    }

    public long entityA() {
        return entityA;
    }

    public long entityB() {
        return entityB;
    }
}
