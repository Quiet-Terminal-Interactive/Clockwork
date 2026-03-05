package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a key is released. */
public final class KeyReleasedEvent extends ClockworkEvent {
    private final Key key;

    public KeyReleasedEvent(Key key) {
        this.key = key;
    }

    public Key key() {
        return key;
    }
}
