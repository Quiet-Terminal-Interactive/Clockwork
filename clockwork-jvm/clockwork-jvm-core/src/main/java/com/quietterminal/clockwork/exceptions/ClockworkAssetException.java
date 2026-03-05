package com.quietterminal.clockwork.exceptions;

/** Asset pipeline failure: manifest validation, decode, atlas upload, or ID collision. */
public class ClockworkAssetException extends ClockworkException {
    public ClockworkAssetException(String message) {
        super(message);
    }

    public ClockworkAssetException(String message, Throwable cause) {
        super(message, cause);
    }
}
