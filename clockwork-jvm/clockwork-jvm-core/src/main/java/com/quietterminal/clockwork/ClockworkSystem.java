package com.quietterminal.clockwork;

import com.quietterminal.clockwork.scheduler.SystemContext;

/** Functional interface for systems. */
@FunctionalInterface
public interface ClockworkSystem {
    void execute(SystemContext context);
}
