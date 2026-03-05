package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.exceptions.ClockworkLifecycleException;
import com.quietterminal.clockwork.scheduler.Stage;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PlatformSmokeTest {

    @Test
    void osNameIsNonBlank() {
        String osName = System.getProperty("os.name");
        assertNotNull(osName);
        assertFalse(osName.isBlank());
    }

    @Test
    void javaVersionIsTwentyOneOrHigher() {
        int major = Runtime.version().feature();
        assertTrue(major >= 21, "ClockworkJVM requires Java 21+. Found: " + major);
    }

    @Test
    void detectedPlatformIsOneOfKnownTargets() {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        boolean known = os.contains("linux") || os.contains("mac") || os.contains("windows");
        assertTrue(known, "Unexpected OS: " + os);
    }

    @Test
    void appBuildsStepsAndShutsDownWithoutError() {
        ClockworkApp app = new ClockworkApp().build();
        assertDoesNotThrow(() -> {
            app.step(1.0 / 60.0);
            app.step(1.0 / 60.0);
            app.shutdown();
        });
    }

    @Test
    void appTickCounterIncreasesPerStep() {
        ClockworkApp app = new ClockworkApp().build();
        app.step(1.0 / 60.0);
        assertEquals(1L, app.tick());
        app.step(1.0 / 60.0);
        assertEquals(2L, app.tick());
    }

    @Test
    void tickEndHookRunsOncePerStep() {
        AtomicInteger hookCalls = new AtomicInteger();
        ClockworkApp app = new ClockworkApp()
            .addTickEndHook(hookCalls::incrementAndGet)
            .build();

        app.step(1.0 / 60.0);
        app.step(1.0 / 60.0);
        assertEquals(2, hookCalls.get());
    }

    @Test
    void tickEndHookRunsAfterAllSystems() {
        List<String> order = new ArrayList<>();
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "order-test"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.RENDER, ctx -> order.add("render"));
                }
            })
            .addTickEndHook(() -> order.add("hook"))
            .build();

        app.step(1.0 / 60.0);
        int renderIdx = order.indexOf("render");
        int hookIdx = order.indexOf("hook");
        assertTrue(renderIdx >= 0 && hookIdx >= 0);
        assertTrue(hookIdx > renderIdx, "Tick-end hook must fire after all systems");
    }

    @Test
    void reentrantStepThrows() {
        AtomicBoolean reentered = new AtomicBoolean(false);
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "reentrant"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.UPDATE, ctx -> {
                        try {
                            app.step(1.0 / 60.0);
                        } catch (IllegalStateException e) {
                            reentered.set(true);
                        }
                    });
                }
            })
            .build();

        app.step(1.0 / 60.0);
        assertTrue(reentered.get(), "Re-entrant step must be rejected with IllegalStateException");
    }

    @Test
    void shutdownCallsPluginShutdownInReverseOrder() {
        List<String> calls = new ArrayList<>();

        ClockworkPlugin alpha = new ClockworkPlugin() {
            @Override
            public String name() { return "alpha"; }

            @Override
            public void register(ClockworkApp app, WorldApi world) {}

            @Override
            public void shutdown(ClockworkApp app, WorldApi world) { calls.add("shutdown:alpha"); }
        };

        ClockworkPlugin beta = new ClockworkPlugin() {
            @Override
            public String name() { return "beta"; }

            @Override
            public String[] depends() { return new String[]{"alpha"}; }

            @Override
            public void register(ClockworkApp app, WorldApi world) {}

            @Override
            public void shutdown(ClockworkApp app, WorldApi world) { calls.add("shutdown:beta"); }
        };

        ClockworkApp app = new ClockworkApp().use(beta).use(alpha).build();
        app.shutdown();

        assertEquals(List.of("shutdown:beta", "shutdown:alpha"), calls);
    }

    @Test
    void shutdownErrorDoesNotSilentlySwallow() {
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "failing-shutdown"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {}

                @Override
                public void shutdown(ClockworkApp app, WorldApi world) {
                    throw new RuntimeException("simulated shutdown failure");
                }
            })
            .build();

        assertThrows(ClockworkLifecycleException.class, app::shutdown);
    }

    @Test
    void shutdownWithNoPluginsDoesNotThrow() {
        ClockworkApp app = new ClockworkApp().build();
        assertDoesNotThrow(app::shutdown);
    }

    @Test
    void initIsCalledAfterAllPluginsRegister() {
        List<String> calls = new ArrayList<>();

        @SuppressWarnings("unused")
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "p1"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) { calls.add("register:p1"); }

                @Override
                public void init(ClockworkApp app, WorldApi world) { calls.add("init:p1"); }
            })
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "p2"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) { calls.add("register:p2"); }

                @Override
                public void init(ClockworkApp app, WorldApi world) { calls.add("init:p2"); }
            })
            .build();

        int lastRegister = Math.max(calls.indexOf("register:p1"), calls.indexOf("register:p2"));
        int firstInit = Math.min(calls.indexOf("init:p1"), calls.indexOf("init:p2"));
        assertTrue(lastRegister < firstInit,
            "All register() calls must complete before any init() call");
    }

    @Test
    void simulationThreadIsSetDuringStep() {
        AtomicBoolean correctThread = new AtomicBoolean(false);
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "thread-check"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.UPDATE, ctx -> {
                        correctThread.set(app.simulationThread() == Thread.currentThread());
                    });
                }
            })
            .build();

        app.step(1.0 / 60.0);
        assertTrue(correctThread.get());
    }

    @Test
    void worldCommandsAreAccessibleAfterBuild() {
        ClockworkApp app = new ClockworkApp().build();
        assertNotNull(app.world().commands());
    }

    @Test
    void resourcesInsertedDuringRegisterAreVisibleAfterBuild() {
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "res-test"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    world.resources().insert("smokeValue", 777);
                }
            })
            .build();

        assertEquals(777, app.world().resources().get("smokeValue").orElseThrow());
    }
}
