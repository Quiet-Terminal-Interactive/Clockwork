package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.WorldApi;

/** Java wrapper plugin for Neon networking. */
public final class NeonPlugin implements ClockworkPlugin {
    public static final String CONFIG_KEY = "neon.config";
    public static final String CLIENT_KEY = "neon.client";

    private final NeonConfig config;

    public NeonPlugin(NeonConfig config) {
        this.config = config;
    }

    @Override
    public String name() {
        return "qti-neon-client";
    }

    @Override
    public void register(ClockworkApp app, WorldApi world) {
        world.resources().insert(CONFIG_KEY, config);
        world.resources().insert(CLIENT_KEY, new NeonClient());
    }
}
