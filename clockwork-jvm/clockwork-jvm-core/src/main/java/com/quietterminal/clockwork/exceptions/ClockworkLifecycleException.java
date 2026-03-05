package com.quietterminal.clockwork.exceptions;

/** Plugin/app lifecycle failure such as dependency cycles or invalid ordering. */
public final class ClockworkLifecycleException extends ClockworkException {
    public ClockworkLifecycleException(String message) {
        super(message);
    }

    public ClockworkLifecycleException(String message, Throwable cause) {
        super(message, cause);
    }
}
