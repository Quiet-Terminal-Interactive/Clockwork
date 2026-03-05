package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.bench.StubWorldBackend;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.QueryResult;
import com.quietterminal.clockwork.math.Fixed;

import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertTrue;

class PerformanceBudgetTest {
    record Pos(int x, int y) {}
    record Vel(int dx, int dy) {}

    private static final int ENTITY_COUNT = 1_000;
    private static final long QUERY_BUDGET_MS = 10;
    private static final long SPAWN_BUDGET_MS = 15;
    private static final long STEP_BUDGET_MS = 50;

    @Test
    void queryAndIterateOneThousandEntitiesWithinBudget() {
        StubWorldBackend backend = new StubWorldBackend();
        Commands cmds = new Commands(backend);
        for (int i = 0; i < ENTITY_COUNT; i++) {
            cmds.spawn().with(new Pos(i, i)).with(new Vel(i, -i));
        }
        cmds.flush();

        ClockworkWorld world = new ClockworkWorld(backend);

        iterateAll(world);

        long start = System.nanoTime();
        int count = iterateAll(world);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertTrue(count == ENTITY_COUNT, "Expected " + ENTITY_COUNT + " results, got " + count);
        assertTrue(elapsedMs <= QUERY_BUDGET_MS,
            "Query + iterate " + ENTITY_COUNT + " entities took " + elapsedMs
            + "ms (budget: " + QUERY_BUDGET_MS + "ms)");
    }

    @Test
    void spawnOneThousandEntitiesWithinBudget() {
        StubWorldBackend backend = new StubWorldBackend();

        spawnBatch(backend, 100);

        backend = new StubWorldBackend();
        long start = System.nanoTime();
        spawnBatch(backend, ENTITY_COUNT);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertTrue(elapsedMs <= SPAWN_BUDGET_MS,
            "Spawning " + ENTITY_COUNT + " entities took " + elapsedMs
            + "ms (budget: " + SPAWN_BUDGET_MS + "ms)");
    }

    @Test
    void fixedPointMathBatchWithinBudget() {
        int iterations = 1_000_000;
        Fixed a = Fixed.from(1.5);
        Fixed b = Fixed.from(2.3);

        for (int i = 0; i < 1_000; i++) {
            Fixed.mul(a, b);
        }

        long start = System.nanoTime();
        Fixed result = Fixed.ZERO;
        for (int i = 0; i < iterations; i++) {
            result = Fixed.mul(a, b);
        }
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertTrue(result.raw() != 0, "Unexpected zero result");
        assertTrue(elapsedMs <= 500,
            iterations + " Fixed.mul calls took " + elapsedMs + "ms (budget: 500ms)");
    }

    @Test
    void fullBridgeStepWithOneHundredEntitiesWithinBudget() {
        AtomicInteger processed = new AtomicInteger();
        double frameDeltaSeconds = 1.0 / 30.0;
        ClockworkApp app = new ClockworkApp()
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "perf-test"; }

                @Override
                public void init(ClockworkApp app, WorldApi world) {
                    var cmds = world.commands();
                    for (int i = 0; i < 100; i++) {
                        cmds.spawn().with(new Pos(i, i)).with(new Vel(1, -1));
                    }
                    if (world instanceof ClockworkWorld clockworkWorld) {
                        clockworkWorld.commit(cmds);
                    } else {
                        cmds.flush();
                    }
                }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(com.quietterminal.clockwork.scheduler.Stage.FIXED_UPDATE, ctx -> {
                        for (@SuppressWarnings("unused") QueryResult<Pos, Vel, Void, Void> r :
                            ctx.world().query(Pos.class, Vel.class)) {
                            processed.incrementAndGet();
                        }
                    });
                }
            })
            .build();

        for (int i = 0; i < 5; i++) {
            app.step(frameDeltaSeconds);
        }
        processed.set(0);

        long start = System.nanoTime();
        app.step(frameDeltaSeconds);
        long elapsedMs = (System.nanoTime() - start) / 1_000_000;

        assertTrue(processed.get() > 0, "No entities were processed");
        assertTrue(elapsedMs <= STEP_BUDGET_MS,
            "app.step() with 100 entities took " + elapsedMs + "ms (budget: " + STEP_BUDGET_MS + "ms)");
    }

    private static int iterateAll(ClockworkWorld world) {
        int count = 0;
        int sink = 0;
        for (QueryResult<Pos, Vel, Void, Void> r : world.query(Pos.class, Vel.class)) {
            sink += r.a().x() + r.b().dx();
            count++;
        }
        if (sink == Integer.MIN_VALUE) throw new AssertionError("impossible");
        return count;
    }

    private static void spawnBatch(StubWorldBackend backend, int count) {
        Commands cmds = new Commands(backend);
        for (int i = 0; i < count; i++) {
            cmds.spawn().with(new Pos(i, i)).with(new Vel(i, i));
        }
        cmds.flush();
    }
}
