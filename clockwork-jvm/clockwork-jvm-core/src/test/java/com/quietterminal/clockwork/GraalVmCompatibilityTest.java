package com.quietterminal.clockwork;

import org.graalvm.polyglot.Engine;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.quietterminal.clockwork.bridge.ClockworkBridge;
import com.quietterminal.clockwork.bridge.PolyglotValue;
import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import org.junit.jupiter.api.function.ThrowingSupplier;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GraalVmCompatibilityTest {
    @Test
    void graalPolyglotEngineIsAvailable() {
        // If this throws, GraalVM is missing from the classpath entirely.
        Engine engine = assertDoesNotThrow((ThrowingSupplier<Engine>) Engine::create);
        assertNotNull(engine);
        engine.close();
    }

    @Test
    void graalEngineVersionIsNonBlank() {
        try (Engine engine = Engine.create()) {
            String version = engine.getVersion();
            assertNotNull(version);
            assertFalse(version.isBlank(), "Graal engine must report a version string");
        }
    }

    @Test
    void graalEngineReportsJsLanguageAvailable() {
        try (Engine engine = Engine.create()) {
            assertTrue(engine.getLanguages().containsKey("js"),
                "GraalVM JS language must be installed. Run: gu install js");
        }
    }

    @Test
    void graalEngineVersionIsAtLeast23() {
        try (Engine engine = Engine.create()) {
            String version = engine.getVersion();
            int major = parseMajorVersion(version);
            if (major == 0 && version.toLowerCase(Locale.ROOT).contains("development")) {
                return;
            }
            assertTrue(major >= 23,
                "GraalVM engine version " + version + " is below minimum 23.x required by ClockworkJVM");
        }
    }

    @Test
    void bridgeStartsSuccessfullyWithCurrentBundle() {
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            assertDoesNotThrow(bridge::start);
            PolyglotValue clockwork = bridge.clockwork();
            assertFalse(clockwork.isNull(), "ClockworkJVM global must be non-null");
        }
    }

    @Test
    void bridgeRejectsApiVersionTooLow(@TempDir Path tmp) throws IOException {
        Path bundle = tmp.resolve("old-api.js");
        Files.writeString(bundle, bundleWithApiVersion(1));
        String prev = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", bundle.toString());
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            assertThrows(ClockworkBridgeException.class, bridge::start);
        } finally {
            restoreBundle(prev);
        }
    }

    @Test
    void bridgeRejectsApiVersionTooHigh(@TempDir Path tmp) throws IOException {
        Path bundle = tmp.resolve("future-api.js");
        Files.writeString(bundle, bundleWithApiVersion(999));
        String prev = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", bundle.toString());
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            assertThrows(ClockworkBridgeException.class, bridge::start);
        } finally {
            restoreBundle(prev);
        }
    }

    @Test
    void bridgeRejectsBundleMissingApiVersion(@TempDir Path tmp) throws IOException {
        Path bundle = tmp.resolve("no-version.js");
        Files.writeString(bundle, """
            globalThis.ClockworkJVM = {
              bundleVersion: "0.1.0",
              createBridgeApi() { return {}; }
            };
            """);
        String prev = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", bundle.toString());
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            assertThrows(ClockworkBridgeException.class, bridge::start);
        } finally {
            restoreBundle(prev);
        }
    }

    @Test
    void bridgeRejectsBundleMissingCreateBridgeApi(@TempDir Path tmp) throws IOException {
        Path bundle = tmp.resolve("no-factory.js");
        Files.writeString(bundle, """
            globalThis.ClockworkJVM = {
              bundleVersion: "0.1.0",
              bridgeApiVersion: 2
            };
            """);
        String prev = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", bundle.toString());
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            assertThrows(ClockworkBridgeException.class, bridge::start);
        } finally {
            restoreBundle(prev);
        }
    }

    @Test
    void bridgeRejectsEmptyBundle(@TempDir Path tmp) throws IOException {
        Path bundle = tmp.resolve("empty.js");
        Files.writeString(bundle, "// empty");
        String prev = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", bundle.toString());
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            assertThrows(ClockworkBridgeException.class, bridge::start);
        } finally {
            restoreBundle(prev);
        }
    }

    @Test
    void bridgeRejectsWrongBundleVersion(@TempDir Path tmp) throws IOException {
        Path bundle = tmp.resolve("wrong-bundle-ver.js");
        Files.writeString(bundle, """
            globalThis.ClockworkJVM = {
              bundleVersion: "9.9.9",
              bridgeApiVersion: 2,
              createBridgeApi() {
                return {
                  createWorld() { return { reserveEntityId() { return 1; }, applyBatch() {}, query() { return []; }, subscribeEvent() {}, emitEvent() {} }; },
                  registerSystem() {},
                  step() {},
                  dispose() {}
                };
              }
            };
            """);
        String prev = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", bundle.toString());
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            assertThrows(ClockworkBridgeException.class, bridge::start);
        } finally {
            restoreBundle(prev);
        }
    }

    @Test
    void closedBridgeCanBeReopenedCleanly() {
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            bridge.start();
        }
        try (ClockworkBridge bridge = new ClockworkBridge()) {
            assertDoesNotThrow(bridge::start);
        }
    }

    private static String bundleWithApiVersion(int apiVersion) {
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

    private static void restoreBundle(String prev) {
        if (prev == null) System.clearProperty("clockworkjvm.bundlePath");
        else System.setProperty("clockworkjvm.bundlePath", prev);
    }

    private static int parseMajorVersion(String version) {
        try {
            Matcher matcher = Pattern.compile("(\\d+)").matcher(version);
            if (!matcher.find()) {
                return 0;
            }
            return Integer.parseInt(matcher.group(1));
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
