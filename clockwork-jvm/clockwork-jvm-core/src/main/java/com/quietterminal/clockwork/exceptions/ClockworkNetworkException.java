package com.quietterminal.clockwork.exceptions;

/** Networking plugin or transport failure. */
public final class ClockworkNetworkException extends ClockworkException {
    public ClockworkNetworkException(String message) {
        super(message);
    }

    public ClockworkNetworkException(String message, Throwable cause) {
        super(message, cause);
    }
}
