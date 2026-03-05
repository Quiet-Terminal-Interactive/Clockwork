package com.quietterminal.clockwork.renderer;

/** Contract for a renderer pass. */
public interface RenderPass {
    void init(RenderContext context);

    void execute(RenderContext context, RenderQueue queue);

    void dispose();
}
