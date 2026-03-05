package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when the window gains or loses focus. */
public final class WindowFocusEvent extends ClockworkEvent {
    private final boolean focused;

    public WindowFocusEvent(boolean focused) {
        this.focused = focused;
    }

    public boolean focused() {
        return focused;
    }
}
