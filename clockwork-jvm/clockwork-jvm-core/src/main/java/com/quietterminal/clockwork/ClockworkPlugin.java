package com.quietterminal.clockwork;

/** Plugin contract for ClockworkJVM. */
public interface ClockworkPlugin {
    String name();

    default String[] depends() {
        return new String[0];
    }

    /** This plugin's own version. Used for dependency version resolution between plugins. */
    default PluginVersion version() {
        return PluginVersion.of(0, 0, 0);
    }

    /**
     * Minimum engine version this plugin requires.
     * {@link ClockworkApp#build()} rejects the plugin if the engine version does not satisfy this.
     */
    default PluginVersion minEngineVersion() {
        return PluginVersion.of(1, 0, 0);
    }

    void register(ClockworkApp app, WorldApi world);

    default void init(ClockworkApp app, WorldApi world) {
    }

    default void shutdown(ClockworkApp app, WorldApi world) {
    }
}
