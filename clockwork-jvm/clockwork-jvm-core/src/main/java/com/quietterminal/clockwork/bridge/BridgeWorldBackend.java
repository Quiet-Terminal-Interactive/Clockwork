package com.quietterminal.clockwork.bridge;

import org.graalvm.polyglot.Value;
import org.graalvm.polyglot.proxy.ProxyExecutable;

import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.QuerySnapshot;
import com.quietterminal.clockwork.ecs.WorldBackend;
import com.quietterminal.clockwork.events.EventBus;
import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/** World backend bound to a JS world object inside GraalVM. */
public final class BridgeWorldBackend implements WorldBackend, EventBus.Bridge {
    private final Value world;
    private final Runnable threadGuard;
    private final ComponentSnapshotMapper mapper = new ComponentSnapshotMapper();
    private final List<ProxyExecutable> eventCallbacks = new CopyOnWriteArrayList<>();
    private volatile boolean closed;

    public BridgeWorldBackend(Value world, Runnable threadGuard) {
        this.world = Objects.requireNonNull(world, "world");
        this.threadGuard = Objects.requireNonNull(threadGuard, "threadGuard");
    }

    @Override
    public long reserveEntityId() {
        ensureOpen();
        try {
            return world.invokeMember("reserveEntityId").asLong();
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to reserve entity id.", e);
        }
    }

    @Override
    public void applyBatch(List<Commands.CommandOperation> operations) {
        ensureOpen();
        Objects.requireNonNull(operations, "operations");
        try {
            // Build the marshaled list locally; operations list must not be retained after return.
            List<Map<String, Object>> marshaled = new ArrayList<>(operations.size());
            for (int i = 0; i < operations.size(); i++) {
                marshaled.add(marshalOperation(operations.get(i)));
            }
            world.invokeMember("applyBatch", marshaled);
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to apply ECS command batch across bridge.", e);
        }
    }

    @Override
    public List<QuerySnapshot> query(List<Class<?>> required, List<Class<?>> optional, List<Class<?>> without) {
        ensureOpen();
        Objects.requireNonNull(required, "required");
        Objects.requireNonNull(optional, "optional");
        Objects.requireNonNull(without, "without");
        try {
            Value rows = world.invokeMember(
                "query",
                toTypeNames(required),
                toTypeNames(optional),
                toTypeNames(without)
            );
            int count = (int) rows.getArraySize();
            List<QuerySnapshot> snapshots = new ArrayList<>(count);
            for (int i = 0; i < count; i++) {
                Value row = rows.getArrayElement(i);
                long entity = row.getMember("entity").asLong();
                Value components = row.getMember("components");
                // HashMap beats LinkedHashMap here: order doesn't matter, less per-entry overhead.
                Map<Class<?>, Object> values = new HashMap<>(required.size() + optional.size() + 1);
                for (Class<?> type : required) {
                    values.put(type, componentForType(components, type));
                }
                for (Class<?> type : optional) {
                    values.put(type, componentForType(components, type));
                }
                snapshots.add(new QuerySnapshot(entity, values));
            }
            return snapshots;
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to query ECS snapshots across bridge.", e);
        }
    }

    @Override
    public Object snapshot() {
        ensureOpen();
        try {
            return valueToObject(world.invokeMember("snapshot"));
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to snapshot world state across bridge.", e);
        }
    }

    @Override
    public void restore(Object snapshot) {
        ensureOpen();
        Objects.requireNonNull(snapshot, "snapshot");
        try {
            world.invokeMember("restore", snapshot);
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to restore world state across bridge.", e);
        }
    }

    @Override
    public void emit(String eventType, Object payload) {
        ensureOpen();
        Objects.requireNonNull(eventType, "eventType");
        try {
            world.invokeMember("emitEvent", eventType, payload);
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to emit event across bridge.", e);
        }
    }

    @Override
    public void subscribe(String eventType, Consumer<Object> handler) {
        ensureOpen();
        Objects.requireNonNull(eventType, "eventType");
        Objects.requireNonNull(handler, "handler");
        ProxyExecutable callback = args -> {
            Object payload = args.length == 0 ? null : valueToObject(args[0]);
            handler.accept(payload);
            return null;
        };
        eventCallbacks.add(callback);
        try {
            world.invokeMember("subscribeEvent", eventType, callback);
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to subscribe event across bridge.", e);
        }
    }

    public void close() {
        if (closed) {
            return;
        }
        closed = true;
        eventCallbacks.clear();
    }

    public void enablePhysics(Object config) {
        ensureOpen();
        Objects.requireNonNull(config, "config");
        try {
            world.invokeMember("enablePhysics", config);
        } catch (RuntimeException e) {
            throw new ClockworkBridgeException("Failed to enable physics plugin bridge.", e);
        }
    }

    private Object componentForType(Value components, Class<?> type) {
        String key = type.getName();
        if (!components.hasMember(key)) {
            return null;
        }
        Value component = components.getMember(key);
        return mapper.map(component, type);
    }

    private static Map<String, Object> marshalOperation(Commands.CommandOperation operation) {
        return switch (operation) {
            case Commands.Spawn spawn -> Map.of("kind", "spawn", "entityId", spawn.entityId());
            case Commands.Despawn despawn -> Map.of("kind", "despawn", "entityId", despawn.entityId());
            case Commands.AddComponent add -> Map.of(
                "kind",
                "add",
                "entityId",
                add.entityId(),
                "typeName",
                add.component().getClass().getName(),
                "component",
                add.component()
            );
            case Commands.RemoveComponent remove -> Map.of(
                "kind",
                "remove",
                "entityId",
                remove.entityId(),
                "typeName",
                remove.componentType().getName()
            );
        };
    }

    private static Object valueToObject(Value value) {
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isHostObject()) {
            return value.asHostObject();
        }
        if (value.isString()) {
            return value.asString();
        }
        if (value.fitsInInt()) {
            return value.asInt();
        }
        if (value.fitsInLong()) {
            return value.asLong();
        }
        if (value.isBoolean()) {
            return value.asBoolean();
        }
        if (value.fitsInDouble()) {
            return value.asDouble();
        }
        return value;
    }

    private static String[] toTypeNames(List<Class<?>> types) {
        String[] names = new String[types.size()];
        for (int i = 0; i < types.size(); i++) {
            names[i] = types.get(i).getName();
        }
        return names;
    }

    private void ensureOpen() {
        threadGuard.run();
        if (closed) {
            throw new ClockworkBridgeException("World backend is closed.");
        }
    }
}
