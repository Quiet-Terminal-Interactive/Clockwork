package com.quietterminal.clockwork.bench;

import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.ClockworkWorld;
import com.quietterminal.clockwork.WorldApi;
import com.quietterminal.clockwork.ecs.Query;
import com.quietterminal.clockwork.ecs.QueryResult;
import com.quietterminal.clockwork.scheduler.Stage;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Param;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.annotations.TearDown;

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;

@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
public class BoundaryCrossingBenchmark {

    @Param({"0", "100", "1000"})
    public int entityCount;

    private ClockworkApp app;

    private final AtomicLong sink = new AtomicLong();

    @Setup
    public void setup() {
        app = new ClockworkApp()
            .use(new SetupPlugin(entityCount, sink))
            .build();
    }

    @TearDown
    public void teardown() {
        app.shutdown();
    }

    @Benchmark
    public long stepWithQuery() {
        app.step(1.0 / 60.0);
        return sink.get();
    }

    private static final class SetupPlugin implements ClockworkPlugin {
        private final int entityCount;
        private final AtomicLong sink;

        SetupPlugin(int entityCount, AtomicLong sink) {
            this.entityCount = entityCount;
            this.sink = sink;
        }

        @Override
        public String name() { return "boundary-bench-setup"; }

        @Override
        public void register(ClockworkApp app, WorldApi world) {
            var commands = world.commands();
            for (int i = 0; i < entityCount; i++) {
                commands.spawn()
                    .with(new BenchPosition(i, i))
                    .with(new BenchVelocity(1, -1))
                    .id();
            }
            ((ClockworkWorld) world).commit(commands);

            app.addSystem(Stage.UPDATE, ctx -> {
                Query<BenchPosition, BenchVelocity, Void, Void> q =
                    ctx.world().query(BenchPosition.class, BenchVelocity.class);
                long acc = 0;
                for (QueryResult<BenchPosition, BenchVelocity, Void, Void> r : q) {
                    acc += r.a().x() + r.b().x();
                }
                sink.set(acc);
            });
        }
    }

    record BenchPosition(int x, int y) {}
    record BenchVelocity(int x, int y) {}
}
