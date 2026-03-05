package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;

/** Rigid body snapshot component. */
public record RigidBodyComponent(
    Vec2 position,
    Vec2 velocity,
    Fixed angle,
    Fixed angularVelocity,
    Fixed mass,
    Fixed invMass,
    Fixed inertia,
    Fixed invInertia,
    Fixed restitution,
    Fixed friction,
    Fixed linearDamping,
    Fixed angularDamping,
    boolean isStatic,
    boolean isSleeping,
    int sleepTimer
) {
    public static RigidBodyComponent dynamic(Vec2 position) {
        Fixed one = Fixed.ofRaw(Fixed.ONE);
        return new RigidBodyComponent(
            position,
            new Vec2(Fixed.ZERO, Fixed.ZERO),
            Fixed.ZERO,
            Fixed.ZERO,
            one,
            one,
            one,
            one,
            Fixed.from(0.3),
            Fixed.from(0.5),
            Fixed.from(0.01),
            Fixed.from(0.01),
            false,
            false,
            0
        );
    }
}
