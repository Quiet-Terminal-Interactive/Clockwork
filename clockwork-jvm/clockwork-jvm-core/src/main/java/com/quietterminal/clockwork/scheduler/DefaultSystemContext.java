package com.quietterminal.clockwork.scheduler;

import com.quietterminal.clockwork.WorldApi;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.events.EventBus;
import com.quietterminal.clockwork.events.ResourceStore;

/** Default immutable context implementation. */
public final class DefaultSystemContext implements SystemContext {
    private final WorldApi world;
    private final Commands commands;
    private final EventBus events;
    private final ResourceStore resources;
    private final long tick;
    private final double deltaTime;
    private final double fixedDeltaTime;

    public DefaultSystemContext(WorldApi world,
                                Commands commands,
                                EventBus events,
                                ResourceStore resources,
                                long tick,
                                double deltaTime,
                                double fixedDeltaTime) {
        this.world = world;
        this.commands = commands;
        this.events = events;
        this.resources = resources;
        this.tick = tick;
        this.deltaTime = deltaTime;
        this.fixedDeltaTime = fixedDeltaTime;
    }

    @Override
    public WorldApi world() {
        return world;
    }

    @Override
    public Commands commands() {
        return commands;
    }

    @Override
    public EventBus events() {
        return events;
    }

    @Override
    public ResourceStore resources() {
        return resources;
    }

    @Override
    public long tick() {
        return tick;
    }

    @Override
    public double deltaTime() {
        return deltaTime;
    }

    @Override
    public double fixedDeltaTime() {
        return fixedDeltaTime;
    }
}
