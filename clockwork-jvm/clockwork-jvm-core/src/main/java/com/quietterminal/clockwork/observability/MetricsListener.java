package com.quietterminal.clockwork.observability;

/** Receives a metrics snapshot after each recording update. */
@FunctionalInterface
public interface MetricsListener {
    void onMetrics(MetricsSnapshot snapshot);
}
