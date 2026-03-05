package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.events.EventBus;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class EventBusTest {
    record PingEvent(String msg) {}
    record OtherEvent(int n) {}

    @Test
    void subscribedHandlerReceivesEmittedEvent() {
        EventBus bus = new EventBus();
        AtomicReference<PingEvent> received = new AtomicReference<>();
        bus.subscribe(PingEvent.class, received::set);
        bus.emit(new PingEvent("hello"));
        assertEquals("hello", received.get().msg());
    }

    @Test
    void handlerNotCalledForDifferentEventType() {
        EventBus bus = new EventBus();
        AtomicInteger count = new AtomicInteger();
        bus.subscribe(PingEvent.class, e -> count.incrementAndGet());
        bus.emit(new OtherEvent(99));
        assertEquals(0, count.get());
    }

    @Test
    void multipleHandlersForSameTypeAllReceiveEvent() {
        EventBus bus = new EventBus();
        AtomicInteger count = new AtomicInteger();
        bus.subscribe(PingEvent.class, e -> count.incrementAndGet());
        bus.subscribe(PingEvent.class, e -> count.incrementAndGet());
        bus.emit(new PingEvent("x"));
        assertEquals(2, count.get());
    }

    @Test
    void emitNullThrows() {
        EventBus bus = new EventBus();
        assertThrows(NullPointerException.class, () -> bus.emit(null));
    }

    @Test
    void subscribeNullTypeThrows() {
        EventBus bus = new EventBus();
        assertThrows(NullPointerException.class, () -> bus.subscribe(null, e -> {}));
    }

    @Test
    void subscribeNullHandlerThrows() {
        EventBus bus = new EventBus();
        assertThrows(NullPointerException.class, () -> bus.subscribe(PingEvent.class, null));
    }

    @Test
    void emitWithNoBridgeDoesNotThrow() {
        EventBus bus = new EventBus();
        assertDoesNotThrow(() -> bus.emit(new PingEvent("no-bridge")));
    }

    @Test
    void attachBridgeSubscribesPreExistingHandlers() {
        EventBus bus = new EventBus();
        AtomicInteger bridgeSubscribeCalls = new AtomicInteger();
        AtomicReference<String> bridgeEmitType = new AtomicReference<>();

        bus.subscribe(PingEvent.class, e -> {});

        bus.attachBridge(new EventBus.Bridge() {
            @Override
            public void emit(String eventType, Object payload) {
                bridgeEmitType.set(eventType);
            }

            @Override
            public void subscribe(String eventType, Consumer<Object> handler) {
                bridgeSubscribeCalls.incrementAndGet();
            }
        });

        assertEquals(1, bridgeSubscribeCalls.get());
        bus.emit(new PingEvent("bridge-test"));
        assertEquals(PingEvent.class.getName(), bridgeEmitType.get());
    }

    @Test
    void bridgeEmitCalledForEveryEmit() {
        EventBus bus = new EventBus();
        AtomicInteger emitCount = new AtomicInteger();

        bus.attachBridge(new EventBus.Bridge() {
            @Override
            public void emit(String eventType, Object payload) {
                emitCount.incrementAndGet();
            }

            @Override
            public void subscribe(String eventType, Consumer<Object> handler) {}
        });

        bus.emit(new PingEvent("a"));
        bus.emit(new PingEvent("b"));
        assertEquals(2, emitCount.get());
    }

    @Test
    void newSubscriptionAfterBridgeAttachIsForwardedToBridge() {
        EventBus bus = new EventBus();
        AtomicInteger bridgeSubscribeCalls = new AtomicInteger();

        bus.attachBridge(new EventBus.Bridge() {
            @Override
            public void emit(String eventType, Object payload) {}

            @Override
            public void subscribe(String eventType, Consumer<Object> handler) {
                bridgeSubscribeCalls.incrementAndGet();
            }
        });

        bus.subscribe(PingEvent.class, e -> {});
        assertEquals(1, bridgeSubscribeCalls.get());
    }

    @Test
    void sameTypeSubscribedTwiceOnlyBridgesOnce() {
        EventBus bus = new EventBus();
        AtomicInteger bridgeSubscribeCalls = new AtomicInteger();

        bus.attachBridge(new EventBus.Bridge() {
            @Override
            public void emit(String eventType, Object payload) {}

            @Override
            public void subscribe(String eventType, Consumer<Object> handler) {
                bridgeSubscribeCalls.incrementAndGet();
            }
        });

        bus.subscribe(PingEvent.class, e -> {});
        bus.subscribe(PingEvent.class, e -> {});
        assertEquals(1, bridgeSubscribeCalls.get());
    }
}
