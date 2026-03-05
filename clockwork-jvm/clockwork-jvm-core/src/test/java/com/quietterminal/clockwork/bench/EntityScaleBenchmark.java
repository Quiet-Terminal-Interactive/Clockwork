package com.quietterminal.clockwork.bench;

import com.quietterminal.clockwork.ClockworkWorld;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.Query;
import com.quietterminal.clockwork.ecs.QueryResult;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Param;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;

import java.util.concurrent.TimeUnit;

@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
public class EntityScaleBenchmark {

    @Param({"1000", "10000", "50000"})
    public int entityCount;

    private ClockworkWorld world;

    @Setup
    public void setup() {
        StubWorldBackend backend = new StubWorldBackend();
        world = new ClockworkWorld(backend);

        Commands commands = world.commands();
        for (int i = 0; i < entityCount; i++) {
            commands.spawn()
                .with(new Position(i, i * 2))
                .with(new Velocity(1, -1))
                .id();
        }
        world.commit(commands);
    }

    @Benchmark
    public long queryAndIterate() {
        Query<Position, Velocity, Void, Void> query = world.query(Position.class, Velocity.class);
        long sum = 0;
        for (QueryResult<Position, Velocity, Void, Void> r : query) {
            sum += r.a().x() + r.b().x();
        }
        return sum;
    }

    @Benchmark
    public void commandsRoundTrip() {
        Commands spawn = world.commands();
        long id = spawn.spawn().with(new Position(0, 0)).with(new Velocity(0, 0)).id();
        world.commit(spawn);

        Commands despawn = world.commands();
        despawn.despawn(id);
        world.commit(despawn);
    }

    record Position(int x, int y) {}
    record Velocity(int x, int y) {}
}
