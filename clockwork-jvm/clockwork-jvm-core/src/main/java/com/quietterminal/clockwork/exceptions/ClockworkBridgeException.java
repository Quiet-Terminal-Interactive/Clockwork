package com.quietterminal.clockwork.exceptions;

/** Bridge initialization or polyglot boundary failure. */
public final class ClockworkBridgeException extends ClockworkException {
    public ClockworkBridgeException(String message) {
        super(message);
    }

    public ClockworkBridgeException(String message, Throwable cause) {
        super(message, cause);
    }
}
