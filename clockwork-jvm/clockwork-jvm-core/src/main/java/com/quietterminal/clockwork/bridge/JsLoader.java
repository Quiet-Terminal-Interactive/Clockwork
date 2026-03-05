package com.quietterminal.clockwork.bridge;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;

/** Loads bundled Clockwork JavaScript from the classpath. */
public final class JsLoader {
    private static final String BUNDLE_OVERRIDE_PROPERTY = "clockworkjvm.bundlePath";
    private static final String BUNDLE_OVERRIDE_ENV = "CLOCKWORKJVM_BUNDLE_PATH";

    public String loadBundle() {
        Optional<Path> override = resolveOverridePath();
        if (override.isPresent()) {
            return loadBundleFromPath(override.get());
        }
        return loadClasspathBundle();
    }

    private static String loadBundleFromPath(Path path) {
        if (!Files.isRegularFile(path)) {
            throw new ClockworkBridgeException("Bundle override path does not point to a file: " + path);
        }
        try {
            return Files.readString(path, StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new ClockworkBridgeException("Failed to load Clockwork bundle from override path: " + path, e);
        }
    }

    private String loadClasspathBundle() {
        try (InputStream in = getClass().getResourceAsStream("/js/bundle/clockwork.bundle.js")) {
            if (in == null) {
                throw new ClockworkBridgeException("Missing /js/bundle/clockwork.bundle.js resource.");
            }
            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            throw new ClockworkBridgeException("Failed to load clockwork.bundle.js.", e);
        }
    }

    private static Optional<Path> resolveOverridePath() {
        String configured = System.getProperty(BUNDLE_OVERRIDE_PROPERTY);
        if (configured == null || configured.isBlank()) {
            configured = System.getenv(BUNDLE_OVERRIDE_ENV);
        }
        if (configured == null || configured.isBlank()) {
            return Optional.empty();
        }
        return Optional.of(Path.of(configured).toAbsolutePath().normalize());
    }
}
