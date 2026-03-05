package com.quietterminal.clockwork.observability;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Optional tracer for polyglot bridge operations.
 * Stores the last N entries in a ring buffer; enable/disable at runtime with no allocation cost when off.
 */
public final class BridgeTracer {

    private static final int BUFFER_CAPACITY = 256;

    private final AtomicBoolean enabled = new AtomicBoolean(false);

    private final BridgeTraceEntry[] buffer = new BridgeTraceEntry[BUFFER_CAPACITY];
    private int head = 0;
    private int size = 0;

    public void enable()  { enabled.set(true);  }
    public void disable() { enabled.set(false); }
    public boolean isEnabled() { return enabled.get(); }

    /**
     * Times the given operation and records a trace entry if tracing is enabled.
     * Returns the result of the supplier unchanged.
     */
    public void trace(String operation, Runnable work) {
        if (!enabled.get()) {
            work.run();
            return;
        }
        long start = System.nanoTime();
        work.run();
        record(operation, System.nanoTime() - start);
    }

    /**
     * Times the given operation and returns its result.
     */
    public <T> T traceGet(String operation, java.util.function.Supplier<T> work) {
        if (!enabled.get()) {
            return work.get();
        }
        long start = System.nanoTime();
        T result = work.get();
        record(operation, System.nanoTime() - start);
        return result;
    }

    /** Returns a snapshot of the ring buffer, oldest entry first. */
    public List<BridgeTraceEntry> entries() {
        List<BridgeTraceEntry> result = new ArrayList<>(size);
        int start = size < BUFFER_CAPACITY ? 0 : head;
        for (int i = 0; i < size; i++) {
            result.add(buffer[(start + i) % BUFFER_CAPACITY]);
        }
        return result;
    }

    public void clear() {
        head = 0;
        size = 0;
    }

    private void record(String operation, long durationNanos) {
        buffer[head] = new BridgeTraceEntry(operation, durationNanos, System.currentTimeMillis());
        head = (head + 1) % BUFFER_CAPACITY;
        if (size < BUFFER_CAPACITY) {
            size++;
        }
    }
}
