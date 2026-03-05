package com.quietterminal.clockwork;

import java.util.List;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;

import com.quietterminal.clockwork.bridge.BridgeWorldBackend;
import com.quietterminal.clockwork.ecs.CommandPool;
import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.Query;
import com.quietterminal.clockwork.ecs.QuerySnapshot;
import com.quietterminal.clockwork.ecs.RawQuery;
import com.quietterminal.clockwork.ecs.WorldBackend;
import com.quietterminal.clockwork.events.EventBus;
import com.quietterminal.clockwork.events.ResourceStore;

/** Default world implementation backed by the bridge runtime. */
public final class ClockworkWorld implements WorldApi {
    private final WorldBackend backend;
    private final EventBus events = new EventBus();
    private final ResourceStore resources = new ResourceStore();
    private final AtomicBoolean executingSystem = new AtomicBoolean(false);

    public ClockworkWorld(WorldBackend backend) {
        this.backend = Objects.requireNonNull(backend, "backend");
        if (backend instanceof BridgeWorldBackend bridgeBackend) {
            events.attachBridge(bridgeBackend);
        }
    }

    @Override
    public <A> Query<A, Void, Void, Void> query(Class<A> a) {
        return new Query<>(this::fetchSnapshots, a, Void.class, Void.class, Void.class);
    }

    @Override
    public <A, B> Query<A, B, Void, Void> query(Class<A> a, Class<B> b) {
        return new Query<>(this::fetchSnapshots, a, b, Void.class, Void.class);
    }

    @Override
    public <A, B, C> Query<A, B, C, Void> query(Class<A> a, Class<B> b, Class<C> c) {
        return new Query<>(this::fetchSnapshots, a, b, c, Void.class);
    }

    @Override
    public <A, B, C, D> Query<A, B, C, D> query(Class<A> a, Class<B> b, Class<C> c, Class<D> d) {
        return new Query<>(this::fetchSnapshots, a, b, c, d);
    }

    @Override
    public RawQuery queryRaw(Class<?>... requiredComponents) {
        Objects.requireNonNull(requiredComponents, "requiredComponents");
        return new RawQuery(this::fetchSnapshots, List.of(requiredComponents));
    }

    @Override
    public Commands commands() {
        return new Commands(backend, this::assertFlushAllowed, CommandPool.forCurrentThread());
    }

    @Override
    public EventBus events() {
        return events;
    }

    @Override
    public ResourceStore resources() {
        return resources;
    }

    public void commit(Commands commands) {
        Objects.requireNonNull(commands, "commands");
        assertFlushAllowed();
        commands.flush();
    }

    @Override
    public Object serialize() {
        return backend.snapshot();
    }

    @Override
    public void restore(Object snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        if (executingSystem.get()) {
            throw new IllegalStateException("Cannot restore world state while a system is executing.");
        }
        backend.restore(snapshot);
    }

    public void close() {
        if (backend instanceof BridgeWorldBackend bridgeBackend) {
            bridgeBackend.close();
        }
    }

    public void enablePhysicsBridge(Object config) {
        if (backend instanceof BridgeWorldBackend bridgeBackend) {
            bridgeBackend.enablePhysics(config);
        }
    }

    private List<QuerySnapshot> fetchSnapshots(List<Class<?>> required, List<Class<?>> optional, List<Class<?>> without) {
        return backend.query(required, optional, without);
    }

    public void beginSystemExecution() {
        if (!executingSystem.compareAndSet(false, true)) {
            throw new IllegalStateException("System execution is re-entrant.");
        }
    }

    public void endSystemExecution() {
        executingSystem.set(false);
    }

    private void assertFlushAllowed() {
        if (executingSystem.get()) {
            throw new IllegalStateException(
                "Command flush is deferred until the current system returns."
            );
        }
    }
}
