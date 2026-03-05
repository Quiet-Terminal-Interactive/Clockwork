package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.scheduler.Stage;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SystemTest {
    @Test
    void executeReceivesTickAndContext() {
        AtomicLong observedTick = new AtomicLong();
        AtomicLong observedValue = new AtomicLong();

        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "system-test";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    world.resources().insert("counter", 123L);
                    app.addSystem(Stage.UPDATE, ctx -> {
                        observedTick.set(ctx.tick());
                        observedValue.set((Long) ctx.resources().get("counter").orElse(0L));
                    });
                }
            })
            .build();

        app.step(1.0 / 60.0);

        assertEquals(1L, observedTick.get());
        assertEquals(123L, observedValue.get());
    }

    @Test
    void systemsRunInStageOrderThroughBridgeScheduler() {
        List<String> order = new ArrayList<>();
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "stage-order";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.FIXED_UPDATE, ctx -> order.add("fixed"));
                    app.addSystem(Stage.UPDATE, ctx -> order.add("update"));
                    app.addSystem(Stage.RENDER, ctx -> order.add("render"));
                }
            })
            .build();

        app.step(1.0 / 60.0);

        assertEquals(List.of("fixed", "update", "render"), order);
    }

    @Test
    void fixedUpdateUsesAccumulatorAndCatchUpClamp() {
        AtomicLong fixedCalls = new AtomicLong();
        AtomicLong updateCalls = new AtomicLong();
        AtomicLong renderCalls = new AtomicLong();

        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "fixed-accumulator";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.FIXED_UPDATE, ctx -> fixedCalls.incrementAndGet());
                    app.addSystem(Stage.UPDATE, ctx -> updateCalls.incrementAndGet());
                    app.addSystem(Stage.RENDER, ctx -> renderCalls.incrementAndGet());
                }
            })
            .build();

        app.step(0.5);

        assertEquals(8L, fixedCalls.get());
        assertEquals(1L, updateCalls.get());
        assertEquals(1L, renderCalls.get());
    }

    @Test
    void commandFlushInsideSystemIsRejected() {
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "flush-guard";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.UPDATE, ctx -> ctx.commands().flush());
                }
            })
            .build();

        assertThrows(RuntimeException.class, () -> app.step(1.0 / 60.0));
    }

    @Test
    void commandsFlushDeterministicallyBetweenSystems() {
        List<Integer> seenCounts = new ArrayList<>();

        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() {
                    return "flush-order";
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.FIXED_UPDATE, ctx -> {
                        if (ctx.tick() == 1) {
                            ctx.commands().spawn().with(new Marker()).id();
                        }
                    });
                    app.addSystem(Stage.UPDATE, ctx -> {
                        int count = 0;
                        for (@SuppressWarnings("unused") var ignored : ctx.world().query(Marker.class)) {
                            count += 1;
                        }
                        seenCounts.add(count);
                    });
                    app.addSystem(Stage.RENDER, ctx -> {
                        int count = 0;
                        for (@SuppressWarnings("unused") var ignored : ctx.world().query(Marker.class)) {
                            count += 1;
                        }
                        seenCounts.add(count);
                    });
                }
            })
            .build();

        app.step(1.0 / 60.0);

        assertEquals(List.of(1, 1), seenCounts);
    }

    record Marker() {
    }
}
