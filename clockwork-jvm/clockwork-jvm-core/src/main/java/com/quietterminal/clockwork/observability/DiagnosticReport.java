package com.quietterminal.clockwork.observability;

import java.time.Instant;
import java.util.List;

/**
 * Generates a human-readable diagnostic dump suitable for bug reports.
 * Scrubs tokens before writing any user-supplied strings.
 */
public final class DiagnosticReport {

    private DiagnosticReport() {}

    /**
     * Builds a diagnostic report from the provided context.
     *
     * @param tick           current simulation tick number
     * @param metrics        current metrics snapshot
     * @param traceEntries   recent bridge trace entries (may be empty)
     */
    public static String generate(long tick, MetricsSnapshot metrics, List<BridgeTraceEntry> traceEntries) {
        StringBuilder sb = new StringBuilder(1024);

        sb.append("=== Clockwork Diagnostic Report ===\n");
        sb.append("Generated: ").append(Instant.now()).append("\n\n");

        appendSection(sb, "Runtime");
        sb.append("  Java version : ").append(System.getProperty("java.version", "?")).append("\n");
        sb.append("  VM name      : ").append(System.getProperty("java.vm.name", "?")).append("\n");
        sb.append("  OS           : ").append(System.getProperty("os.name", "?"))
            .append(" ").append(System.getProperty("os.arch", "?")).append("\n");
        long maxHeapMb = Runtime.getRuntime().maxMemory() / (1024 * 1024);
        long usedHeapMb = (Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory()) / (1024 * 1024);
        sb.append("  Heap         : ").append(usedHeapMb).append("MB used / ").append(maxHeapMb).append("MB max\n\n");

        appendSection(sb, "Simulation");
        sb.append("  Tick         : ").append(tick).append("\n");
        sb.append("  Total ticks  : ").append(metrics.totalTicks()).append("\n\n");

        appendSection(sb, "Tick Timing");
        sb.append(String.format("  Avg tick     : %.3f ms%n", metrics.avgTickMs()));
        sb.append(String.format("  Peak tick    : %.3f ms%n", metrics.peakTickMs()));
        sb.append(String.format("  Avg frame    : %.3f ms%n", metrics.avgFrameMs()));
        sb.append(String.format("  Peak frame   : %.3f ms%n", metrics.peakFrameMs()));
        sb.append("  Total frames : ").append(metrics.totalFrames()).append("\n\n");

        appendSection(sb, "Render Queue Depth (last tick)");
        sb.append("  Sprites      : ").append(metrics.queueSprites()).append("\n");
        sb.append("  Lights       : ").append(metrics.queueLights()).append("\n");
        sb.append("  Particles    : ").append(metrics.queueParticles()).append("\n\n");

        appendSection(sb, "Network");
        sb.append(String.format("  Avg latency  : %.1f ms%n", metrics.avgNetworkLatencyMs()));
        sb.append("  Dropped pkts : ").append(metrics.droppedPackets()).append("\n\n");

        if (!traceEntries.isEmpty()) {
            appendSection(sb, "Recent Bridge Traces (newest last)");
            for (BridgeTraceEntry entry : traceEntries) {
                sb.append(String.format("  [%s] %-30s  %.3f ms%n",
                    entry.wallClockMs(), entry.operation(), entry.durationNanos() / 1_000_000.0));
            }
            sb.append("\n");
        }

        sb.append("=== End of Report ===\n");
        return sb.toString();
    }

    private static void appendSection(StringBuilder sb, String title) {
        sb.append("--- ").append(title).append(" ---\n");
    }
}
