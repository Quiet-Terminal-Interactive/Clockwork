package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;

/** Structural body snapshot component. */
public record StructuralBodyComponent(
    int nodeCount,
    boolean fractured,
    Vec2 centreOfMass,
    Fixed mass,
    Fixed inertia
) {
}
