package com.quietterminal.clockwork.bridge;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.Engine;
import org.graalvm.polyglot.HostAccess;
import org.graalvm.polyglot.PolyglotException;
import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.proxy.ProxyExecutable;

import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;
import com.quietterminal.clockwork.observability.BridgeTracer;
import com.quietterminal.clockwork.scheduler.Stage;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;

/** Hosts the GraalVM JavaScript bridge runtime. */
public final class ClockworkBridge implements AutoCloseable {
    private static final int EXPECTED_BRIDGE_API_VERSION = 2;
    private static final String EXPECTED_BUNDLE_VERSION = "0.1.0";
    private static final String ALLOW_NON_GRAAL_PROPERTY = "clockwork.allowNonGraal";
    private static final String LEGACY_ALLOW_NON_GRAAL_PROPERTY = "clockworkjvm.allowNonGraal";

    private final List<ProxyExecutable> callbacks = new CopyOnWriteArrayList<>();
    private final BridgeTracer tracer = new BridgeTracer();
    private Context context;
    private Value clockwork;
    private Value bridgeApi;
    private Thread ownerThread;

    public synchronized void start() {
        if (context != null) {
            return;
        }

        CapabilityReport capability = inspectCapabilities();
        validateRuntime(capability);

        try {
            context = Context.newBuilder("js")
                .engine(capability.engine())
                .allowHostAccess(restrictedHostAccess())
                .allowHostClassLookup(ClockworkBridge::isAllowedHostClass)
                .allowExperimentalOptions(true)
                .build();

            String bundle = new JsLoader().loadBundle();
            context.eval("js", bundle);

            clockwork = context.eval("js", "globalThis.ClockworkJVM");
            if (clockwork == null || clockwork.isNull()) {
                throw new ClockworkBridgeException("Clockwork bundle did not define globalThis.ClockworkJVM.");
            }

            verifyHandshake(clockwork);
            bridgeApi = clockwork.invokeMember("createBridgeApi");
            if (bridgeApi == null || bridgeApi.isNull()) {
                throw new ClockworkBridgeException("Clockwork bundle createBridgeApi() returned null.");
            }

            ownerThread = Thread.currentThread();
        } catch (RuntimeException e) {
            close();
            throw startupFailure(capability, e);
        }
    }

    /** Returns the bridge tracer. Enable via {@code bridge.tracer().enable()} before startup for full coverage. */
    public BridgeTracer tracer() {
        return tracer;
    }

    public synchronized PolyglotValue clockwork() {
        assertThread();
        if (clockwork == null) {
            throw new ClockworkBridgeException("Bridge not started.");
        }
        return new PolyglotValue(clockwork);
    }

    public synchronized BridgeWorldBackend createWorldBackend() {
        assertThread();
        if (bridgeApi == null) {
            throw new ClockworkBridgeException("Bridge not started.");
        }
        try {
            Value world = bridgeApi.invokeMember("createWorld");
            return new BridgeWorldBackend(world, this::assertThread);
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to create world backend.", e);
        }
    }

    public synchronized void registerSystem(Stage stage, ProxyExecutable callback) {
        assertThread();
        Objects.requireNonNull(stage, "stage");
        Objects.requireNonNull(callback, "callback");
        ensureBridgeApi();
        callbacks.add(callback);
        tracer.trace("registerSystem:" + stage.name(), () -> {
            try {
                bridgeApi.invokeMember("registerSystem", stage.name(), callback);
            } catch (RuntimeException e) {
                throw new ClockworkBridgeException("Failed to register Java system callback for stage " + stage + ".", e);
            }
        });
    }

    public synchronized void stepScheduler(long tick, double deltaSeconds, double fixedDeltaSeconds) {
        assertThread();
        ensureBridgeApi();
        tracer.trace("step", () -> {
            try {
                bridgeApi.invokeMember("step", tick, deltaSeconds, fixedDeltaSeconds);
            } catch (RuntimeException e) {
                throw new ClockworkBridgeException("JS scheduler step failed.", e);
            }
        });
    }

    public synchronized void shutdownScheduler(long tick, double fixedDeltaSeconds) {
        assertThread();
        ensureBridgeApi();
        tracer.trace("shutdown", () -> {
            try {
                bridgeApi.invokeMember("shutdown", tick, fixedDeltaSeconds);
            } catch (RuntimeException e) {
                throw new ClockworkBridgeException("JS scheduler shutdown failed.", e);
            }
        });
    }

    @Override
    public synchronized void close() {
        if (context == null) {
            return;
        }
        try {
            if (bridgeApi != null && bridgeApi.hasMember("dispose")) {
                bridgeApi.invokeMember("dispose");
            }
        } catch (RuntimeException ignored) {
        } finally {
            callbacks.clear();
            clockwork = null;
            bridgeApi = null;
            ownerThread = null;
            try {
                context.close(true);
            } catch (RuntimeException ignored) {
            }
            context = null;
        }
    }

