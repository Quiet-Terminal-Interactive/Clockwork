package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when mouse moves. */
public final class MouseMovedEvent extends ClockworkEvent {
    private final double x;
    private final double y;

    public MouseMovedEvent(double x, double y) {
        this.x = x;
        this.y = y;
    }

    public double x() {
        return x;
    }

    public double y() {
        return y;
    }
}
