package com.quietterminal.clockwork;

import com.quietterminal.clockwork.exceptions.ClockworkLifecycleException;

/**
 * Threading model constants and enforcement for the Clockwork engine.
 *
 * Three threads own distinct subsystems:
 *   - Simulation thread: the thread that calls ClockworkApp.run() or step().
 *     Owns the GraalVM context, ECS world, all systems, and render queue writes.
 *   - Renderer thread ("clockwork-renderer"): daemon thread owned by RendererRuntime.
 *     Owns the GLFW window, OpenGL context, and all render pass execution.
 *   - Watchdog thread ("clockwork-watchdog"): daemon thread owned by EngineWatchdog.
 *     Read-only observer; never mutates engine state.
 *
 * The networking thread is internal to NeonPlugin and not represented here.
 */
public final class ThreadModel {

    public static final String RENDER_THREAD_NAME = "clockwork-renderer";
    public static final String WATCHDOG_THREAD_NAME = "clockwork-watchdog";

    private ThreadModel() {}

    public static void assertRenderThread() {
        if (!RENDER_THREAD_NAME.equals(Thread.currentThread().getName())) {
            throw new ClockworkLifecycleException(
                "Expected renderer thread [" + RENDER_THREAD_NAME + "] but called from ["
                    + Thread.currentThread().getName() + "]."
            );
        }
    }

    public static void assertNotRenderThread() {
        if (RENDER_THREAD_NAME.equals(Thread.currentThread().getName())) {
            throw new ClockworkLifecycleException(
                "Must not be called from the renderer thread."
            );
        }
    }

    public static void assertSimulationThread(Thread expected) {
        if (Thread.currentThread() != expected) {
            throw new ClockworkLifecycleException(
                "Expected simulation thread [" + expected.getName() + "] but called from ["
                    + Thread.currentThread().getName() + "]."
            );
        }
    }
}
