package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.math.Fixed;

import java.util.Objects;

/** Physics plugin configuration. */
public record PhysicsConfig(Fixed gravity, int solverIterations) {
    public PhysicsConfig {
        Objects.requireNonNull(gravity, "gravity");
    }

    public static Builder builder() {
        return new Builder();
    }

    /** Fluent builder for physics config. */
    public static final class Builder {
        private Fixed gravity = Fixed.from(-9.8);
        private int solverIterations = 8;

        public Builder gravity(Fixed gravity) {
            this.gravity = Objects.requireNonNull(gravity, "gravity");
            return this;
        }

        public Builder solverIterations(int solverIterations) {
            this.solverIterations = solverIterations;
            return this;
        }

        public PhysicsConfig build() {
            return new PhysicsConfig(gravity, solverIterations);
        }
    }
}
