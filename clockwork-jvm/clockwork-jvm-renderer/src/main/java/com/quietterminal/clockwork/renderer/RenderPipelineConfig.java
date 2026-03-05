package com.quietterminal.clockwork.renderer;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * Configures the renderer pass pipeline for mods and custom renderers.
 * Passes execute in declaration order: built-ins first (with replacements applied), then appended extras.
 */
public final class RenderPipelineConfig {

    private final Map<Class<? extends RenderPass>, RenderPass> replacements = new LinkedHashMap<>();
    private final List<RenderPass> appendedPasses = new ArrayList<>();

    /**
     * Replaces a built-in pass with a custom implementation.
     * The replacement executes at the same position in the pipeline as the original.
     * If the target class is not found in the default list, the replacement is silently ignored.
     */
    public RenderPipelineConfig replacePass(Class<? extends RenderPass> target, RenderPass replacement) {
        Objects.requireNonNull(target, "target");
        Objects.requireNonNull(replacement, "replacement");
        replacements.put(target, replacement);
        return this;
    }

    /**
     * Appends a custom pass after all built-in passes.
     * Useful for adding screen-space effects, debug overlays, or HUD rendering.
     */
    public RenderPipelineConfig appendPass(RenderPass pass) {
        appendedPasses.add(Objects.requireNonNull(pass, "pass"));
        return this;
    }

    List<RenderPass> buildPassList(List<RenderPass> defaults) {
        List<RenderPass> result = new ArrayList<>(defaults.size() + appendedPasses.size());
        for (RenderPass defaultPass : defaults) {
            RenderPass override = replacements.get(defaultPass.getClass());
            result.add(override != null ? override : defaultPass);
        }
        result.addAll(appendedPasses);
        return List.copyOf(result);
    }
}
