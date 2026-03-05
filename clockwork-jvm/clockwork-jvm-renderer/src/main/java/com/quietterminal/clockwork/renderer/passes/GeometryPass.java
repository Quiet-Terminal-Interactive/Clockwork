package com.quietterminal.clockwork.renderer.passes;

import com.quietterminal.clockwork.renderer.RenderContext;
import com.quietterminal.clockwork.renderer.RenderPass;
import com.quietterminal.clockwork.renderer.RenderQueue;

/** Writes sprite geometry into the G-buffer. */
public final class GeometryPass implements RenderPass {
    @Override
    public void init(RenderContext context) {
    }

    @Override
    public void execute(RenderContext context, RenderQueue queue) {
        context.geometryPass();
    }

    @Override
    public void dispose() {
    }
}
