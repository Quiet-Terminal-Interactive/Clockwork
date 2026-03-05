package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted for each Unicode character typed. Does not fire for non-printable keys. */
public final class TextInputEvent extends ClockworkEvent {
    private final int codePoint;

    public TextInputEvent(int codePoint) {
        this.codePoint = codePoint;
    }

    /** Unicode code point of the typed character. */
    public int codePoint() {
        return codePoint;
    }

    /** Convenience: the typed character as a String. */
    public String character() {
        return new String(Character.toChars(codePoint));
    }
}
