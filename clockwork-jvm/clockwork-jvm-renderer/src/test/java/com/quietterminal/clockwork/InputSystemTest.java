package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;

import com.quietterminal.clockwork.renderer.input.ActionFiredEvent;
import com.quietterminal.clockwork.renderer.input.AxisChangedEvent;
import com.quietterminal.clockwork.renderer.input.InputBuffer;
import com.quietterminal.clockwork.renderer.input.InputMap;
import com.quietterminal.clockwork.renderer.input.InputPlugin;
import com.quietterminal.clockwork.renderer.input.InputState;
import com.quietterminal.clockwork.renderer.input.Key;
import com.quietterminal.clockwork.renderer.input.KeyPressedEvent;
import com.quietterminal.clockwork.renderer.input.KeyReleasedEvent;
import com.quietterminal.clockwork.renderer.input.MouseButton;
import com.quietterminal.clockwork.renderer.input.MouseButtonPressedEvent;
import com.quietterminal.clockwork.renderer.input.MouseButtonReleasedEvent;
import com.quietterminal.clockwork.renderer.input.MouseMovedEvent;
import com.quietterminal.clockwork.renderer.input.WindowFocusEvent;
import com.quietterminal.clockwork.scheduler.Stage;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class InputSystemTest {

    @Test
    void inputBufferDrainIsEmptyInitially() {
        InputBuffer buffer = new InputBuffer();
        assertTrue(buffer.drain().isEmpty());
    }

    @Test
    void inputBufferDrainReturnsFifoOrder() {
        InputBuffer buffer = new InputBuffer();
        buffer.enqueue("first");
        buffer.enqueue("second");
        buffer.enqueue("third");
        List<Object> drained = buffer.drain();
        assertEquals(List.of("first", "second", "third"), drained);
    }

    @Test
    void inputBufferDrainClearsQueue() {
        InputBuffer buffer = new InputBuffer();
        buffer.enqueue("event");
        buffer.drain();
        assertTrue(buffer.drain().isEmpty());
    }

    @Test
    void inputBufferKeyConstantIsSet() {
        assertEquals("input.buffer", InputBuffer.KEY);
    }

    @Test
    void inputStateKeyPressAndRelease() {
        InputState state = new InputState();
        state.onKeyPress(Key.W);
        assertTrue(state.isKeyHeld(Key.W));
        state.onKeyRelease(Key.W);
        assertFalse(state.isKeyHeld(Key.W));
    }

    @Test
    void inputStateMouseButtonPressAndRelease() {
        InputState state = new InputState();
        state.onMouseButtonPress(MouseButton.LEFT);
        assertTrue(state.isMouseButtonHeld(MouseButton.LEFT));
        state.onMouseButtonRelease(MouseButton.LEFT);
        assertFalse(state.isMouseButtonHeld(MouseButton.LEFT));
    }

    @Test
    void inputStateMouseMove() {
        InputState state = new InputState();
        state.onMouseMove(320.0, 240.0);
        assertEquals(320.0, state.mouseX(), 0.001);
        assertEquals(240.0, state.mouseY(), 0.001);
    }

    @Test
    void inputStateFocusLossClipsHeldKeysAndButtons() {
        InputState state = new InputState();
        state.onKeyPress(Key.A);
        state.onMouseButtonPress(MouseButton.RIGHT);
        state.onFocusChange(false);
        assertFalse(state.isKeyHeld(Key.A));
        assertFalse(state.isMouseButtonHeld(MouseButton.RIGHT));
        assertFalse(state.isFocused());
    }

    @Test
    void inputStateFocusRegain() {
        InputState state = new InputState();
        state.onFocusChange(false);
        state.onFocusChange(true);
        assertTrue(state.isFocused());
    }

    @Test
    void inputStateUnmappedAxisReturnsZero() {
        InputState state = new InputState();
        assertEquals(0.0, state.axis("nonexistent"), 0.001);
    }

    @Test
    void inputStateKeyPairAxisBothPressedCancelsOut() {
        InputMap map = new InputMap().bindAxis("horiz", Key.D, Key.A);
        InputState state = new InputState();
        state.onKeyPress(Key.D);
        state.onKeyPress(Key.A);
        state.recomputeAxes(map);
        assertEquals(0.0, state.axis("horiz"), 0.001);
    }

    @Test
    void inputStateKeyPairAxisPositiveOnly() {
        InputMap map = new InputMap().bindAxis("horiz", Key.D, Key.A);
        InputState state = new InputState();
        state.onKeyPress(Key.D);
        state.recomputeAxes(map);
        assertEquals(1.0, state.axis("horiz"), 0.001);
    }

    @Test
    void inputStateKeyPairAxisNegativeOnly() {
        InputMap map = new InputMap().bindAxis("horiz", Key.D, Key.A);
        InputState state = new InputState();
        state.onKeyPress(Key.A);
        state.recomputeAxes(map);
        assertEquals(-1.0, state.axis("horiz"), 0.001);
    }

    @Test
    void inputStateSetGamepadAxisValue() {
        InputState state = new InputState();
        state.setGamepadAxis("gamepad-x", 0.75);
        assertEquals(0.75, state.axis("gamepad-x"), 0.001);
    }

    @Test
    void inputMapBindActionKey() {
        InputMap map = new InputMap().bindAction("jump", Key.SPACE);
        List<InputMap.ActionBinding> actions = map.actionsForKey(Key.SPACE);
        assertEquals(1, actions.size());
        assertEquals("jump", actions.get(0).action);
    }

    @Test
    void inputMapBindActionMouseButton() {
        InputMap map = new InputMap().bindAction("fire", MouseButton.LEFT);
        List<InputMap.ActionBinding> actions = map.actionsForMouseButton(MouseButton.LEFT);
        assertEquals(1, actions.size());
        assertEquals("fire", actions.get(0).action);
    }

    @Test
    void inputMapActionsForKeyReturnsEmptyWhenUnbound() {
        InputMap map = new InputMap();
        assertTrue(map.actionsForKey(Key.ESCAPE).isEmpty());
    }

    @Test
    void inputMapActionsForMouseButtonReturnsEmptyWhenUnbound() {
        InputMap map = new InputMap();
        assertTrue(map.actionsForMouseButton(MouseButton.MIDDLE).isEmpty());
    }

    @Test
    void inputMapBindAxisKeyPairAppearsInAllAxes() {
        InputMap map = new InputMap().bindAxis("vertical", Key.W, Key.S);
        assertFalse(map.allAxes().isEmpty());
        assertEquals("vertical", map.allAxes().get(0).axis);
    }

    @Test
    void inputMapAllAxesIsUnmodifiable() {
        InputMap map = new InputMap().bindAxis("x", Key.D, Key.A);
        assertFalse(map.allAxes().isEmpty());
        try {
            map.allAxes().clear();
            throw new AssertionError("Expected UnsupportedOperationException");
        } catch (UnsupportedOperationException ignored) {
            // expected
        }
    }

    @Test
    void inputMapBindAxisGamepadDefaultDeadzone() {
        InputMap map = new InputMap().bindAxis("gamepad-x", 0);
        List<InputMap.AxisBinding> axes = map.allAxes();
        assertEquals(1, axes.size());
        assertEquals(0.15f, axes.get(0).deadzone, 0.001f);
    }

    @Test
    void inputPluginRegistersResourcesAndSetsName() {
        List<String> registered = new ArrayList<>();
        @SuppressWarnings("unused")
        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin())
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "verifier"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    if (world.resources().get(InputBuffer.KEY).isPresent()) {
                        registered.add("buffer");
                    }
                    if (world.resources().get(InputState.KEY).isPresent()) {
                        registered.add("state");
                    }
                    if (world.resources().get(InputMap.KEY).isPresent()) {
                        registered.add("map");
                    }
                }
            })
            .build();

        assertEquals(List.of("buffer", "state", "map"), registered);
        assertEquals("clockwork-input", new InputPlugin().name());
    }

    @Test
    void inputPluginFlushesBufferAndUpdatesStateOnStep() {
        AtomicReference<Boolean> wObserved = new AtomicReference<>(false);
        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin())
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "observer"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.UPDATE, ctx -> {
                        InputState state = ctx.resources()
                            .get(InputState.KEY)
                            .map(s -> (InputState) s)
                            .orElse(null);
                        assertNotNull(state);
                        wObserved.set(state.isKeyHeld(Key.W));
                    });
                }
            })
            .build();

        InputBuffer buffer = app.world().resources()
            .get(InputBuffer.KEY)
            .map(b -> (InputBuffer) b)
            .orElseThrow();

        buffer.enqueue(new KeyPressedEvent(Key.W));
        app.step(1.0 / 60.0);

        assertTrue(wObserved.get());
    }

    @Test
    void inputPluginEmitsActionFiredEventOnBoundKeyPress() {
        List<String> fired = new ArrayList<>();
        InputMap map = new InputMap().bindAction("jump", Key.SPACE);

        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin(map))
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "action-watcher"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    world.events().subscribe(ActionFiredEvent.class,
                        e -> fired.add(e.action()));
                }
            })
            .build();

        InputBuffer buffer = app.world().resources()
            .get(InputBuffer.KEY)
            .map(b -> (InputBuffer) b)
            .orElseThrow();

        buffer.enqueue(new KeyPressedEvent(Key.SPACE));
        app.step(1.0 / 60.0);

        assertEquals(List.of("jump"), fired);
    }

    @Test
    void inputPluginEmitsAxisChangedEventOnKeyPairChange() {
        List<Double> axisValues = new ArrayList<>();
        InputMap map = new InputMap().bindAxis("move", Key.D, Key.A);

        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin(map))
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "axis-watcher"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    world.events().subscribe(AxisChangedEvent.class,
                        e -> axisValues.add(e.value()));
                }
            })
            .build();

        InputBuffer buffer = app.world().resources()
            .get(InputBuffer.KEY)
            .map(b -> (InputBuffer) b)
            .orElseThrow();

        buffer.enqueue(new KeyPressedEvent(Key.D));
        app.step(1.0 / 60.0);

        assertFalse(axisValues.isEmpty());
        assertEquals(1.0, axisValues.get(axisValues.size() - 1), 0.001);
    }

    @Test
    void inputPluginFocusLossClipsHeldState() {
        AtomicReference<Boolean> wHeld = new AtomicReference<>(true);

        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin())
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "focus-obs"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.UPDATE, ctx -> {
                        InputState state = ctx.resources()
                            .get(InputState.KEY)
                            .map(s -> (InputState) s)
                            .orElse(null);
                        assertNotNull(state);
                        wHeld.set(state.isKeyHeld(Key.W));
                    });
                }
            })
            .build();

        InputBuffer buffer = app.world().resources()
            .get(InputBuffer.KEY)
            .map(b -> (InputBuffer) b)
            .orElseThrow();

        buffer.enqueue(new KeyPressedEvent(Key.W));
        buffer.enqueue(new WindowFocusEvent(false));
        app.step(1.0 / 60.0);

        assertFalse(wHeld.get());
    }

    @Test
    void rawKeyEventsAreEmittedThroughEventBus() {
        List<Key> pressedKeys = new ArrayList<>();

        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin())
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "key-watcher"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    world.events().subscribe(KeyPressedEvent.class,
                        e -> pressedKeys.add(e.key()));
                }
            })
            .build();

        InputBuffer buffer = app.world().resources()
            .get(InputBuffer.KEY)
            .map(b -> (InputBuffer) b)
            .orElseThrow();

        buffer.enqueue(new KeyPressedEvent(Key.ENTER));
        app.step(1.0 / 60.0);

        assertEquals(List.of(Key.ENTER), pressedKeys);
    }

    @Test
    void mouseMovedEventUpdatesInputState() {
        AtomicReference<Double> observedX = new AtomicReference<>(0.0);

        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin())
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "mouse-obs"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.UPDATE, ctx -> {
                        InputState state = ctx.resources()
                            .get(InputState.KEY)
                            .map(s -> (InputState) s)
                            .orElse(null);
                        assertNotNull(state);
                        observedX.set(state.mouseX());
                    });
                }
            })
            .build();

        InputBuffer buffer = app.world().resources()
            .get(InputBuffer.KEY)
            .map(b -> (InputBuffer) b)
            .orElseThrow();

        buffer.enqueue(new MouseMovedEvent(512.0, 300.0));
        app.step(1.0 / 60.0);

        assertEquals(512.0, observedX.get(), 0.001);
    }

    @Test
    void keyReleasedEventUpdatesInputState() {
        AtomicReference<Boolean> dHeld = new AtomicReference<>(true);

        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin())
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "release-obs"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.UPDATE, ctx -> {
                        InputState state = ctx.resources()
                            .get(InputState.KEY)
                            .map(s -> (InputState) s)
                            .orElse(null);
                        assertNotNull(state);
                        dHeld.set(state.isKeyHeld(Key.D));
                    });
                }
            })
            .build();

        InputBuffer buffer = app.world().resources()
            .get(InputBuffer.KEY)
            .map(b -> (InputBuffer) b)
            .orElseThrow();

        buffer.enqueue(new KeyPressedEvent(Key.D));
        buffer.enqueue(new KeyReleasedEvent(Key.D));
        app.step(1.0 / 60.0);

        assertFalse(dHeld.get());
    }

    @Test
    void mouseButtonReleasedUpdatesInputState() {
        AtomicReference<Boolean> leftHeld = new AtomicReference<>(true);

        ClockworkApp app = new ClockworkApp()
            .use(new InputPlugin())
            .use(new ClockworkPlugin() {
                @Override
                public String name() { return "mb-obs"; }

                @Override
                public void register(ClockworkApp app, WorldApi world) {
                    app.addSystem(Stage.UPDATE, ctx -> {
                        InputState state = ctx.resources()
                            .get(InputState.KEY)
                            .map(s -> (InputState) s)
                            .orElse(null);
                        assertNotNull(state);
                        leftHeld.set(state.isMouseButtonHeld(MouseButton.LEFT));
                    });
                }
            })
            .build();

        InputBuffer buffer = app.world().resources()
            .get(InputBuffer.KEY)
            .map(b -> (InputBuffer) b)
            .orElseThrow();

        buffer.enqueue(new MouseButtonPressedEvent(MouseButton.LEFT, 0, 0));
        buffer.enqueue(new MouseButtonReleasedEvent(MouseButton.LEFT, 0, 0));
        app.step(1.0 / 60.0);

        assertFalse(leftHeld.get());
    }
}
