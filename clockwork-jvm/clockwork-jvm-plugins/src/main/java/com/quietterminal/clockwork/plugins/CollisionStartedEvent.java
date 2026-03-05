package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.ClockworkEvent;
import com.quietterminal.clockwork.math.Vec2;

/** Event emitted when collision begins. */
public final class CollisionStartedEvent extends ClockworkEvent {
    private final long entityA;
    private final long entityB;
    private final Vec2 point;
    private final Vec2 normal;

    public CollisionStartedEvent(long entityA, long entityB, Vec2 point, Vec2 normal) {
        this.entityA = entityA;
        this.entityB = entityB;
        this.point = point;
        this.normal = normal;
    }

    public long entityA() {
        return entityA;
    }

    public long entityB() {
        return entityB;
    }

    public Vec2 point() {
        return point;
    }

    public Vec2 normal() {
        return normal;
    }
}
