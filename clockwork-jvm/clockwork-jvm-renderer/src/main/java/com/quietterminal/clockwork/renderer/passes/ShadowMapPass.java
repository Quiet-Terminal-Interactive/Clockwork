package com.quietterminal.clockwork.renderer.passes;

import com.quietterminal.clockwork.renderer.RenderContext;
import com.quietterminal.clockwork.renderer.RenderPass;
import com.quietterminal.clockwork.renderer.RenderQueue;

/** Packs light shadows into a shared atlas texture. */
public final class ShadowMapPass implements RenderPass {
    @Override
    public void init(RenderContext context) {
    }

    @Override
    public void execute(RenderContext context, RenderQueue queue) {
        context.shadowPass();
    }

    @Override
    public void dispose() {
    }
}
