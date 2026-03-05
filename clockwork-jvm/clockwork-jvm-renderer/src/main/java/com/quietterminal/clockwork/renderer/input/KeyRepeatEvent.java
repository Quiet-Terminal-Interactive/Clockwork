package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a held key fires an OS repeat signal. */
public final class KeyRepeatEvent extends ClockworkEvent {
    private final Key key;

    public KeyRepeatEvent(Key key) {
        this.key = key;
    }

    public Key key() {
        return key;
    }
}
