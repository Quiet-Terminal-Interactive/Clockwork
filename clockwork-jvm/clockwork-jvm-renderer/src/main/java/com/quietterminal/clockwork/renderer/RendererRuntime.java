package com.quietterminal.clockwork.renderer;

import static org.lwjgl.glfw.GLFW.GLFW_CONTEXT_VERSION_MAJOR;
import static org.lwjgl.glfw.GLFW.GLFW_CONTEXT_VERSION_MINOR;
import static org.lwjgl.glfw.GLFW.GLFW_CURSOR;
import static org.lwjgl.glfw.GLFW.GLFW_CURSOR_DISABLED;
import static org.lwjgl.glfw.GLFW.GLFW_CURSOR_NORMAL;
import static org.lwjgl.glfw.GLFW.GLFW_FALSE;
import static org.lwjgl.glfw.GLFW.GLFW_JOYSTICK_1;
import static org.lwjgl.glfw.GLFW.GLFW_JOYSTICK_LAST;
import static org.lwjgl.glfw.GLFW.GLFW_OPENGL_CORE_PROFILE;
import static org.lwjgl.glfw.GLFW.GLFW_OPENGL_PROFILE;
import static org.lwjgl.glfw.GLFW.GLFW_PRESS;
import static org.lwjgl.glfw.GLFW.GLFW_RELEASE;
import static org.lwjgl.glfw.GLFW.GLFW_REPEAT;
import static org.lwjgl.glfw.GLFW.GLFW_RESIZABLE;
import static org.lwjgl.glfw.GLFW.GLFW_TRUE;
import static org.lwjgl.glfw.GLFW.GLFW_VISIBLE;
import static org.lwjgl.glfw.GLFW.glfwCreateWindow;
import static org.lwjgl.glfw.GLFW.glfwDefaultWindowHints;
import static org.lwjgl.glfw.GLFW.glfwDestroyWindow;
import static org.lwjgl.glfw.GLFW.glfwGetJoystickAxes;
import static org.lwjgl.glfw.GLFW.glfwGetJoystickButtons;
import static org.lwjgl.glfw.GLFW.glfwGetTime;
import static org.lwjgl.glfw.GLFW.glfwInit;
import static org.lwjgl.glfw.GLFW.glfwJoystickPresent;
import static org.lwjgl.glfw.GLFW.glfwMakeContextCurrent;
import static org.lwjgl.glfw.GLFW.glfwPollEvents;
import static org.lwjgl.glfw.GLFW.glfwSetCharCallback;
import static org.lwjgl.glfw.GLFW.glfwSetCursorPosCallback;
import static org.lwjgl.glfw.GLFW.glfwSetErrorCallback;
import static org.lwjgl.glfw.GLFW.glfwSetInputMode;
import static org.lwjgl.glfw.GLFW.glfwSetJoystickCallback;
import static org.lwjgl.glfw.GLFW.glfwSetKeyCallback;
import static org.lwjgl.glfw.GLFW.glfwSetMouseButtonCallback;
import static org.lwjgl.glfw.GLFW.glfwSetScrollCallback;
import static org.lwjgl.glfw.GLFW.glfwSetWindowFocusCallback;
import static org.lwjgl.glfw.GLFW.glfwSetWindowShouldClose;
import static org.lwjgl.glfw.GLFW.glfwSetWindowTitle;
import static org.lwjgl.glfw.GLFW.glfwShowWindow;
import static org.lwjgl.glfw.GLFW.glfwSwapBuffers;
import static org.lwjgl.glfw.GLFW.glfwSwapInterval;
import static org.lwjgl.glfw.GLFW.glfwTerminate;
import static org.lwjgl.glfw.GLFW.glfwWindowHint;
import static org.lwjgl.glfw.GLFW.glfwWindowShouldClose;

import java.nio.ByteBuffer;
import java.nio.FloatBuffer;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicBoolean;

import org.lwjgl.glfw.GLFW;
import org.lwjgl.glfw.GLFWErrorCallback;

