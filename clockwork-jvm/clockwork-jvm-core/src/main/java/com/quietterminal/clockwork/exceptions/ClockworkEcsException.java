package com.quietterminal.clockwork.exceptions;

/** ECS/query/command contract failure. */
public final class ClockworkEcsException extends ClockworkException {
    public ClockworkEcsException(String message) {
        super(message);
    }

    public ClockworkEcsException(String message, Throwable cause) {
        super(message, cause);
    }
}
