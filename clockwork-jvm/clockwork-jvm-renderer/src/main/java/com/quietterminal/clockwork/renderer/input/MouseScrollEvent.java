package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted on scroll wheel or trackpad scroll gesture. */
public final class MouseScrollEvent extends ClockworkEvent {
    private final double xOffset;
    private final double yOffset;

    public MouseScrollEvent(double xOffset, double yOffset) {
        this.xOffset = xOffset;
        this.yOffset = yOffset;
    }

    public double xOffset() {
        return xOffset;
    }

    public double yOffset() {
        return yOffset;
    }
}
