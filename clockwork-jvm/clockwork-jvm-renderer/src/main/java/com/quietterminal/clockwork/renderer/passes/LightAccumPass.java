package com.quietterminal.clockwork.renderer.passes;

import com.quietterminal.clockwork.renderer.RenderContext;
import com.quietterminal.clockwork.renderer.RenderPass;
import com.quietterminal.clockwork.renderer.RenderQueue;

/** Accumulates per-light contribution into a lighting buffer. */
public final class LightAccumPass implements RenderPass {
    @Override
    public void init(RenderContext context) {
    }

    @Override
    public void execute(RenderContext context, RenderQueue queue) {
        context.lightPass();
    }

    @Override
    public void dispose() {
    }
}
