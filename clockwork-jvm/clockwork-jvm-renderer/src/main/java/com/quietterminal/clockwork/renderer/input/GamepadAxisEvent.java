package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a gamepad axis value crosses the deadzone threshold. */
public final class GamepadAxisEvent extends ClockworkEvent {
    private final int gamepadIndex;
    private final int axis;
    private final float value;

    public GamepadAxisEvent(int gamepadIndex, int axis, float value) {
        this.gamepadIndex = gamepadIndex;
        this.axis = axis;
        this.value = value;
    }

    public int gamepadIndex() {
        return gamepadIndex;
    }

    /** GLFW axis index (0=left X, 1=left Y, 2=right X, 3=right Y, 4=left trigger, 5=right trigger). */
    public int axis() {
        return axis;
    }

    public float value() {
        return value;
    }
}
