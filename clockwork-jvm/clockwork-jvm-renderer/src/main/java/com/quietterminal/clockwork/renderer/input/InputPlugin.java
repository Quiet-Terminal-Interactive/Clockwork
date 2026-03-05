package com.quietterminal.clockwork.renderer.input;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

import com.quietterminal.clockwork.ClockworkApp;
import com.quietterminal.clockwork.ClockworkPlugin;
import com.quietterminal.clockwork.ClockworkSystem;
import com.quietterminal.clockwork.WorldApi;
import com.quietterminal.clockwork.events.EventBus;
import com.quietterminal.clockwork.events.ResourceStore;
import com.quietterminal.clockwork.scheduler.Stage;
import com.quietterminal.clockwork.scheduler.SystemContext;

/**
 * Input bridge plugin: registers input resources and installs the flush system
 * that drains buffered GLFW events at the start of each UPDATE tick.
 *
 * If no InputMap is provided, raw events are still dispatched but no action or
 * axis events are generated.
 */
public final class InputPlugin implements ClockworkPlugin {
    private final InputMap inputMap;

    public InputPlugin() {
        this(new InputMap());
    }

    public InputPlugin(InputMap inputMap) {
        this.inputMap = Objects.requireNonNull(inputMap, "inputMap");
    }

    @Override
    public String name() {
        return "clockwork-input";
    }

    @Override
    public void register(ClockworkApp app, WorldApi world) {
        InputBuffer buffer = new InputBuffer();
        InputState state = new InputState();
        world.resources().insert(InputBuffer.KEY, buffer);
        world.resources().insert(InputState.KEY, state);
        world.resources().insert(InputMap.KEY, inputMap);

        // Flush runs first in UPDATE so all systems in that stage see this tick's events.
        app.addSystem(Stage.UPDATE, new InputFlushSystem());
    }

    /** Drains InputBuffer, updates InputState, emits events in FIFO order, then resolves axes. */
    private static final class InputFlushSystem implements ClockworkSystem {
        private final Map<String, Double> previousAxisValues = new HashMap<>();

        @Override
        public void execute(SystemContext ctx) {
            ResourceStore resources = ctx.resources();

            InputBuffer buffer = (InputBuffer) resources.get(InputBuffer.KEY).orElse(null);
            InputState state = (InputState) resources.get(InputState.KEY).orElse(null);
            InputMap map = (InputMap) resources.get(InputMap.KEY).orElse(null);
            if (buffer == null || state == null || map == null) {
                return;
            }

            EventBus events = ctx.events();
            List<Object> pending = buffer.drain();

            for (Object raw : pending) {
                dispatchAndUpdateState(raw, state, map, events);
            }

            state.recomputeAxes(map);

            for (InputMap.AxisBinding binding : map.allAxes()) {
                double current = state.axis(binding.axis);
                Double previous = previousAxisValues.get(binding.axis);
                if (previous == null || Double.compare(previous, current) != 0) {
                    previousAxisValues.put(binding.axis, current);
                    events.emit(new AxisChangedEvent(binding.axis, current));
                }
            }
        }

        private void dispatchAndUpdateState(Object raw, InputState state, InputMap map, EventBus events) {
            events.emit(raw);

            if (raw instanceof KeyPressedEvent e) {
                state.onKeyPress(e.key());
                for (InputMap.ActionBinding b : map.actionsForKey(e.key())) {
                    events.emit(new ActionFiredEvent(b.action));
                }
            } else if (raw instanceof KeyReleasedEvent e) {
                state.onKeyRelease(e.key());
            } else if (raw instanceof MouseButtonPressedEvent e) {
                state.onMouseButtonPress(e.button());
                for (InputMap.ActionBinding b : map.actionsForMouseButton(e.button())) {
                    events.emit(new ActionFiredEvent(b.action));
                }
            } else if (raw instanceof MouseButtonReleasedEvent e) {
                state.onMouseButtonRelease(e.button());
            } else if (raw instanceof MouseMovedEvent e) {
                state.onMouseMove(e.x(), e.y());
            } else if (raw instanceof WindowFocusEvent e) {
                state.onFocusChange(e.focused());
            } else if (raw instanceof GamepadAxisEvent e) {
                for (InputMap.AxisBinding binding : map.allAxes()) {
                    if (binding.gamepadAxis == e.axis()) {
                        double value = applyDeadzone(e.value(), binding.deadzone);
                        state.setGamepadAxis(binding.axis, value);
                    }
                }
            }
            // KeyRepeatEvent, MouseScrollEvent, TextInputEvent, GamepadButtonEvent,
            // GamepadEvent: already emitted above; no InputState mutation needed.
        }

        /** Zero out values inside the deadzone, then rescale the remaining range to [-1, 1]. */
        private static double applyDeadzone(float raw, float deadzone) {
            if (Math.abs(raw) < deadzone) {
                return 0.0;
            }
            double sign = raw > 0 ? 1.0 : -1.0;
            return sign * (Math.abs(raw) - deadzone) / (1.0 - deadzone);
        }
    }
}
