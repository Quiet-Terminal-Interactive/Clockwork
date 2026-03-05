package com.quietterminal.clockwork.renderer.input;

import java.util.Collections;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Snapshot of current input state: which keys and buttons are held,
 * cursor position, and resolved axis values from the InputMap.
 * Updated by InputFlushSystem at the start of each tick.
 */
public final class InputState {
    public static final String KEY = "input.state";

    private final Set<Key> heldKeys = EnumSet.noneOf(Key.class);
    private final Set<MouseButton> heldButtons = EnumSet.noneOf(MouseButton.class);
    private final Map<String, Double> axes = new HashMap<>();
    private double mouseX;
    private double mouseY;
    private boolean focused = true;

    public boolean isKeyHeld(Key key) {
        return heldKeys.contains(key);
    }

    public boolean isMouseButtonHeld(MouseButton button) {
        return heldButtons.contains(button);
    }

    public double mouseX() {
        return mouseX;
    }

    public double mouseY() {
        return mouseY;
    }

    /** Current value of a named axis in [-1.0, 1.0], or 0.0 if unmapped. */
    public double axis(String name) {
        return axes.getOrDefault(name, 0.0);
    }

    /** Returns true while the window has OS focus. All held state is cleared on focus loss. */
    public boolean isFocused() {
        return focused;
    }

    public void onKeyPress(Key key) {
        heldKeys.add(key);
    }

    public void onKeyRelease(Key key) {
        heldKeys.remove(key);
    }

    public void onMouseButtonPress(MouseButton button) {
        heldButtons.add(button);
    }

    public void onMouseButtonRelease(MouseButton button) {
        heldButtons.remove(button);
    }

    public void onMouseMove(double x, double y) {
        mouseX = x;
        mouseY = y;
    }

    public void onFocusChange(boolean gained) {
        focused = gained;
        if (!gained) {
            // Synthetic releases are not emitted here — held state is simply cleared.
            // Systems that need release events should subscribe to WindowFocusEvent instead.
            heldKeys.clear();
            heldButtons.clear();
        }
    }

    /**
     * Recomputes all key-pair axes from current held state.
     * Gamepad axis values are injected directly via setGamepadAxis().
     */
    public void recomputeAxes(InputMap inputMap) {
        for (InputMap.AxisBinding binding : inputMap.allAxes()) {
            if (binding.positive != null && binding.negative != null) {
                double value = 0.0;
                if (heldKeys.contains(binding.positive)) value += 1.0;
                if (heldKeys.contains(binding.negative)) value -= 1.0;
                axes.put(binding.axis, value);
            }
        }
    }

    public void setGamepadAxis(String axisName, double value) {
        axes.put(axisName, value);
    }

    Set<Key> heldKeys() {
        return Collections.unmodifiableSet(heldKeys);
    }
}
