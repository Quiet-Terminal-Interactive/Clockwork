package com.quietterminal.clockwork.bench;

import com.quietterminal.clockwork.ecs.Commands;
import com.quietterminal.clockwork.ecs.QuerySnapshot;
import com.quietterminal.clockwork.ecs.WorldBackend;
import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicLong;

public final class StubWorldBackend implements WorldBackend {
    private final AtomicLong idGen = new AtomicLong(1);
    private final Map<Long, Map<Class<?>, Object>> entities = new HashMap<>();

    @Override
    public long reserveEntityId() {
        return idGen.getAndIncrement();
    }

    @Override
    public void applyBatch(List<Commands.CommandOperation> operations) {
        List<Commands.CommandOperation> applied = new ArrayList<>(operations.size());
        try {
            for (Commands.CommandOperation op : operations) {
                applyOne(op);
                applied.add(op);
            }
        } catch (RuntimeException e) {
            for (int i = applied.size() - 1; i >= 0; i--) {
                rollbackOne(applied.get(i));
            }
            throw new ClockworkBridgeException("Batch apply failed; rolled back " + applied.size() + " operations.", e);
        }
    }

    @Override
    public List<QuerySnapshot> query(List<Class<?>> required, List<Class<?>> optional, List<Class<?>> without) {
        List<QuerySnapshot> result = new ArrayList<>();
        for (Map.Entry<Long, Map<Class<?>, Object>> entry : entities.entrySet()) {
            Map<Class<?>, Object> comps = entry.getValue();
            if (!hasAll(comps, required) || hasAny(comps, without)) {
                continue;
            }
            Map<Class<?>, Object> snapshot = new HashMap<>(required.size() + optional.size() + 1);
            for (Class<?> type : required) {
                snapshot.put(type, comps.get(type));
            }
            for (Class<?> type : optional) {
                snapshot.put(type, comps.get(type));
            }
            result.add(new QuerySnapshot(entry.getKey(), snapshot));
        }
        return result;
    }

    private void applyOne(Commands.CommandOperation op) {
        switch (op) {
            case Commands.Spawn spawn -> {
                if (entities.containsKey(spawn.entityId())) {
                    throw new IllegalStateException("Entity already exists: " + spawn.entityId());
                }
                entities.put(spawn.entityId(), new HashMap<>());
            }
            case Commands.Despawn despawn -> {
                if (!entities.containsKey(despawn.entityId())) {
                    throw new IllegalStateException("Entity not found: " + despawn.entityId());
                }
                entities.remove(despawn.entityId());
            }
            case Commands.AddComponent add ->
                entities.computeIfPresent(add.entityId(), (id, comps) -> {
                    comps.put(add.component().getClass(), add.component());
                    return comps;
                });
            case Commands.RemoveComponent remove ->
                entities.computeIfPresent(remove.entityId(), (id, comps) -> {
                    comps.remove(remove.componentType());
                    return comps;
                });
        }
    }

    private void rollbackOne(Commands.CommandOperation op) {
        switch (op) {
            case Commands.Spawn spawn -> entities.remove(spawn.entityId());
            default -> { /* despawn/add/remove rollback omitted — stub only */ }
        }
    }

    private static boolean hasAll(Map<Class<?>, Object> comps, List<Class<?>> types) {
        for (Class<?> t : types) {
            if (!comps.containsKey(t)) return false;
        }
        return true;
    }

    private static boolean hasAny(Map<Class<?>, Object> comps, List<Class<?>> types) {
        for (Class<?> t : types) {
            if (comps.containsKey(t)) return true;
        }
        return false;
    }
}
