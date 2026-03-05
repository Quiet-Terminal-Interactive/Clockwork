package com.quietterminal.clockwork;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import com.quietterminal.clockwork.exceptions.ClockworkBridgeException;
import com.quietterminal.clockwork.exceptions.ClockworkEcsException;
import com.quietterminal.clockwork.exceptions.ClockworkLifecycleException;
import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class FuzzTest {

    @Test
    void fixedDivisionByZeroThrows() {
        Fixed a = Fixed.from(1.0);
        assertThrows(ArithmeticException.class, () -> Fixed.div(a, Fixed.ZERO));
    }

    @Test
    void fixedFromMaxDoubleDoesNotThrow() {
        assertDoesNotThrow(() -> Fixed.from(Double.MAX_VALUE));
    }

    @Test
    void fixedFromNegativeInfinityDoesNotThrow() {
        assertDoesNotThrow(() -> Fixed.from(Double.NEGATIVE_INFINITY));
    }

    @Test
    void fixedSqrtNegativeReturnsZero() {
        assertEquals(Fixed.ZERO, Fixed.sqrt(Fixed.from(-1.0)));
    }

    @Test
    void fixedSqrtZeroReturnsZero() {
        assertEquals(Fixed.ZERO, Fixed.sqrt(Fixed.ZERO));
    }

    @Test
    void fixedAbsMinValueDoesNotThrow() {
        assertDoesNotThrow(() -> Fixed.abs(Fixed.ofRaw(Integer.MIN_VALUE)));
    }

    @Test
    void fixedAddWrapsOnOverflow() {
        Fixed max = Fixed.ofRaw(Integer.MAX_VALUE);
        assertDoesNotThrow(() -> Fixed.add(max, Fixed.ofRaw(1)));
    }

    @Test
    void vec2NormOfZeroVectorReturnsZeroNoException() {
        Vec2 result = Vec2.norm(Vec2.create(Fixed.ZERO, Fixed.ZERO));
        assertEquals(Fixed.ZERO, result.x());
        assertEquals(Fixed.ZERO, result.y());
    }

    @Test
    void vec2RotateExtremeAngleDoesNotThrow() {
        Vec2 unit = Vec2.create(Fixed.from(1.0), Fixed.ZERO);
        assertDoesNotThrow(() -> Vec2.rotate(unit, Fixed.ofRaw(Integer.MAX_VALUE)));
    }

    @Test
    void vec2NullComponentsThrow() {
        assertThrows(NullPointerException.class, () -> Vec2.create(null, Fixed.ZERO));
        assertThrows(NullPointerException.class, () -> Vec2.create(Fixed.ZERO, null));
    }


    @Test
    void appNullPluginThrows() {
        ClockworkApp app = new ClockworkApp();
        assertThrows(NullPointerException.class, () -> app.use(null));
    }

    @Test
    void appNullSystemThrows() {
        ClockworkApp app = new ClockworkApp();
        assertThrows(NullPointerException.class,
            () -> app.addSystem(com.quietterminal.clockwork.scheduler.Stage.UPDATE, null));
    }

    @Test
    void appNullStageThrows() {
        ClockworkApp app = new ClockworkApp();
        assertThrows(NullPointerException.class,
            () -> app.addSystem(null, ctx -> {}));
    }

    @Test
    void appBlankPluginNameThrows() {
        ClockworkApp app = new ClockworkApp().use(new ClockworkPlugin() {
            @Override
            public String name() { return "   "; }

            @Override
            public void register(ClockworkApp app, WorldApi world) {}
        });
        assertThrows(ClockworkLifecycleException.class, app::build);
    }

    @Test
    void appDuplicatePluginNameThrows() {
        ClockworkPlugin dup = new ClockworkPlugin() {
            @Override
            public String name() { return "same-name"; }

            @Override
            public void register(ClockworkApp app, WorldApi world) {}
        };
        ClockworkApp app = new ClockworkApp().use(dup).use(dup);
        assertThrows(ClockworkLifecycleException.class, app::build);
    }

    @Test
    void appMissingDependencyThrows() {
        ClockworkApp app = new ClockworkApp().use(new ClockworkPlugin() {
            @Override
            public String name() { return "needs-ghost"; }

            @Override
            public String[] depends() { return new String[]{"ghost-plugin"}; }

            @Override
            public void register(ClockworkApp app, WorldApi world) {}
        });
        assertThrows(ClockworkLifecycleException.class, app::build);
    }

    @Test
    void appStepBeforeBuildThrows() {
        ClockworkApp app = new ClockworkApp();
        assertThrows(IllegalStateException.class, () -> app.step(1.0 / 60.0));
    }

    @Test
    void appWorldBeforeBuildThrows() {
        ClockworkApp app = new ClockworkApp();
        assertThrows(IllegalStateException.class, app::world);
    }

    @Test
    void appStepNegativeDeltaThrows() {
        ClockworkApp app = new ClockworkApp().build();
        assertThrows(IllegalArgumentException.class, () -> app.step(-1.0));
    }

    @Test
    void appStepZeroDeltaThrows() {
        ClockworkApp app = new ClockworkApp().build();
        assertThrows(IllegalArgumentException.class, () -> app.step(0.0));
    }
    @Test
    void schemaMismatchMissingFieldThrowsBridgeException(@TempDir Path tmp) throws IOException {
        String bundle = malformedComponentBundle("{}");
        Path bundlePath = tmp.resolve("fuzz-bundle.js");
        Files.writeString(bundlePath, bundle);

        String prev = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", bundlePath.toString());
        try {
            ClockworkApp app = new ClockworkApp().build();
            assertThrows(ClockworkBridgeException.class,
                () -> app.world().query(IntRecord.class).iterator());
        } finally {
            restoreBundle(prev);
        }
    }

    @Test
    void schemaMismatchWrongFieldTypeThrowsBridgeException(@TempDir Path tmp) throws IOException {
        String bundle = malformedComponentBundle("{ value: \"not-a-number\" }");
        Path bundlePath = tmp.resolve("fuzz-bundle2.js");
        Files.writeString(bundlePath, bundle);

        String prev = System.getProperty("clockworkjvm.bundlePath");
        System.setProperty("clockworkjvm.bundlePath", bundlePath.toString());
        try {
            ClockworkApp app = new ClockworkApp().build();
            assertThrows(ClockworkBridgeException.class,
                () -> app.world().query(IntRecord.class).iterator());
        } finally {
            restoreBundle(prev);
        }
    }

    @Test
    void mutableComponentInQueryThrowsEcsException() {
        ClockworkApp app = new ClockworkApp().build();
        var cmds = app.world().commands();
        cmds.spawn().with(new MutableBox(42)).id();
        app.world().commit(cmds);
        assertThrows(ClockworkEcsException.class,
            () -> app.world().query(MutableBox.class).iterator().next());
    }

    record IntRecord(int value) {}

    static final class MutableBox {
        int value;
        MutableBox(int value) { this.value = value; }
    }

    private static String malformedComponentBundle(String componentData) {
        return """
            globalThis.ClockworkJVM = {
              bundleVersion: "0.1.0",
              bridgeApiVersion: 2,
              createBridgeApi() {
                return {
                  createWorld() {
                    return {
                      reserveEntityId() { return 1; },
                      applyBatch() {},
                      query(required) {
                        if (!required || required.length === 0) return [];
                        const components = {};
                        components[required[0]] = %s;
                        return [{ entity: 1, components }];
                      },
                      subscribeEvent() {},
                      emitEvent() {}
                    };
                  },
                  registerSystem() {},
                  step() {},
                  dispose() {}
                };
              }
            };
            """.formatted(componentData);
    }

    private static void restoreBundle(String prev) {
        if (prev == null) System.clearProperty("clockworkjvm.bundlePath");
        else System.setProperty("clockworkjvm.bundlePath", prev);
    }
}
