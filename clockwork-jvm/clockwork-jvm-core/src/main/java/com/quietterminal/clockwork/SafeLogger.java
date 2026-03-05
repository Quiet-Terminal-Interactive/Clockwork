package com.quietterminal.clockwork;

import com.quietterminal.clockwork.observability.ClockworkLogger;

import java.util.Objects;

/** Crash-safe structured logger. Delegates to {@link ClockworkLogger} for consistent formatting and token scrubbing. */
public final class SafeLogger {

    private final ClockworkLogger delegate;

    public SafeLogger(String subsystem) {
        this.delegate = new ClockworkLogger(Objects.requireNonNull(subsystem, "subsystem"));
    }

    public void warn(String msg)  { delegate.warn(msg); }
    public void error(String msg) { delegate.error(msg); }
    public void fatal(String msg) { delegate.fatal(msg); }

    /** Redacts token-shaped substrings from a log message. */
    public static String scrub(String msg) {
        return ClockworkLogger.scrub(msg);
    }
}
