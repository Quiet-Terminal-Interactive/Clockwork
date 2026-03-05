package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a gamepad button is pressed or released. */
public final class GamepadButtonEvent extends ClockworkEvent {
    private final int gamepadIndex;
    private final int button;
    private final boolean pressed;

    public GamepadButtonEvent(int gamepadIndex, int button, boolean pressed) {
        this.gamepadIndex = gamepadIndex;
        this.button = button;
        this.pressed = pressed;
    }

    public int gamepadIndex() {
        return gamepadIndex;
    }

    /** GLFW button index (0=A/cross, 1=B/circle, 2=X/square, 3=Y/triangle, etc.). */
    public int button() {
        return button;
    }

    public boolean pressed() {
        return pressed;
    }
}
