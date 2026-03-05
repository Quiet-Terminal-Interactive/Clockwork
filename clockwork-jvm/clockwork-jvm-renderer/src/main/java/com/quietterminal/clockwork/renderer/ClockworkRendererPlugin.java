package com.quietterminal.clockwork.renderer;

import java.util.Objects;

import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.WorldApi;
import com.quietterminal.clockwork.renderer.input.InputBuffer;

/** Optional LWJGL renderer plugin. */
public final class ClockworkRendererPlugin implements ClockworkPlugin {
    public static final String WINDOW_CONFIG_KEY = "renderer.window.config";
    public static final String RENDER_QUEUE_KEY = "renderer.queue";

    private final WindowConfig config;
    private RenderPipelineConfig pipelineConfig = new RenderPipelineConfig();
    private final ShaderOverrideRegistry shaderOverrides = new ShaderOverrideRegistry();
    private RendererRuntime runtime;

    public ClockworkRendererPlugin(WindowConfig config) {
        this.config = Objects.requireNonNull(config, "config");
    }

    /**
     * Replaces or extends the default render pipeline.
     * Must be called before {@link ClockworkApp#build()}.
     */
    public ClockworkRendererPlugin pipeline(RenderPipelineConfig config) {
        this.pipelineConfig = Objects.requireNonNull(config, "config");
        return this;
    }

    /**
     * Returns the shader override registry for this plugin.
     * Register overrides before {@link ClockworkApp#build()}.
     */
    public ShaderOverrideRegistry shaderOverrides() {
        return shaderOverrides;
    }

    @Override
    public String name() {
        return "clockwork-renderer";
    }

    @Override
    public void register(ClockworkApp app, WorldApi world) {
        world.resources().insert(WINDOW_CONFIG_KEY, config);
        world.resources().insert(RENDER_QUEUE_KEY, new RenderQueue());
    }

    @Override
    public void init(ClockworkApp app, WorldApi world) {
        RenderQueue queue = (RenderQueue) world.resources()
            .get(RENDER_QUEUE_KEY)
            .orElseThrow(() -> new IllegalStateException("Missing render queue resource."));
        InputBuffer inputBuffer = (InputBuffer) world.resources().get(InputBuffer.KEY).orElse(null);
        runtime = new RendererRuntime(config, queue, world.events(), inputBuffer, app.metrics(), pipelineConfig, shaderOverrides);
        runtime.start();
        app.addTickEndHook(queue::commit);
    }

    @Override
    public void shutdown(ClockworkApp app, WorldApi world) {
        if (runtime != null) {
            runtime.close();
            runtime = null;
        }
    }
}