    private void ensureBridgeApi() {
        if (bridgeApi == null) {
            throw new ClockworkBridgeException("Bridge not started.");
        }
    }

    private void assertThread() {
        Thread owner = ownerThread;
        if (owner == null) {
            throw new ClockworkBridgeException("Bridge not started.");
        }
        if (Thread.currentThread() != owner) {
            throw new ClockworkBridgeException(
                "ClockworkBridge is thread-affine. Expected " + owner.getName() + " but was " + Thread.currentThread().getName() + "."
            );
        }
    }

    private static HostAccess restrictedHostAccess() {
        return HostAccess.newBuilder(HostAccess.NONE)
            .allowPublicAccess(true)
            .allowArrayAccess(true)
            .allowListAccess(true)
            .allowMapAccess(true)
            .allowIteratorAccess(true)
            .build();
    }

    private static boolean isAllowedHostClass(String className) {
        return className != null && className.startsWith("com.quietterminal.clockwork.");
    }

    private static void verifyHandshake(Value contract) {
        if (!contract.hasMember("bridgeApiVersion")) {
            throw new ClockworkBridgeException("Clockwork bundle is missing bridgeApiVersion.");
        }
        int apiVersion = contract.getMember("bridgeApiVersion").asInt();
        if (apiVersion != EXPECTED_BRIDGE_API_VERSION) {
            throw new ClockworkBridgeException(
                "Clockwork bundle API version mismatch. Java expects "
                    + EXPECTED_BRIDGE_API_VERSION
                    + " but bundle reports "
                    + apiVersion
                    + "."
            );
        }

        if (!contract.hasMember("bundleVersion")) {
            throw new ClockworkBridgeException("Clockwork bundle is missing bundleVersion.");
        }
        String bundleVersion = contract.getMember("bundleVersion").asString();
        if (!EXPECTED_BUNDLE_VERSION.equals(bundleVersion)) {
            throw new ClockworkBridgeException(
                "Clockwork bundle version mismatch. Java expects "
                    + EXPECTED_BUNDLE_VERSION
                    + " but bundle reports "
                    + bundleVersion
                    + "."
            );
        }

        if (!contract.hasMember("createBridgeApi") || !contract.getMember("createBridgeApi").canExecute()) {
            throw new ClockworkBridgeException("Clockwork bundle does not expose createBridgeApi().");
        }
    }

    private static CapabilityReport inspectCapabilities() {
        Engine engine;
        try {
            engine = Engine.create();
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to create Graal polyglot engine.", e);
        }

        List<String> warnings = new ArrayList<>();
        if (System.getProperty("jvmci.Compiler") == null) {
            warnings.add("JVMCI compiler is not configured; bridge performance may degrade.");
        }

        return new CapabilityReport(
            engine,
            System.getProperty("java.vm.name", "") + " " + System.getProperty("java.vm.vendor", ""),
            engine.getVersion(),
            engine.getLanguages().containsKey("js"),
            warnings
        );
    }

    private static void validateRuntime(CapabilityReport capability) {
        if (!capability.hasJsLanguage()) {
            throw new ClockworkBridgeException("Graal JavaScript language is not installed in this runtime.");
        }
        if (allowNonGraalRuntime()) {
            return;
        }
        String vmName = capability.vmName().toLowerCase(Locale.ROOT);
        if (!vmName.contains("graal")) {
            throw new ClockworkBridgeException("ClockworkJVM requires GraalVM 21+ runtime.");
        }
    }

    private static boolean allowNonGraalRuntime() {
        return Boolean.getBoolean(ALLOW_NON_GRAAL_PROPERTY) || Boolean.getBoolean(LEGACY_ALLOW_NON_GRAAL_PROPERTY);
    }

    private static ClockworkBridgeException startupFailure(CapabilityReport capability, RuntimeException failure) {
        if (failure instanceof ClockworkBridgeException bridgeFailure) {
            return bridgeFailure;
        }

        String cause;
        if (failure instanceof PolyglotException polyglot && polyglot.isGuestException()) {
            cause = "guest JavaScript exception: " + polyglot.getMessage();
        } else {
            cause = failure.getClass().getSimpleName() + ": " + failure.getMessage();
        }

        StringBuilder diagnostics = new StringBuilder();
        diagnostics.append("Clockwork bridge startup failed. Root cause: ").append(cause).append("\n")
            .append("VM: ").append(capability.vmName()).append("\n")
            .append("Graal engine: ").append(capability.engineVersion()).append("\n")
            .append("JavaScript installed: ").append(capability.hasJsLanguage());
        if (!capability.warnings().isEmpty()) {
            diagnostics.append("\nWarnings: ").append(String.join(" | ", capability.warnings()));
        }

        return new ClockworkBridgeException(diagnostics.toString(), failure);
    }

    private record CapabilityReport(
        Engine engine,
        String vmName,
        String engineVersion,
        boolean hasJsLanguage,
        List<String> warnings
    ) {
        private CapabilityReport {
            warnings = List.copyOf(Objects.requireNonNull(warnings, "warnings"));
        }
    }
}
