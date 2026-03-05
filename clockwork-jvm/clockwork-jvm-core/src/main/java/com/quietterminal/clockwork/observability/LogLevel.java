package com.quietterminal.clockwork.observability;

/** Logging severity levels, ordered from least to most severe. */
public enum LogLevel {
    DEBUG(0), INFO(1), WARN(2), ERROR(3), FATAL(4);

    private final int ordinalValue;

    LogLevel(int ordinalValue) {
        this.ordinalValue = ordinalValue;
    }

    public boolean isAtLeast(LogLevel other) {
        return this.ordinalValue >= other.ordinalValue;
    }
}
