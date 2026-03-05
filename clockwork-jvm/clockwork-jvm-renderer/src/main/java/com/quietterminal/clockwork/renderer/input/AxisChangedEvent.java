package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a named input axis changes value. */
public final class AxisChangedEvent extends ClockworkEvent {
    private final String axis;
    private final double value;

    public AxisChangedEvent(String axis, double value) {
        this.axis = axis;
        this.value = value;
    }

    public String axis() {
        return axis;
    }

    /** Value in [-1.0, 1.0]. */
    public double value() {
        return value;
    }
}
