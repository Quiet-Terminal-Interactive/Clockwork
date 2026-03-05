package com.quietterminal.clockwork.renderer.input;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;

/**
 * Thread-safe FIFO queue that collects raw GLFW input events on the renderer thread
 * and drains them in deterministic order at the start of each game tick.
 *
 * Events within a single drain are ordered by the sequence GLFW delivered them.
 * This guarantees that press/release ordering is preserved across frame boundaries.
 */
public final class InputBuffer {
    public static final String KEY = "input.buffer";

    private final ConcurrentLinkedQueue<Object> queue = new ConcurrentLinkedQueue<>();

    /** Called from the renderer thread inside GLFW callbacks. */
    public void enqueue(Object event) {
        queue.add(event);
    }

    /** Drains all buffered events in FIFO order and clears the queue. */
    public List<Object> drain() {
        List<Object> events = new ArrayList<>(queue.size());
        Object event;
        while ((event = queue.poll()) != null) {
            events.add(event);
        }
        return events;
    }
}
