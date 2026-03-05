package com.quietterminal.clockwork;

import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.ecs.QueryResult;
import com.quietterminal.clockwork.scheduler.Stage;

import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@Tag("soak")
class SoakTest {
    record Pos(int x, int y) {}
    record Vel(int dx, int dy) {}

    private static final int SOAK_TICKS = 10_000;
    private static final double FIXED_DELTA = 1.0 / 60.0;

    @Test
    void engineRunsManyTicksWithoutException() {
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "soak-plugin"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    var cmds = world.commands();
                    for (int i = 0; i < 100; i++) {
                        cmds.spawn()
                            .with(new Pos(i, i))
                            .with(new Vel(1, -1));
                    }
                }

                @Override
                public void init(ClockworkApp app, WorldApi world) {
                    var cmds = world.commands();
                    for (int i = 0; i < 100; i++) {
                        cmds.spawn()
                            .with(new Pos(i * 2, i * 2))
                            .with(new Vel(i % 3 - 1, i % 5 - 2));
                    }
                }
            })
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "soak-system"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.FIXED_UPDATE, ctx -> {
                        int sum = 0;
                        for (QueryResult<Pos, Vel, Void, Void> r :
                            ctx.world().query(Pos.class, Vel.class)) {
                            sum += r.a().x() + r.b().dx();
                        }
                        if (sum == Integer.MIN_VALUE) throw new AssertionError("impossible");
                    });
                }
            })
            .build();

        for (int i = 0; i < SOAK_TICKS; i++) {
            app.step(FIXED_DELTA);
        }

        assertEquals(SOAK_TICKS, app.tick());
    }

    @Test
    void commandPoolDoesNotLeakListsOverManyTicks() {
        AtomicLong spawnCount = new AtomicLong();

        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "spawn-despawn"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.FIXED_UPDATE, ctx -> {
                        for (QueryResult<Pos, Void, Void, Void> r : ctx.world().query(Pos.class)) {
                            ctx.commands().despawn(r.entity());
                        }
                        ctx.commands().spawn().with(new Pos((int) ctx.tick(), 0));
                        spawnCount.incrementAndGet();
                    });
                }
            })
            .build();

        long heapBefore = usedHeapMb();
        for (int i = 0; i < SOAK_TICKS; i++) {
            app.step(FIXED_DELTA);
        }
        System.gc();
        long heapAfter = usedHeapMb();

        long growthMb = heapAfter - heapBefore;
        assertTrue(growthMb < 64,
            "Heap grew by " + growthMb + " MB over " + SOAK_TICKS + " ticks. Likely a memory leak.");
        assertEquals(SOAK_TICKS, spawnCount.get());
    }

    @Test
    void noExceptionOnHighFixedUpdateAccumulation() {
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "big-delta"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.FIXED_UPDATE, ctx -> {});
                }
            })
            .build();

        for (int i = 0; i < 100; i++) {
            app.step(10.0);
        }

        assertEquals(100L, app.tick());
    }

    private static long usedHeapMb() {
        Runtime rt = Runtime.getRuntime();
        return (rt.totalMemory() - rt.freeMemory()) / (1024 * 1024);
    }
}
