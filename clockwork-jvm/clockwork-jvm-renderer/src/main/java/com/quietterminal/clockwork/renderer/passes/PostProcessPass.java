package com.quietterminal.clockwork.renderer.passes;

import com.quietterminal.clockwork.renderer.RenderContext;
import com.quietterminal.clockwork.renderer.RenderPass;
import com.quietterminal.clockwork.renderer.RenderQueue;

/** Applies bloom and final color tweaks before output. */
public final class PostProcessPass implements RenderPass {
    @Override
    public void init(RenderContext context) {
    }

    @Override
    public void execute(RenderContext context, RenderQueue queue) {
        context.postProcessPass();
    }

    @Override
    public void dispose() {
    }
}
