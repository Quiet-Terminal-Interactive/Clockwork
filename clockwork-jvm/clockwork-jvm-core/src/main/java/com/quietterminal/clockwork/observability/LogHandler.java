package com.quietterminal.clockwork.observability;

/** Receives structured log events from {@link ClockworkLogger}. */
@FunctionalInterface
public interface LogHandler {
    void handle(LogLevel level, String subsystem, String message);
}
