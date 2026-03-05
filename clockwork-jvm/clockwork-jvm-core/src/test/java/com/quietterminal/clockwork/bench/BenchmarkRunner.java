package com.quietterminal.clockwork.bench;

import com.quietterminal.clockwork.ClockworkWorld;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.Query;
import com.quietterminal.clockwork.ecs.QueryResult;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openjdk.jmh.results.RunResult;
import org.openjdk.jmh.runner.Runner;
import org.openjdk.jmh.runner.RunnerException;
import org.openjdk.jmh.runner.options.Options;
import org.openjdk.jmh.runner.options.OptionsBuilder;

import java.util.Collection;

import static org.junit.jupiter.api.Assertions.assertTrue;

class BenchmarkRunner {

    @Test
    void validateSpecTarget() {
        StubWorldBackend backend = new StubWorldBackend();
        ClockworkWorld world = new ClockworkWorld(backend);

        Commands setup = world.commands();
        for (int i = 0; i < 1000; i++) {
            setup.spawn().with(new Pos(i, i * 2)).with(new Vel(1, -1)).id();
        }
        world.commit(setup);

        for (int w = 0; w < 500; w++) {
            iterateAll(world);
        }

        long[] samples = new long[200];
        for (int i = 0; i < samples.length; i++) {
            long t0 = System.nanoTime();
            iterateAll(world);
            samples[i] = System.nanoTime() - t0;
        }

        long median = median(samples);
        long limitNanos = 1_000_000L;

        assertTrue(
            median < limitNanos,
            "Spec target missed: query+iterate over 1000 entities took " + (median / 1000) + "µs median " +
            "(limit: 1000µs). Snapshot serialisation may need revisiting."
        );
    }

    @Test
    @Tag("bench")
    void runEcsLayerBenchmarks() throws RunnerException {
        Options opts = new OptionsBuilder()
            .include(EntityScaleBenchmark.class.getSimpleName())
            .forks(1)
            .warmupIterations(3)
            .measurementIterations(5)
            .shouldFailOnError(true)
            .build();

        Collection<RunResult> results = new Runner(opts).run();
        assertTrue(!results.isEmpty(), "No benchmark results returned.");
    }

    @Test
    @Tag("bench")
    void runBridgeBenchmarks() throws RunnerException {
        if (!Boolean.getBoolean("bench.bridge")) {
            return;
        }

        Options opts = new OptionsBuilder()
            .include(BoundaryCrossingBenchmark.class.getSimpleName())
            .forks(1)
            .warmupIterations(3)
            .measurementIterations(5)
            .shouldFailOnError(true)
            .build();

        Collection<RunResult> results = new Runner(opts).run();
        assertTrue(!results.isEmpty(), "No benchmark results returned.");
    }

    private static long iterateAll(ClockworkWorld world) {
        Query<Pos, Vel, Void, Void> q = world.query(Pos.class, Vel.class);
        long acc = 0;
        for (QueryResult<Pos, Vel, Void, Void> r : q) {
            acc += r.a().x() + r.b().x();
        }
        return acc;
    }

    record Pos(int x, int y) {}
    record Vel(int x, int y) {}

    private static long median(long[] sorted) {
        long[] copy = sorted.clone();
        java.util.Arrays.sort(copy);
        return copy[copy.length / 2];
    }
}
