package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.math.Vec2;

/** Queued force applied on the next physics tick. */
public record PhysicsForceCommand(Vec2 force) {
}
