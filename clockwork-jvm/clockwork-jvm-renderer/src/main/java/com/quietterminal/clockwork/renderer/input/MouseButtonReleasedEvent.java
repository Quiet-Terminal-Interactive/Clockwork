package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a mouse button is released. */
public final class MouseButtonReleasedEvent extends ClockworkEvent {
    private final MouseButton button;
    private final double x;
    private final double y;

    public MouseButtonReleasedEvent(MouseButton button, double x, double y) {
        this.button = button;
        this.x = x;
        this.y = y;
    }

    public MouseButton button() {
        return button;
    }

    public double x() {
        return x;
    }

    public double y() {
        return y;
    }
}
