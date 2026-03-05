package com.quietterminal.clockwork.observability;

/** Immutable snapshot of all engine metrics at a point in time. All times are in milliseconds. */
public record MetricsSnapshot(
    double avgTickMs,
    double peakTickMs,
    double avgFrameMs,
    double peakFrameMs,
    int queueSprites,
    int queueLights,
    int queueParticles,
    double avgNetworkLatencyMs,
    long droppedPackets,
    long totalTicks,
    long totalFrames
) {
    public static MetricsSnapshot empty() {
        return new MetricsSnapshot(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    }
}
