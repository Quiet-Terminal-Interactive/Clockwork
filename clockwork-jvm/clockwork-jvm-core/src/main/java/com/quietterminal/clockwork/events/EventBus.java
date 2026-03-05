package com.quietterminal.clockwork.events;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

/** Type-safe event bus. */
public final class EventBus {
    private final Map<Class<?>, List<Consumer<?>>> handlers = new ConcurrentHashMap<>();
    private final Set<Class<?>> bridgedTypes = ConcurrentHashMap.newKeySet();
    private volatile Bridge bridge;
    /** True while a Java-originated emit is being forwarded to the bridge, to prevent re-dispatch. */
    private final ThreadLocal<Boolean> forwardingToBridge = ThreadLocal.withInitial(() -> false);

    public <T> void subscribe(Class<T> type, Consumer<T> handler) {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(handler, "handler");
        handlers.computeIfAbsent(type, ignored -> new CopyOnWriteArrayList<>()).add(handler);
        subscribeBridgeIfNeeded(type);
    }

    public void emit(Object event) {
        Objects.requireNonNull(event, "event");
        dispatch(event.getClass(), event);
        Bridge localBridge = bridge;
        if (localBridge != null) {
            forwardingToBridge.set(true);
            try {
                localBridge.emit(event.getClass().getName(), event);
            } finally {
                forwardingToBridge.set(false);
            }
        }
    }

    public void attachBridge(Bridge bridge) {
        this.bridge = Objects.requireNonNull(bridge, "bridge");
        for (Class<?> type : handlers.keySet()) {
            subscribeBridgeIfNeeded(type);
        }
    }

    private void dispatch(Class<?> type, Object payload) {
        if (payload != null && !type.isInstance(payload)) {
            return;
        }
        List<Consumer<?>> listeners = handlers.get(type);
        if (listeners == null) {
            return;
        }
        for (Consumer<?> listener : listeners) {
            @SuppressWarnings("unchecked")
            Consumer<Object> typedListener = (Consumer<Object>) listener;
            typedListener.accept(payload);
        }
    }

    private void subscribeBridgeIfNeeded(Class<?> type) {
        Bridge localBridge = bridge;
        if (localBridge == null) {
            return;
        }
        if (!bridgedTypes.add(type)) {
            return;
        }
        localBridge.subscribe(type.getName(), payload -> {
            if (!forwardingToBridge.get()) {
                dispatch(type, payload);
            }
        });
    }

    public interface Bridge {
        void emit(String eventType, Object payload);

        void subscribe(String eventType, Consumer<Object> handler);
    }
}
