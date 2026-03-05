package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a named input action binding is triggered. */
public final class ActionFiredEvent extends ClockworkEvent {
    private final String action;

    public ActionFiredEvent(String action) {
        this.action = action;
    }

    public String action() {
        return action;
    }
}
