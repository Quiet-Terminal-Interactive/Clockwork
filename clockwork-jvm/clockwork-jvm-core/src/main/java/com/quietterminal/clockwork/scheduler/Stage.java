package com.quietterminal.clockwork.scheduler;

/** Scheduler stages, in execution order. */
public enum Stage {
    BOOT,
    PRE_UPDATE,
    FIXED_UPDATE,
    UPDATE,
    LATE_UPDATE,
    RENDER_PREP,
    RENDER,
    POST_RENDER,
    SHUTDOWN
}
