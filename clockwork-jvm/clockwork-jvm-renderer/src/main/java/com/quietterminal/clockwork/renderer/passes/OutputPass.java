package com.quietterminal.clockwork.renderer.passes;

import com.quietterminal.clockwork.renderer.RenderContext;
import com.quietterminal.clockwork.renderer.RenderPass;
import com.quietterminal.clockwork.renderer.RenderQueue;

/** Outputs the post-processed scene to the default framebuffer. */
public final class OutputPass implements RenderPass {
    @Override
    public void init(RenderContext context) {
    }

    @Override
    public void execute(RenderContext context, RenderQueue queue) {
        context.outputPass();
    }

    @Override
    public void dispose() {
    }
}
