package com.quietterminal.clockwork.math;

import java.util.Objects;

/** Fixed-point 2D vector. */
public record Vec2(Fixed x, Fixed y) {
    public Vec2 {
        Objects.requireNonNull(x, "x");
        Objects.requireNonNull(y, "y");
    }

    public static Vec2 create(Fixed x, Fixed y) {
        return new Vec2(x, y);
    }

    public static Vec2 add(Vec2 a, Vec2 b) {
        return new Vec2(Fixed.add(a.x, b.x), Fixed.add(a.y, b.y));
    }

    public static Vec2 sub(Vec2 a, Vec2 b) {
        return new Vec2(Fixed.sub(a.x, b.x), Fixed.sub(a.y, b.y));
    }

    public static Vec2 scale(Vec2 value, Fixed scalar) {
        return new Vec2(Fixed.mul(value.x, scalar), Fixed.mul(value.y, scalar));
    }

    public static Fixed dot(Vec2 a, Vec2 b) {
        return Fixed.add(Fixed.mul(a.x, b.x), Fixed.mul(a.y, b.y));
    }

    public static Fixed cross(Vec2 a, Vec2 b) {
        return Fixed.sub(Fixed.mul(a.x, b.y), Fixed.mul(a.y, b.x));
    }

    public static Fixed lenSq(Vec2 value) {
        return dot(value, value);
    }

    public static Fixed len(Vec2 value) {
        return Fixed.sqrt(lenSq(value));
    }

    public static Vec2 norm(Vec2 value) {
        Fixed length = len(value);
        if (length.raw() == 0) {
            // No direction to normalize here. Returning zero keeps NaN out of gameplay math.
            return new Vec2(Fixed.ZERO, Fixed.ZERO);
        }

        return new Vec2(Fixed.div(value.x, length), Fixed.div(value.y, length));
    }

    public static Vec2 perp(Vec2 value) {
        return new Vec2(Fixed.neg(value.y), value.x);
    }

    public static Vec2 lerp(Vec2 a, Vec2 b, Fixed t) {
        return new Vec2(Fixed.lerp(a.x, b.x, t), Fixed.lerp(a.y, b.y, t));
    }

    public static Vec2 rotate(Vec2 value, Fixed radians) {
        Fixed cos = Fixed.cos(radians);
        Fixed sin = Fixed.sin(radians);
        return new Vec2(
            Fixed.sub(Fixed.mul(cos, value.x), Fixed.mul(sin, value.y)),
            Fixed.add(Fixed.mul(sin, value.x), Fixed.mul(cos, value.y))
        );
    }
}