import com.quietterminal.clockwork.events.EventBus;
import com.quietterminal.clockwork.exceptions.ClockworkRenderException;
import com.quietterminal.clockwork.observability.ClockworkMetrics;
import com.quietterminal.clockwork.renderer.input.GamepadAxisEvent;
import com.quietterminal.clockwork.renderer.input.GamepadButtonEvent;
import com.quietterminal.clockwork.renderer.input.GamepadEvent;
import com.quietterminal.clockwork.renderer.input.InputBuffer;
import com.quietterminal.clockwork.renderer.input.Key;
import com.quietterminal.clockwork.renderer.input.KeyPressedEvent;
import com.quietterminal.clockwork.renderer.input.KeyReleasedEvent;
import com.quietterminal.clockwork.renderer.input.KeyRepeatEvent;
import com.quietterminal.clockwork.renderer.input.MouseButton;
import com.quietterminal.clockwork.renderer.input.MouseButtonPressedEvent;
import com.quietterminal.clockwork.renderer.input.MouseButtonReleasedEvent;
import com.quietterminal.clockwork.renderer.input.MouseMovedEvent;
import com.quietterminal.clockwork.renderer.input.MouseScrollEvent;
import com.quietterminal.clockwork.renderer.input.TextInputEvent;
import com.quietterminal.clockwork.renderer.input.WindowFocusEvent;
import com.quietterminal.clockwork.renderer.passes.CompositePass;
import com.quietterminal.clockwork.renderer.passes.GeometryPass;
import com.quietterminal.clockwork.renderer.passes.LightAccumPass;
import com.quietterminal.clockwork.renderer.passes.OutputPass;
import com.quietterminal.clockwork.renderer.passes.PostProcessPass;
import com.quietterminal.clockwork.renderer.passes.ShadowMapPass;

/** Owns the GLFW and OpenGL lifecycle for the renderer plugin. */
final class RendererRuntime implements AutoCloseable {
    private static final double FIXED_TICK_SECONDS = 1.0 / 60.0;

    private static final float GAMEPAD_AXIS_CHANGE_THRESHOLD = 0.005f;

    private final WindowConfig config;
    private final RenderQueue renderQueue;
    private final EventBus eventBus;
    private final InputBuffer inputBuffer;
    private final ClockworkMetrics metrics;
    private final List<RenderPass> passes;
    private final ShaderOverrideRegistry shaderOverrides;
    private final AtomicBoolean running = new AtomicBoolean(false);

    private Thread renderThread;
    private long window;
    private RenderContext context;
    private GLFWErrorCallback errorCallback;

    private double cursorX;
    private double cursorY;

    private final Map<Integer, float[]> prevGamepadAxes = new HashMap<>();
    private final Map<Integer, byte[]> prevGamepadButtons = new HashMap<>();

    RendererRuntime(WindowConfig config, RenderQueue renderQueue, EventBus eventBus, InputBuffer inputBuffer,
                    ClockworkMetrics metrics, RenderPipelineConfig pipelineConfig, ShaderOverrideRegistry shaderOverrides) {
        this.config = Objects.requireNonNull(config, "config");
        this.renderQueue = Objects.requireNonNull(renderQueue, "renderQueue");
        this.eventBus = Objects.requireNonNull(eventBus, "eventBus");
        this.inputBuffer = inputBuffer;
        this.metrics = Objects.requireNonNull(metrics, "metrics");
        this.shaderOverrides = Objects.requireNonNull(shaderOverrides, "shaderOverrides");
        List<RenderPass> defaults = List.of(
            new GeometryPass(),
            new ShadowMapPass(),
            new LightAccumPass(),
            new CompositePass(),
            new PostProcessPass(),
            new OutputPass()
        );
        this.passes = pipelineConfig.buildPassList(defaults);
    }

    public void start() {
        if (!running.compareAndSet(false, true)) {
            return;
        }

        renderThread = Thread.ofPlatform()
            .name("clockwork-renderer")
            .daemon(true)
            .start(this::runLoop);
    }

