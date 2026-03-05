package com.quietterminal.clockwork.renderer;

import java.util.HashMap;
import java.util.Map;
import java.util.Objects;

/**
 * Allows mods to replace built-in GLSL shader source by program key.
 * Keys match the program names used internally: "geometry", "shadow", "light_accum",
 * "composite", "bloom_downsample", "bloom_upsample", "output".
 */
public final class ShaderOverrideRegistry {

    private record ShaderSource(String vertex, String fragment) {}

    private final Map<String, ShaderSource> overrides = new HashMap<>();

    /**
     * Registers a full vertex+fragment override for the named program.
     * Both sources must be valid GLSL 330 core. Validation occurs at renderer init time.
     */
    public ShaderOverrideRegistry override(String programKey, String vertexSource, String fragmentSource) {
        Objects.requireNonNull(programKey, "programKey");
        Objects.requireNonNull(vertexSource, "vertexSource");
        Objects.requireNonNull(fragmentSource, "fragmentSource");
        overrides.put(programKey, new ShaderSource(vertexSource, fragmentSource));
        return this;
    }

    boolean hasOverride(String key) {
        return overrides.containsKey(key);
    }

    String vertexSource(String key) {
        return overrides.get(key).vertex();
    }

    String fragmentSource(String key) {
        return overrides.get(key).fragment();
    }
}
