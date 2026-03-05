package com.quietterminal.clockwork;

import org.graalvm.polyglot.proxy.ProxyExecutable;

import com.quietterminal.clockwork.bridge.ClockworkBridge;
import com.quietterminal.clockwork.exceptions.ClockworkEcsException;
import com.quietterminal.clockwork.exceptions.ClockworkLifecycleException;
import com.quietterminal.clockwork.observability.ClockworkMetrics;
import com.quietterminal.clockwork.observability.DiagnosticReport;
import com.quietterminal.clockwork.scheduler.DefaultSystemContext;
import com.quietterminal.clockwork.scheduler.Stage;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.EnumMap;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.atomic.AtomicBoolean;

/** Entry point for building and running a Clockwork app. */
public final class ClockworkApp {
    /** Current engine version. Plugins declare {@link ClockworkPlugin#minEngineVersion()} against this. */
    public static final PluginVersion ENGINE_VERSION = PluginVersion.of(1, 0, 0);

    private static final double DEFAULT_FIXED_DELTA_SECONDS = 1.0 / 60.0;

    private final ClockworkBridge bridge;
    private final List<ClockworkPlugin> plugins;
    private final Map<Stage, List<ClockworkSystem>> systems;
    private final AtomicBoolean running = new AtomicBoolean();
    private final AtomicBoolean stepping = new AtomicBoolean();
    private final EngineWatchdog watchdog = new EngineWatchdog();
    private final ClockworkMetrics metrics = new ClockworkMetrics();
    private final List<Runnable> tickEndHooks = new ArrayList<>();
    private boolean built;
    private long tick;
    private ClockworkWorld world;
    private List<ClockworkPlugin> resolvedPluginOrder = List.of();

    private volatile Thread simulationThread;

    public ClockworkApp() {
        this.bridge = new ClockworkBridge();
        this.plugins = new ArrayList<>();
        this.systems = new EnumMap<>(Stage.class);
        for (Stage stage : Stage.values()) {
            this.systems.put(stage, new ArrayList<>());
        }
    }

    public ClockworkApp use(ClockworkPlugin plugin) {
        plugins.add(Objects.requireNonNull(plugin, "plugin"));
        return this;
    }

    public ClockworkApp addSystem(Stage stage, ClockworkSystem system) {
        Stage validatedStage = Objects.requireNonNull(stage, "stage");
        ClockworkSystem validatedSystem = Objects.requireNonNull(system, "system");
        systems.get(validatedStage).add(validatedSystem);
        if (built) {
            registerSystemWithBridge(validatedStage, validatedSystem);
        }
        return this;
    }

    /**
     * Registers a hook that runs on the simulation thread after all systems complete each tick.
     * Used by subsystems (e.g., renderer) to perform post-tick work like committing the render queue.
     */
    public ClockworkApp addTickEndHook(Runnable hook) {
        tickEndHooks.add(Objects.requireNonNull(hook, "hook"));
        return this;
    }

    /** Returns the thread currently running the simulation, or null if no tick is in flight. */
    public Thread simulationThread() {
        return simulationThread;
    }

    public ClockworkApp build() {
        if (built) {
            return this;
        }

        try {
            bridge.start();
            world = new ClockworkWorld(bridge.createWorldBackend());
            resolvedPluginOrder = resolvePluginOrder(plugins);
            checkEngineVersionCompatibility(resolvedPluginOrder);

            for (ClockworkPlugin plugin : resolvedPluginOrder) {
                plugin.register(this, world);
            }
            for (ClockworkPlugin plugin : resolvedPluginOrder) {
                plugin.init(this, world);
            }
            registerAllSystemsWithBridge();
            built = true;
            return this;
        } catch (RuntimeException e) {
            throw new ClockworkLifecycleException("Clockwork app build failed.", e);
        }
    }

    public void run() {
        ensureBuilt();
        running.set(true);
        long lastFrameNanos = System.nanoTime();
        while (running.get()) {
            long now = System.nanoTime();
            double deltaSeconds = Math.max((now - lastFrameNanos) / 1_000_000_000.0, Double.MIN_NORMAL);
            lastFrameNanos = now;
            step(deltaSeconds);
        }
    }

    public void step(double deltaSeconds) {
        ensureBuilt();
        if (deltaSeconds <= 0) {
            throw new IllegalArgumentException("deltaSeconds must be > 0");
        }
        if (!stepping.compareAndSet(false, true)) {
            throw new IllegalStateException("ClockworkApp.step is re-entrant.");
        }
        simulationThread = Thread.currentThread();
        long tickStart = System.nanoTime();
        try {
            tick++;
            watchdog.tickStarted(tick);
            bridge.stepScheduler(tick, deltaSeconds, DEFAULT_FIXED_DELTA_SECONDS);
            for (Runnable hook : tickEndHooks) {
                hook.run();
            }
        } finally {
            metrics.recordTickTime(System.nanoTime() - tickStart);
            watchdog.tickCompleted();
            stepping.set(false);
        }
    }

    /** Returns the engine metrics collector. Use {@link ClockworkMetrics#addListener} for hooks. */
    public ClockworkMetrics metrics() {
        return metrics;
    }

    /** Generates a diagnostic report for bug reports. Includes metrics, trace entries, and JVM info. */
    public String diagnostics() {
        return DiagnosticReport.generate(tick, metrics.snapshot(), bridge.tracer().entries());
    }

