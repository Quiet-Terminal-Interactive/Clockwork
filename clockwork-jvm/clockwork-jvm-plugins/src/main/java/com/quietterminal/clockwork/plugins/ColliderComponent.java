package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;

/** Collider snapshot component. */
public record ColliderComponent(
    String shapeType,
    Fixed radius,
    Vec2 halfExtents,
    Vec2 offset,
    Fixed angle,
    int collisionMask
) {
    public static ColliderComponent circle(Fixed radius, int collisionMask) {
        return new ColliderComponent(
            "circle",
            radius,
            null,
            new Vec2(Fixed.ZERO, Fixed.ZERO),
            Fixed.ZERO,
            collisionMask
        );
    }
}
