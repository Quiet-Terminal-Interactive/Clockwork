package com.quietterminal.clockwork.renderer.input;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Objects;

/**
 * Declares named action and axis bindings from raw input sources.
 * ActionFiredEvent is emitted whenever a bound key or button is pressed.
 * AxisChangedEvent is emitted when key-pair or gamepad axis values change.
 */
public final class InputMap {
    public static final String KEY = "input.map";

    /** A key or mouse button press that fires a named action. */
    public static final class ActionBinding {
        public final String action;
        public final Key key;
        public final MouseButton button;

        private ActionBinding(String action, Key key, MouseButton button) {
            this.action = action;
            this.key = key;
            this.button = button;
        }
    }

    /**
     * A named axis driven by a key pair or a gamepad axis.
     * Key pair: positive key = +1.0, negative key = -1.0, both = 0.0.
     * Gamepad axis: raw value with deadzone applied.
     */
    public static final class AxisBinding {
        public final String axis;
        public final Key positive;
        public final Key negative;
        public final int gamepadAxis;
        public final float deadzone;

        private AxisBinding(String axis, Key positive, Key negative, int gamepadAxis, float deadzone) {
            this.axis = axis;
            this.positive = positive;
            this.negative = negative;
            this.gamepadAxis = gamepadAxis;
            this.deadzone = deadzone;
        }
    }

    private final List<ActionBinding> actions = new ArrayList<>();
    private final List<AxisBinding> axes = new ArrayList<>();

    public InputMap bindAction(String action, Key key) {
        Objects.requireNonNull(action, "action");
        Objects.requireNonNull(key, "key");
        actions.add(new ActionBinding(action, key, null));
        return this;
    }

    public InputMap bindAction(String action, MouseButton button) {
        Objects.requireNonNull(action, "action");
        Objects.requireNonNull(button, "button");
        actions.add(new ActionBinding(action, null, button));
        return this;
    }

    /** Axis driven by keyboard: positive key = +1.0, negative key = -1.0. */
    public InputMap bindAxis(String axis, Key positive, Key negative) {
        Objects.requireNonNull(axis, "axis");
        Objects.requireNonNull(positive, "positive");
        Objects.requireNonNull(negative, "negative");
        axes.add(new AxisBinding(axis, positive, negative, -1, 0.0f));
        return this;
    }

    /** Axis driven by a gamepad physical axis with default 0.15 deadzone. */
    public InputMap bindAxis(String axis, int gamepadAxis) {
        return bindAxis(axis, gamepadAxis, 0.15f);
    }

    /** Axis driven by a gamepad physical axis with explicit deadzone. */
    public InputMap bindAxis(String axis, int gamepadAxis, float deadzone) {
        Objects.requireNonNull(axis, "axis");
        axes.add(new AxisBinding(axis, null, null, gamepadAxis, deadzone));
        return this;
    }

    /** All action bindings that fire for the given key. */
    public List<ActionBinding> actionsForKey(Key key) {
        List<ActionBinding> result = new ArrayList<>();
        for (ActionBinding b : actions) {
            if (b.key == key) result.add(b);
        }
        return result;
    }

    /** All action bindings that fire for the given mouse button. */
    public List<ActionBinding> actionsForMouseButton(MouseButton button) {
        List<ActionBinding> result = new ArrayList<>();
        for (ActionBinding b : actions) {
            if (b.button == button) result.add(b);
        }
        return result;
    }

    public List<AxisBinding> allAxes() {
        return Collections.unmodifiableList(axes);
    }
}
