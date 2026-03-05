package com.quietterminal.clockwork;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

/** Monitors simulation tick timing and logs stalls before they become silent deadlocks. */
public final class EngineWatchdog implements AutoCloseable {

    private static final long WARN_THRESHOLD_MS =
        Long.getLong("clockwork.watchdog.warnMs", 500L);
    private static final long FATAL_THRESHOLD_MS =
        Long.getLong("clockwork.watchdog.fatalMs", 5_000L);
    private static final long POLL_MS = 100L;

    private final ScheduledExecutorService scheduler;

    private final AtomicLong tickStartNanos = new AtomicLong(0L);
    private volatile long currentTick;

    // Guards against spamming the same warning every 100ms for one stall. It keeps happening. It's fucking annoying.
    private volatile boolean warnedThisTick;

    private static final SafeLogger LOG = new SafeLogger("Watchdog");

    public EngineWatchdog() {
        scheduler = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, ThreadModel.WATCHDOG_THREAD_NAME);
            t.setDaemon(true);
            return t;
        });
        scheduler.scheduleAtFixedRate(this::poll, POLL_MS, POLL_MS, TimeUnit.MILLISECONDS);
    }

    /** Called by the simulation thread immediately before a tick begins. */
    public void tickStarted(long tick) {
        currentTick = tick;
        warnedThisTick = false;
        tickStartNanos.set(System.nanoTime());
    }

    /** Called by the simulation thread immediately after a tick completes. */
    public void tickCompleted() {
        tickStartNanos.set(0L);
    }

    private void poll() {
        long startNanos = tickStartNanos.get();
        if (startNanos == 0L) {
            return;
        }

        long elapsedMs = (System.nanoTime() - startNanos) / 1_000_000L;

        if (elapsedMs >= FATAL_THRESHOLD_MS) {
            // Print every poll cycle at fatal level — it's probably a deadlock and we want noise.
            LOG.fatal("tick " + currentTick + " stalled for " + elapsedMs + "ms (limit "
                    + FATAL_THRESHOLD_MS + "ms). Game loop may be deadlocked.");
        } else if (elapsedMs >= WARN_THRESHOLD_MS && !warnedThisTick) {
            warnedThisTick = true;
            LOG.warn("tick " + currentTick + " stalled for " + elapsedMs + "ms (threshold "
                    + WARN_THRESHOLD_MS + "ms).");
        }
    }

    @Override
    public void close() {
        scheduler.shutdownNow();
    }
}
