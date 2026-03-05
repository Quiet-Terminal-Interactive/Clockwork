package com.quietterminal.clockwork.renderer.input;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted for gamepad input. */
public final class GamepadEvent extends ClockworkEvent {
    private final int gamepadIndex;
    private final String action;

    public GamepadEvent(int gamepadIndex, String action) {
        this.gamepadIndex = gamepadIndex;
        this.action = action;
    }

    public int gamepadIndex() {
        return gamepadIndex;
    }

    public String action() {
        return action;
    }
}
