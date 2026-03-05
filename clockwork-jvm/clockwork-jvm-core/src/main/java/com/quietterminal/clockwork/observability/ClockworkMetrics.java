package com.quietterminal.clockwork.observability;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Collects engine performance metrics and notifies registered listeners after each update.
 * All record* methods are safe to call from any thread.
 */
public final class ClockworkMetrics {

    private static final double EMA_ALPHA = 0.1;

    private volatile double avgTickMs;
    private volatile double peakTickMs;
    private volatile double avgFrameMs;
    private volatile double peakFrameMs;
    private volatile int queueSprites;
    private volatile int queueLights;
    private volatile int queueParticles;
    private volatile double avgNetworkLatencyMs;

    private final AtomicLong droppedPackets = new AtomicLong(0);
    private final AtomicLong totalTicks = new AtomicLong(0);
    private final AtomicLong totalFrames = new AtomicLong(0);

    private final List<MetricsListener> listeners = new CopyOnWriteArrayList<>();

    public void addListener(MetricsListener listener) {
        listeners.add(listener);
    }

    public void removeListener(MetricsListener listener) {
        listeners.remove(listener);
    }

    public void recordTickTime(long nanos) {
        double ms = nanos / 1_000_000.0;
        avgTickMs = ema(avgTickMs, ms);
        if (ms > peakTickMs) {
            peakTickMs = ms;
        }
        totalTicks.incrementAndGet();
        notifyListeners();
    }

    public void recordFrameTime(long nanos) {
        double ms = nanos / 1_000_000.0;
        avgFrameMs = ema(avgFrameMs, ms);
        if (ms > peakFrameMs) {
            peakFrameMs = ms;
        }
        totalFrames.incrementAndGet();
        notifyListeners();
    }

    public void recordQueueDepth(int sprites, int lights, int particles) {
        queueSprites = sprites;
        queueLights = lights;
        queueParticles = particles;
    }

    public void recordNetworkLatency(long millis) {
        avgNetworkLatencyMs = ema(avgNetworkLatencyMs, millis);
        notifyListeners();
    }

    public void recordDroppedPackets(int count) {
        droppedPackets.addAndGet(count);
        notifyListeners();
    }

    /** Returns a consistent snapshot. Individual fields are volatile so no lock needed. */
    public MetricsSnapshot snapshot() {
        return new MetricsSnapshot(
            avgTickMs, peakTickMs,
            avgFrameMs, peakFrameMs,
            queueSprites, queueLights, queueParticles,
            avgNetworkLatencyMs,
            droppedPackets.get(),
            totalTicks.get(),
            totalFrames.get()
        );
    }

    private void notifyListeners() {
        if (listeners.isEmpty()) {
            return;
        }
        MetricsSnapshot snap = snapshot();
        for (MetricsListener listener : listeners) {
            try {
                listener.onMetrics(snap);
            } catch (RuntimeException ignored) {
                // Listener exceptions must not disrupt the engine tick.
            }
        }
    }

    private static double ema(double current, double sample) {
        if (current == 0.0) {
            return sample;
        }
        return current + EMA_ALPHA * (sample - current);
    }
}
