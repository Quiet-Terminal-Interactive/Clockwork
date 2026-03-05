package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.exceptions.ClockworkLifecycleException;
import com.quietterminal.clockwork.scheduler.Stage;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

class AppBuilderTest {
    @Test
    void pluginRegistersAndAppBuilds() {
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "test-plugin";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    world.resources().insert("value", 42);
                    app.addSystem(Stage.UPDATE, ctx -> {
                    });
                }
            })
            .build();

        assertNotNull(app);
        assertEquals(42, app.world().resources().get("value").orElseThrow());
    }

    @Test
    void pluginOrderIsDependencyFirstAndDeterministic() {
        List<String> calls = new ArrayList<>();
        ClockworkApp app = new ClockworkApp()
            .use(plugin("game", new String[]{"physics"}, calls))
            .use(plugin("physics", new String[0], calls))
            .build();

        assertNotNull(app);
        assertEquals(List.of("register:physics", "register:game", "init:physics", "init:game"), calls);
    }

    @Test
    void pluginCycleFailsFast() {
        ClockworkApp app = new ClockworkApp()
            .use(plugin("a", new String[]{"b"}, new ArrayList<>()))
            .use(plugin("b", new String[]{"a"}, new ArrayList<>()));

        assertThrows(ClockworkLifecycleException.class, app::build);
    }

    private static ClockworkPlugin plugin(String name, String[] depends, List<String> calls) {
        return new ClockworkPlugin() {
            @Override
            public String name() {
                return name;
            }

            @Override
            public String[] depends() {
                return depends;
            }

            @Override
            public void register(ClockworkApp app, WorldApi world) {
                calls.add("register:" + name);
            }

            @Override
            public void init(ClockworkApp app, WorldApi world) {
                calls.add("init:" + name);
            }
        };
    }
}
