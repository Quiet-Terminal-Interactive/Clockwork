package com.quietterminal.clockwork.ecs;

import java.util.ArrayList;
import java.util.Objects;

/** Buffered ECS command queue. */
public final class Commands {
    private final WorldBackend backend;
    private final Runnable flushGuard;
    private final CommandPool pool;
    // Non-final: reassigned after pool release in flush().
    private ArrayList<CommandOperation> queued;

    public Commands(WorldBackend backend) {
        this(backend, () -> {}, null);
    }

    public Commands(WorldBackend backend, Runnable flushGuard) {
        this(backend, flushGuard, null);
    }

    public Commands(WorldBackend backend, Runnable flushGuard, CommandPool pool) {
        this.backend = Objects.requireNonNull(backend, "backend");
        this.flushGuard = Objects.requireNonNull(flushGuard, "flushGuard");
        this.pool = pool;
        this.queued = pool != null ? pool.acquire() : new ArrayList<>();
    }

    public SpawnCommand spawn() {
        long id = backend.reserveEntityId();
        queued.add(new Spawn(id));
        return new SpawnCommand(this, id);
    }

    public void despawn(long entityId) {
        queued.add(new Despawn(entityId));
    }

    public void addComponent(long entityId, Object component) {
        queued.add(new AddComponent(entityId, Objects.requireNonNull(component, "component")));
    }

    public void removeComponent(long entityId, Class<?> componentType) {
        queued.add(new RemoveComponent(entityId, Objects.requireNonNull(componentType, "componentType")));
    }

    void attach(long entityId, Object component) {
        addComponent(entityId, component);
    }

    public void flush() {
        flushGuard.run();
        if (queued.isEmpty()) {
            return;
        }
        // Pass the live list — backend.applyBatch must not retain the reference after returning.
        backend.applyBatch(queued);
        if (pool != null) {
            pool.release(queued);
            queued = pool.acquire();
        } else {
            queued.clear();
        }
    }

    /** Spawn builder for queued entities. */
    public static final class SpawnCommand {
        private final Commands commands;
        private final long entityId;

        private SpawnCommand(Commands commands, long entityId) {
            this.commands = commands;
            this.entityId = entityId;
        }

        public SpawnCommand with(Object component) {
            commands.attach(entityId, component);
            return this;
        }

        public long id() {
            return entityId;
        }
    }

    public sealed interface CommandOperation permits Spawn, Despawn, AddComponent, RemoveComponent {
    }

    public record Spawn(long entityId) implements CommandOperation {
    }

    public record Despawn(long entityId) implements CommandOperation {
    }

    public record AddComponent(long entityId, Object component) implements CommandOperation {
    }

    public record RemoveComponent(long entityId, Class<?> componentType) implements CommandOperation {
    }
}
