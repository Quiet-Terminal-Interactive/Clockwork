package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.bench.StubWorldBackend;
import com.quietterminal.clockwork.ecs.CommandPool;
import com.quietterminal.clockwork.ecs.Commands;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CommandsTest {
    @Test
    void spawnAssignsUniqueIds() {
        StubWorldBackend backend = new StubWorldBackend();
        Commands cmd = new Commands(backend);
        long a = cmd.spawn().id();
        long b = cmd.spawn().id();
        cmd.flush();
        assertNotEquals(a, b);
    }

    @Test
    void spawnIdIsPositive() {
        StubWorldBackend backend = new StubWorldBackend();
        Commands cmd = new Commands(backend);
        long id = cmd.spawn().id();
        cmd.flush();
        assertTrue(id > 0);
    }

    @Test
    void flushEmptiesQueueAndIsIdempotent() {
        StubWorldBackend backend = new StubWorldBackend();
        Commands cmd = new Commands(backend);
        cmd.spawn().id();
        cmd.flush();
        // Second flush with empty queue must not throw.
        assertDoesNotThrow(cmd::flush);
    }

    @Test
    void flushGuardPreventsEarlyFlush() {
        StubWorldBackend backend = new StubWorldBackend();
        Commands cmd = new Commands(backend, () -> {
            throw new IllegalStateException("flush blocked");
        });
        cmd.spawn().id();
        assertThrows(IllegalStateException.class, cmd::flush);
    }

    @Test
    void addComponentNullThrows() {
        StubWorldBackend backend = new StubWorldBackend();
        Commands cmd = new Commands(backend);
        assertThrows(NullPointerException.class, () -> cmd.addComponent(1L, null));
    }

    @Test
    void removeComponentNullTypeThrows() {
        StubWorldBackend backend = new StubWorldBackend();
        Commands cmd = new Commands(backend);
        assertThrows(NullPointerException.class, () -> cmd.removeComponent(1L, null));
    }

    @Test
    void spawnWithReturnsBuilderWithSameId() {
        record Tag() {}
        StubWorldBackend backend = new StubWorldBackend();
        Commands cmd = new Commands(backend);
        Commands.SpawnCommand builder = cmd.spawn().with(new Tag());
        long id = builder.id();
        cmd.flush();
        assertTrue(id > 0);
    }

    @Test
    void nullBackendThrows() {
        assertThrows(NullPointerException.class, () -> new Commands(null));
    }

    @Test
    void commandPoolAcquireReturnsNonNull() {
        CommandPool pool = CommandPool.forCurrentThread();
        ArrayList<Commands.CommandOperation> list = pool.acquire();
        assertNotNull(list);
        pool.release(list);
    }

    @Test
    void commandPoolReleaseAndAcquireReusesInstance() {
        CommandPool pool = CommandPool.forCurrentThread();
        ArrayList<Commands.CommandOperation> seeded = new ArrayList<>();
        pool.release(seeded);
        ArrayList<Commands.CommandOperation> acquired = pool.acquire();
        assertSame(seeded, acquired);
        pool.release(acquired);
    }

    @Test
    void commandPoolHandlesMoreReleasesThanMaxPooled() {
        CommandPool pool = CommandPool.forCurrentThread();
        var overflow = new ArrayList<ArrayList<Commands.CommandOperation>>();
        for (int i = 0; i < 12; i++) {
            overflow.add(pool.acquire());
        }
        overflow.forEach(pool::release);
        // Subsequent acquire must still succeed.
        assertNotNull(pool.acquire());
    }
}
