package com.quietterminal.clockwork.scheduler;

import com.quietterminal.clockwork.WorldApi;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.events.EventBus;
import com.quietterminal.clockwork.events.ResourceStore;

/** Data exposed to a running system. */
public interface SystemContext {
    WorldApi world();

    Commands commands();

    EventBus events();

    ResourceStore resources();

    long tick();

    double deltaTime();

    double fixedDeltaTime();
}
