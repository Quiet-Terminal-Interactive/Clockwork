package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a key is pressed. */
public final class KeyPressedEvent extends ClockworkEvent {
    private final Key key;

    public KeyPressedEvent(Key key) {
        this.key = key;
    }

    public Key key() {
        return key;
    }
}
