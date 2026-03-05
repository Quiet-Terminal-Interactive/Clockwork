package com.quietterminal.clockwork;

import org.graalvm.polyglot.Context;
import org.graalvm.polyglot.proxy.ProxyExecutable;
import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.bridge.ClockworkBridge;
import com.quietterminal.clockwork.bridge.PolyglotValue;
import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

class BridgeTest {
    @Test
    void bridgeExposesClockworkGlobal() {
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            bridge.start();
            PolyglotValue value = bridge.clockwork();
            assertFalse(value.isNull());
        }
    }

    @Test
    void proxyExecutableRoundTrip() {
        try (Context context = Context.create("js")) {
            ProxyExecutable executable = args -> args[0].asInt() + 1;
            context.getBindings("js").putMember("inc", executable);
            int result = context.eval("js", "inc(41)").asInt();
            assertEquals(42, result);
        }
    }

    @Test
    void bundleOverridePathIsSupported() throws IOException {
        Path override = Files.createTempFile("clockwork-jvm-bundle", ".js");
        Files.writeString(override, validBundle(2));

        String previous = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", override.toString());
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            bridge.start();
            assertFalse(bridge.clockwork().isNull());
        } finally {
            restoreBundleOverride(previous);
            Files.deleteIfExists(override);
        }
    }

    @Test
    void bundleApiMismatchFailsFast() throws IOException {
        Path override = Files.createTempFile("clockwork-jvm-bundle-bad", ".js");
        Files.writeString(override, validBundle(99));

        String previous = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", override.toString());
        try {
            try (ClockworkBridge bridge = new ClockworkBridge()) {
                assertThrows(ClockworkBridgeException.class, bridge::start);
            }
        } finally {
            restoreBundleOverride(previous);
            Files.deleteIfExists(override);
        }
    }

    private static void restoreBundleOverride(String previous) {
        if (previous == null) {
            System.clearProperty("clockworkjvm.bundlePath");
            return;
        }
        System.setProperty("clockworkjvm.bundlePath", previous);
    }

    private static String validBundle(int apiVersion) {
        return """
            globalThis.ClockworkJVM = {
              bundleVersion: "0.1.0",
              bridgeApiVersion: %d,
              createBridgeApi() {
                return {
                  createWorld() {
                    return {
                      reserveEntityId() { return 1; },
                      applyBatch() {},
                      query() { return []; },
                      subscribeEvent() {},
                      emitEvent() {}
                    };
                  },
                  registerSystem() {},
                  step() {},
                  dispose() {}
                };
              }
            };
            """.formatted(apiVersion);
    }
}
