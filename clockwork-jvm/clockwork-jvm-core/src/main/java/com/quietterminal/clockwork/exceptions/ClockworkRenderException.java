package com.quietterminal.clockwork.exceptions;

/** Renderer initialization or frame submission failure. */
public final class ClockworkRenderException extends ClockworkException {
    public ClockworkRenderException(String message) {
        super(message);
    }

    public ClockworkRenderException(String message, Throwable cause) {
        super(message, cause);
    }
}