    @Override
    public void close() {
        running.set(false);
        if (window != 0L) {
            glfwSetWindowShouldClose(window, true);
        }
        if (renderThread != null) {
            try {
                renderThread.join(3_000L);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            if (renderThread.isAlive()) {
                // Renderer didn't exit after the grace period — interrupt and wait briefly.
                // This handles cases where a render pass or GL call is stuck.
                renderThread.interrupt();
                try {
                    renderThread.join(1_000L);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            }
        }
    }

    private void runLoop() {
        RenderQueue.FrameSnapshot previous = null;
        RenderQueue.FrameSnapshot current = renderQueue.snapshot();

        try {
            initWindow();
            installInputCallbacks();
            context = new RenderContext(window, config, shaderOverrides);
            for (RenderPass pass : passes) {
                pass.init(context);
            }

            if (config.vsync()) {
                glfwSwapInterval(1);
            } else {
                glfwSwapInterval(0);
            }

            double lastFrame = glfwGetTime();
            double lag = 0.0;
            long frameStartNanos;

            while (running.get() && !glfwWindowShouldClose(window)) {
                frameStartNanos = System.nanoTime();

                glfwPollEvents();
                pollGamepads();

                RenderQueue.FrameSnapshot snapshot = renderQueue.snapshot();
                if (snapshot.tickNumber() != current.tickNumber()) {
                    previous = current;
                    current = snapshot;
                }

                double now = glfwGetTime();
                double frameDelta = Math.max(now - lastFrame, 0.0);
                lastFrame = now;
                lag += frameDelta;
                float alpha = (float) Math.clamp(lag / FIXED_TICK_SECONDS, 0.0, 1.0);
                RenderQueue.FrameSnapshot interpolated = RenderQueue.interpolate(previous, current, alpha);

                context.beginFrame((System.nanoTime() - frameStartNanos) / 1_000_000.0);
                context.setActiveFrame(interpolated);
                for (RenderPass pass : passes) {
                    pass.execute(context, renderQueue);
                }

                String title = context.buildOverlayTitle();
                if (title != null) {
                    glfwSetWindowTitle(window, title);
                }
                glfwSwapBuffers(window);

                metrics.recordFrameTime(System.nanoTime() - frameStartNanos);
                metrics.recordQueueDepth(current.sprites().size(), current.lights().size(), current.particles().size());

                if (lag >= FIXED_TICK_SECONDS) {
                    lag = Math.max(0.0, lag - FIXED_TICK_SECONDS);
                }
                paceFrame(frameStartNanos);
            }
        } catch (RuntimeException e) {
            throw new ClockworkRenderException("Renderer runtime failed.", e);
        } finally {
            cleanup();
        }
    }

    private void initWindow() {
        errorCallback = GLFWErrorCallback.createPrint(System.err);
        glfwSetErrorCallback(errorCallback);

        if (!glfwInit()) {
            throw new ClockworkRenderException("Failed to initialize GLFW.");
        }

        glfwDefaultWindowHints();
        glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
        glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
        glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
        glfwWindowHint(GLFW_VISIBLE, GLFW_FALSE);
        glfwWindowHint(GLFW_RESIZABLE, GLFW_TRUE);

        window = glfwCreateWindow(config.width(), config.height(), config.title(), 0L, 0L);
        if (window == 0L) {
            throw new ClockworkRenderException("Failed to create renderer window.");
        }

        glfwMakeContextCurrent(window);

        // Wayland doesn't report GLFW_CURSOR_DISABLED position deltas on older drivers.
        // GLFW_RAW_MOUSE_MOTION would help but requires a capabilities check — skipping for now.
        int cursorMode = config.cursorLocked() ? GLFW_CURSOR_DISABLED : GLFW_CURSOR_NORMAL;
        glfwSetInputMode(window, GLFW_CURSOR, cursorMode);

        glfwShowWindow(window);
    }

    private void installInputCallbacks() {
        glfwSetKeyCallback(window, (handle, glfwKey, scancode, action, mods) -> {
            Key key = mapKey(glfwKey);
            if (key == null) {
                return;
            }
            if (action == GLFW_PRESS) {
                enqueue(new KeyPressedEvent(key));
            } else if (action == GLFW_RELEASE) {
                enqueue(new KeyReleasedEvent(key));
            } else if (action == GLFW_REPEAT) {
                enqueue(new KeyRepeatEvent(key));
            }
        });

        glfwSetMouseButtonCallback(window, (handle, glfwButton, action, mods) -> {
            MouseButton button = mapMouseButton(glfwButton);
            if (button == null) {
                return;
            }
            if (action == GLFW_PRESS) {
                enqueue(new MouseButtonPressedEvent(button, cursorX, cursorY));
            } else if (action == GLFW_RELEASE) {
                enqueue(new MouseButtonReleasedEvent(button, cursorX, cursorY));
            }
        });

        glfwSetCursorPosCallback(window, (handle, x, y) -> {
            cursorX = x;
            cursorY = y;
            enqueue(new MouseMovedEvent(x, y));
        });

        glfwSetScrollCallback(window, (handle, xOffset, yOffset) ->
            enqueue(new MouseScrollEvent(xOffset, yOffset)));

        glfwSetCharCallback(window, (handle, codePoint) ->
            enqueue(new TextInputEvent(codePoint)));

        glfwSetWindowFocusCallback(window, (handle, focused) ->
            enqueue(new WindowFocusEvent(focused)));

        glfwSetJoystickCallback((jid, event) -> {
            String action = event == GLFW.GLFW_CONNECTED ? "connected" : "disconnected";
            enqueue(new GamepadEvent(jid, action));
            if (event != GLFW.GLFW_CONNECTED) {
                prevGamepadAxes.remove(jid);
                prevGamepadButtons.remove(jid);
            }
        });
    }

    /**
     * Polls all present gamepads for axis and button changes.
     * GLFW only fires callbacks for joystick connect/disconnect; axis and button state must be pulled.
     */
    private void pollGamepads() {
        for (int jid = GLFW_JOYSTICK_1; jid <= GLFW_JOYSTICK_LAST; jid++) {
            if (!glfwJoystickPresent(jid)) {
                continue;
            }

            FloatBuffer axes = glfwGetJoystickAxes(jid);
            if (axes != null) {
                float[] prev = prevGamepadAxes.computeIfAbsent(jid, k -> new float[axes.remaining()]);
                for (int i = 0; i < axes.remaining() && i < prev.length; i++) {
                    float value = axes.get(i);
                    if (Math.abs(value - prev[i]) >= GAMEPAD_AXIS_CHANGE_THRESHOLD) {
                        prev[i] = value;
                        enqueue(new GamepadAxisEvent(jid, i, value));
                    }
                }
            }

            ByteBuffer buttons = glfwGetJoystickButtons(jid);
            if (buttons != null) {
                byte[] prev = prevGamepadButtons.computeIfAbsent(jid, k -> new byte[buttons.remaining()]);
                for (int i = 0; i < buttons.remaining() && i < prev.length; i++) {
                    byte state = buttons.get(i);
                    if (state != prev[i]) {
                        prev[i] = state;
                        enqueue(new GamepadButtonEvent(jid, i, state == GLFW_PRESS));
                    }
                }
            }
        }
    }

    /**
     * Routes an event to the InputBuffer when present; otherwise emits directly.
     * Direct emission loses deterministic ordering but keeps behaviour correct for
     * apps that don't register InputPlugin.
     */
    private void enqueue(Object event) {
        if (inputBuffer != null) {
            inputBuffer.enqueue(event);
        } else {
            eventBus.emit(event);
        }
    }

    private void paceFrame(long frameStartNanos) {
        if (config.vsync()) {
            return;
        }

        int maxFps = Integer.getInteger("clockwork.renderer.maxFps", 0);
        if (maxFps <= 0) {
            return;
        }

        long frameBudgetNanos = 1_000_000_000L / maxFps;
        long elapsed = System.nanoTime() - frameStartNanos;
        long remaining = frameBudgetNanos - elapsed;
        if (remaining <= 0L) {
            return;
        }

        try {
            long millis = remaining / 1_000_000L;
            int nanos = (int) (remaining % 1_000_000L);
            Thread.sleep(millis, nanos);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }

    private void cleanup() {
        for (int i = passes.size() - 1; i >= 0; i--) {
            try {
                passes.get(i).dispose();
            } catch (RuntimeException ignored) {
                // Disposal should be best-effort so one pass cannot leak the whole shutdown sequence.
            }
        }

        if (context != null) {
            try {
                context.dispose();
            } catch (RuntimeException ignored) {
            }
            context = null;
        }

        glfwSetKeyCallback(window, null);
        glfwSetMouseButtonCallback(window, null);
        glfwSetCursorPosCallback(window, null);
        glfwSetScrollCallback(window, null);
        glfwSetCharCallback(window, null);
        glfwSetWindowFocusCallback(window, null);
        glfwSetJoystickCallback(null);

        if (window != 0L) {
            glfwDestroyWindow(window);
            window = 0L;
        }
        glfwTerminate();

        if (errorCallback != null) {
            errorCallback.free();
            errorCallback = null;
        }
    }

    private static Key mapKey(int glfwKey) {
        return switch (glfwKey) {
            case GLFW.GLFW_KEY_SPACE -> Key.SPACE;
            case GLFW.GLFW_KEY_APOSTROPHE -> Key.APOSTROPHE;
            case GLFW.GLFW_KEY_COMMA -> Key.COMMA;
            case GLFW.GLFW_KEY_MINUS -> Key.MINUS;
            case GLFW.GLFW_KEY_PERIOD -> Key.PERIOD;
            case GLFW.GLFW_KEY_SLASH -> Key.SLASH;
            case GLFW.GLFW_KEY_0 -> Key.NUM_0;
            case GLFW.GLFW_KEY_1 -> Key.NUM_1;
            case GLFW.GLFW_KEY_2 -> Key.NUM_2;
            case GLFW.GLFW_KEY_3 -> Key.NUM_3;
            case GLFW.GLFW_KEY_4 -> Key.NUM_4;
            case GLFW.GLFW_KEY_5 -> Key.NUM_5;
            case GLFW.GLFW_KEY_6 -> Key.NUM_6;
            case GLFW.GLFW_KEY_7 -> Key.NUM_7;
            case GLFW.GLFW_KEY_8 -> Key.NUM_8;
            case GLFW.GLFW_KEY_9 -> Key.NUM_9;
            case GLFW.GLFW_KEY_SEMICOLON -> Key.SEMICOLON;
            case GLFW.GLFW_KEY_EQUAL -> Key.EQUAL;
            case GLFW.GLFW_KEY_A -> Key.A;
            case GLFW.GLFW_KEY_B -> Key.B;
            case GLFW.GLFW_KEY_C -> Key.C;
            case GLFW.GLFW_KEY_D -> Key.D;
            case GLFW.GLFW_KEY_E -> Key.E;
            case GLFW.GLFW_KEY_F -> Key.F;
            case GLFW.GLFW_KEY_G -> Key.G;
            case GLFW.GLFW_KEY_H -> Key.H;
            case GLFW.GLFW_KEY_I -> Key.I;
            case GLFW.GLFW_KEY_J -> Key.J;
            case GLFW.GLFW_KEY_K -> Key.K;
            case GLFW.GLFW_KEY_L -> Key.L;
            case GLFW.GLFW_KEY_M -> Key.M;
            case GLFW.GLFW_KEY_N -> Key.N;
            case GLFW.GLFW_KEY_O -> Key.O;
            case GLFW.GLFW_KEY_P -> Key.P;
            case GLFW.GLFW_KEY_Q -> Key.Q;
            case GLFW.GLFW_KEY_R -> Key.R;
            case GLFW.GLFW_KEY_S -> Key.S;
            case GLFW.GLFW_KEY_T -> Key.T;
            case GLFW.GLFW_KEY_U -> Key.U;
            case GLFW.GLFW_KEY_V -> Key.V;
            case GLFW.GLFW_KEY_W -> Key.W;
            case GLFW.GLFW_KEY_X -> Key.X;
            case GLFW.GLFW_KEY_Y -> Key.Y;
            case GLFW.GLFW_KEY_Z -> Key.Z;
            case GLFW.GLFW_KEY_LEFT_BRACKET -> Key.LEFT_BRACKET;
            case GLFW.GLFW_KEY_BACKSLASH -> Key.BACKSLASH;
            case GLFW.GLFW_KEY_RIGHT_BRACKET -> Key.RIGHT_BRACKET;
            case GLFW.GLFW_KEY_GRAVE_ACCENT -> Key.GRAVE_ACCENT;
            case GLFW.GLFW_KEY_ESCAPE -> Key.ESCAPE;
            case GLFW.GLFW_KEY_ENTER -> Key.ENTER;
            case GLFW.GLFW_KEY_TAB -> Key.TAB;
            case GLFW.GLFW_KEY_BACKSPACE -> Key.BACKSPACE;
            case GLFW.GLFW_KEY_INSERT -> Key.INSERT;
            case GLFW.GLFW_KEY_DELETE -> Key.DELETE;
            case GLFW.GLFW_KEY_RIGHT -> Key.RIGHT;
            case GLFW.GLFW_KEY_LEFT -> Key.LEFT;
            case GLFW.GLFW_KEY_DOWN -> Key.DOWN;
            case GLFW.GLFW_KEY_UP -> Key.UP;
            case GLFW.GLFW_KEY_PAGE_UP -> Key.PAGE_UP;
            case GLFW.GLFW_KEY_PAGE_DOWN -> Key.PAGE_DOWN;
            case GLFW.GLFW_KEY_HOME -> Key.HOME;
            case GLFW.GLFW_KEY_END -> Key.END;
            case GLFW.GLFW_KEY_CAPS_LOCK -> Key.CAPS_LOCK;
            case GLFW.GLFW_KEY_SCROLL_LOCK -> Key.SCROLL_LOCK;
            case GLFW.GLFW_KEY_NUM_LOCK -> Key.NUM_LOCK;
            case GLFW.GLFW_KEY_PRINT_SCREEN -> Key.PRINT_SCREEN;
            case GLFW.GLFW_KEY_PAUSE -> Key.PAUSE;
            case GLFW.GLFW_KEY_F1 -> Key.F1;
            case GLFW.GLFW_KEY_F2 -> Key.F2;
            case GLFW.GLFW_KEY_F3 -> Key.F3;
            case GLFW.GLFW_KEY_F4 -> Key.F4;
            case GLFW.GLFW_KEY_F5 -> Key.F5;
            case GLFW.GLFW_KEY_F6 -> Key.F6;
            case GLFW.GLFW_KEY_F7 -> Key.F7;
            case GLFW.GLFW_KEY_F8 -> Key.F8;
            case GLFW.GLFW_KEY_F9 -> Key.F9;
            case GLFW.GLFW_KEY_F10 -> Key.F10;
            case GLFW.GLFW_KEY_F11 -> Key.F11;
            case GLFW.GLFW_KEY_F12 -> Key.F12;
            case GLFW.GLFW_KEY_KP_0 -> Key.KP_0;
            case GLFW.GLFW_KEY_KP_1 -> Key.KP_1;
            case GLFW.GLFW_KEY_KP_2 -> Key.KP_2;
            case GLFW.GLFW_KEY_KP_3 -> Key.KP_3;
            case GLFW.GLFW_KEY_KP_4 -> Key.KP_4;
            case GLFW.GLFW_KEY_KP_5 -> Key.KP_5;
            case GLFW.GLFW_KEY_KP_6 -> Key.KP_6;
            case GLFW.GLFW_KEY_KP_7 -> Key.KP_7;
            case GLFW.GLFW_KEY_KP_8 -> Key.KP_8;
            case GLFW.GLFW_KEY_KP_9 -> Key.KP_9;
            case GLFW.GLFW_KEY_KP_DECIMAL -> Key.KP_DECIMAL;
            case GLFW.GLFW_KEY_KP_DIVIDE -> Key.KP_DIVIDE;
            case GLFW.GLFW_KEY_KP_MULTIPLY -> Key.KP_MULTIPLY;
            case GLFW.GLFW_KEY_KP_SUBTRACT -> Key.KP_SUBTRACT;
            case GLFW.GLFW_KEY_KP_ADD -> Key.KP_ADD;
            case GLFW.GLFW_KEY_KP_ENTER -> Key.KP_ENTER;
            case GLFW.GLFW_KEY_KP_EQUAL -> Key.KP_EQUAL;
            case GLFW.GLFW_KEY_LEFT_SHIFT -> Key.LEFT_SHIFT;
            case GLFW.GLFW_KEY_LEFT_CONTROL -> Key.LEFT_CONTROL;
            case GLFW.GLFW_KEY_LEFT_ALT -> Key.LEFT_ALT;
            case GLFW.GLFW_KEY_LEFT_SUPER -> Key.LEFT_SUPER;
            case GLFW.GLFW_KEY_RIGHT_SHIFT -> Key.RIGHT_SHIFT;
            case GLFW.GLFW_KEY_RIGHT_CONTROL -> Key.RIGHT_CONTROL;
            case GLFW.GLFW_KEY_RIGHT_ALT -> Key.RIGHT_ALT;
            case GLFW.GLFW_KEY_RIGHT_SUPER -> Key.RIGHT_SUPER;
            case GLFW.GLFW_KEY_MENU -> Key.MENU;
            default -> null;
        };
    }

    private static MouseButton mapMouseButton(int glfwButton) {
        return switch (glfwButton) {
            case GLFW.GLFW_MOUSE_BUTTON_LEFT -> MouseButton.LEFT;
            case GLFW.GLFW_MOUSE_BUTTON_RIGHT -> MouseButton.RIGHT;
            case GLFW.GLFW_MOUSE_BUTTON_MIDDLE -> MouseButton.MIDDLE;
            case 3 -> MouseButton.BUTTON_4;
            case 4 -> MouseButton.BUTTON_5;
            default -> null;
        };
    }
}
