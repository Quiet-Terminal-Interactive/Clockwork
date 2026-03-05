package com.quietterminal.clockwork.observability;

/** A single timed entry from the polyglot bridge trace ring buffer. */
public record BridgeTraceEntry(
    String operation,
    long durationNanos,
    long wallClockMs
) {}