    public void shutdown() {
        running.set(false);

        RuntimeException shutdownError = null;
        if (built && world != null) {
            List<ClockworkPlugin> reverse = new ArrayList<>(resolvedPluginOrder);
            reverse.sort(Comparator.comparingInt(resolvedPluginOrder::indexOf).reversed());
            for (ClockworkPlugin plugin : reverse) {
                try {
                    plugin.shutdown(this, world);
                } catch (RuntimeException e) {
                    if (shutdownError == null) {
                        shutdownError = new ClockworkLifecycleException(
                            "Plugin shutdown failed for " + plugin.name(),
                            e
                        );
                    } else {
                        shutdownError.addSuppressed(e);
                    }
                }
            }
        }

        if (world != null) {
            world.close();
        }
        bridge.close();
        watchdog.close();

        if (shutdownError != null) {
            throw shutdownError;
        }
    }

    public ClockworkWorld world() {
        ensureBuilt();
        return world;
    }

    public long tick() {
        return tick;
    }

    private void registerAllSystemsWithBridge() {
        for (Stage stage : Stage.values()) {
            for (ClockworkSystem system : systems.get(stage)) {
                registerSystemWithBridge(stage, system);
            }
        }
    }

    private static final SafeLogger LOG = new SafeLogger("App");

    private void registerSystemWithBridge(Stage stage, ClockworkSystem system) {
        ProxyExecutable callback = args -> {
            long callbackTick = args[0].asLong();
            double callbackDelta = args[1].asDouble();
            double callbackFixedDelta = args[2].asDouble();
            try {
                executeSystem(system, callbackTick, callbackDelta, callbackFixedDelta);
            } catch (RuntimeException e) {
                LOG.error("System " + system.getClass().getSimpleName()
                        + " threw on tick " + callbackTick + ": " + e.getMessage());
                throw e;
            }
            return null;
        };
        bridge.registerSystem(stage, callback);
    }

    private void executeSystem(ClockworkSystem system, long callbackTick, double deltaSeconds, double fixedDeltaSeconds) {
        var commands = world.commands();
        var context = new DefaultSystemContext(
            world,
            commands,
            world.events(),
            world.resources(),
            callbackTick,
            deltaSeconds,
            fixedDeltaSeconds
        );
        world.beginSystemExecution();
        try {
            system.execute(context);
        } catch (RuntimeException e) {
            throw new ClockworkEcsException(
                "System " + system.getClass().getSimpleName() + " threw during execute().", e
            );
        } finally {
            // Always unlock the world — even on exception. Commands are not committed on failure.
            world.endSystemExecution();
        }
        world.commit(commands);
    }

    private void ensureBuilt() {
        if (!built || world == null) {
            throw new IllegalStateException("Call build() before run/step/world.");
        }
    }

    private static void checkEngineVersionCompatibility(List<ClockworkPlugin> plugins) {
        for (ClockworkPlugin plugin : plugins) {
            PluginVersion required = plugin.minEngineVersion();
            if (!required.isMetBy(ENGINE_VERSION)) {
                throw new ClockworkLifecycleException(
                    "Plugin '" + plugin.name() + "' requires engine >= " + required
                    + " but this is engine " + ENGINE_VERSION + "."
                );
            }
        }
    }

    private static List<ClockworkPlugin> resolvePluginOrder(List<ClockworkPlugin> input) {
        Map<String, ClockworkPlugin> byName = new HashMap<>();
        for (ClockworkPlugin plugin : input) {
            String name = plugin.name();
            if (name == null || name.isBlank()) {
                throw new ClockworkLifecycleException("Plugin name must be non-blank.");
            }
            ClockworkPlugin previous = byName.putIfAbsent(name, plugin);
            if (previous != null) {
                throw new ClockworkLifecycleException("Duplicate plugin name: " + name);
            }
        }

        List<String> names = new ArrayList<>(byName.keySet());
        names.sort(String::compareTo);

        List<ClockworkPlugin> ordered = new ArrayList<>();
        Set<String> visiting = new HashSet<>();
        Set<String> visited = new HashSet<>();
        Deque<String> stack = new ArrayDeque<>();

        for (String name : names) {
            visit(name, byName, visiting, visited, stack, ordered);
        }

        return List.copyOf(ordered);
    }

    private static void visit(
        String name,
        Map<String, ClockworkPlugin> byName,
        Set<String> visiting,
        Set<String> visited,
        Deque<String> stack,
        List<ClockworkPlugin> ordered
    ) {
        if (visited.contains(name)) {
            return;
        }
        if (!visiting.add(name)) {
            StringBuilder cycle = new StringBuilder();
            for (String entry : stack) {
                cycle.append(entry).append(" -> ");
                if (entry.equals(name)) {
                    break;
                }
            }
            cycle.append(name);
            throw new ClockworkLifecycleException("Plugin dependency cycle detected: " + cycle);
        }

        stack.push(name);
        ClockworkPlugin plugin = byName.get(name);
        if (plugin == null) {
            throw new ClockworkLifecycleException("Missing plugin dependency: " + name);
        }
        String[] deps = Objects.requireNonNull(plugin.depends(), "depends() must not return null");
        List<String> sortedDeps = new ArrayList<>(deps.length);
        for (String dep : deps) {
            if (dep == null || dep.isBlank()) {
                throw new ClockworkLifecycleException("Plugin " + name + " contains blank dependency name.");
            }
            sortedDeps.add(dep);
        }
        sortedDeps.sort(String::compareTo);
        for (String dep : sortedDeps) {
            if (!byName.containsKey(dep)) {
                throw new ClockworkLifecycleException("Plugin " + name + " depends on missing plugin " + dep);
            }
            visit(dep, byName, visiting, visited, stack, ordered);
        }

        stack.pop();
        visiting.remove(name);
        visited.add(name);
        ordered.add(plugin);
    }
}
