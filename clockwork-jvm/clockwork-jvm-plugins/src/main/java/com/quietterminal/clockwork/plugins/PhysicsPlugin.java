package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.ClockworkWorld;
import com.quietterminal.clockwork.WorldApi;

import java.util.Objects;

/** Java wrapper plugin for Clockwork physics. */
public final class PhysicsPlugin implements ClockworkPlugin {
    public static final String RESOURCE_KEY = "physics.config";

    private final PhysicsConfig config;

    public PhysicsPlugin() {
        this(PhysicsConfig.builder().build());
    }

    public PhysicsPlugin(PhysicsConfig config) {
        this.config = Objects.requireNonNull(config, "config");
    }

    @Override
    public String name() {
        return "qti-clockwork-physics";
    }

    @Override
    public void register(ClockworkApp app, WorldApi world) {
        world.resources().insert(RESOURCE_KEY, config);
        if (world instanceof ClockworkWorld clockworkWorld) {
            clockworkWorld.enablePhysicsBridge(config);
        }
    }
}
