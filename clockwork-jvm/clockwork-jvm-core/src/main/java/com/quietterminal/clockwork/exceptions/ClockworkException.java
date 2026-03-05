package com.quietterminal.clockwork.exceptions;

/** Base runtime exception for ClockworkJVM errors. */
public class ClockworkException extends RuntimeException {
    public ClockworkException(String message) {
        super(message);
    }

    public ClockworkException(String message, Throwable cause) {
        super(message, cause);
    }
}
