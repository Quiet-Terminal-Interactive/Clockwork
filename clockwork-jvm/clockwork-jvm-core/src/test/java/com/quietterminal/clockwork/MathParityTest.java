package com.quietterminal.clockwork;

import com.quietterminal.clockwork.math.Fixed;
import com.quietterminal.clockwork.math.Vec2;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class MathParityTest {
    private static final FixedPairCase[] FIXED_PAIR_CASES = {
        new FixedPairCase(0, 65536, 65536, -65536, 0, 0),
        new FixedPairCase(98304, 131072, 229376, -32768, 196608, 49152),
        new FixedPairCase(-98304, 163840, 65536, -262144, -245760, -39321),
        new FixedPairCase(2147483647, 1, -2147483648, 2147483646, 32767, -65536),
        new FixedPairCase(-2147483648, -1, 2147483647, -2147483647, 32768, 0),
        new FixedPairCase(123456789, -987654321, -864197532, 1111111110, -823458816, -8191),
        new FixedPairCase(1879048192, 65536, 1879113728, 1878982656, 1879048192, 1879048192),
        new FixedPairCase(-1879048192, 98304, -1878949888, -1879146496, 1476395008, -1252698794)
    };

    private static final FixedSingleCase[] FIXED_SINGLE_CASES = {
        new FixedSingleCase(0, 0, 0, 0, 0, 0, 0, 0, 65536),
        new FixedSingleCase(1, 1, -1, 0, 65536, 0, 256, 1, 65536),
        new FixedSingleCase(-1, 1, 1, -65536, 0, 0, 0, -1, 65536),
        new FixedSingleCase(32768, 32768, -32768, 0, 65536, 65536, 46340, 31417, 57509),
        new FixedSingleCase(-32768, 32768, 32768, -65536, 0, 0, 0, -31417, 57510),
        new FixedSingleCase(65535, 65535, -65535, 0, 65536, 65536, 65535, 55143, 35408),
        new FixedSingleCase(-65535, 65535, 65535, -65536, 0, -65536, 0, -55143, 35409),
        new FixedSingleCase(65536, 65536, -65536, 65536, 65536, 65536, 65536, 55143, 35407),
        new FixedSingleCase(-65536, 65536, 65536, -65536, -65536, -65536, 0, -55143, 35408),
        new FixedSingleCase(98304, 98304, -98304, 65536, 131072, 131072, 80264, 65369, 4635),
        new FixedSingleCase(-98304, 98304, 98304, -131072, -65536, -65536, 0, -65369, 4636),
        new FixedSingleCase(111411, 111411, -111411, 65536, 131072, 131072, 85448, 64986, -8443),
        new FixedSingleCase(-111411, 111411, 111411, -131072, -65536, -131072, 0, -64986, -8443),
        new FixedSingleCase(2147483647, 2147483647, -2147483647, 2147418112, -2147483648, -2147483648, 11863283, 60474, 25251),
        new FixedSingleCase(-2147483648, -2147483648, -2147483648, -2147483648, -2147483648, -2147483648, 0, -60474, 25250),
        new FixedSingleCase(123456789, 123456789, -123456789, 123404288, 123469824, 123469824, 2844444, -59958, 26456),
        new FixedSingleCase(-987654321, 987654321, 987654321, -987693056, -987627520, -987627520, 0, 11916, -64439),
        new FixedSingleCase(102944, 102944, -102944, 65536, 131072, 131072, 82137, 65536, 0),
        new FixedSingleCase(205887, 205887, -205887, 196608, 262144, 196608, 116159, 0, -65536),
        new FixedSingleCase(411775, 411775, -411775, 393216, 458752, 393216, 164274, 0, 65536)
    };

    private static final LerpCase[] LERP_CASES = {
        new LerpCase(0, 655360, 0, 0),
        new LerpCase(0, 655360, 32768, 327680),
        new LerpCase(0, 655360, 65536, 655360),
        new LerpCase(98304, -131072, 16384, 40960),
        new LerpCase(123456789, -987654321, 43690, -617272649)
    };

    private static final AtanCase[] ATAN_CASES = {
        new AtanCase(0, 0, 0),
        new AtanCase(65536, 0, 102944),
        new AtanCase(0, 65536, 0),
        new AtanCase(0, -65536, 205887),
        new AtanCase(-65536, 0, -102944),
        new AtanCase(65536, 65536, 51472),
        new AtanCase(-65536, 65536, -51472),
        new AtanCase(65536, -65536, 154415)
    };

    private static final VecPairCase[] VEC_PAIR_CASES = {
        new VecPairCase(65536, 0, 0, 65536, 65536, 65536, 65536, -65536, 0, 65536, 32768, 32768),
        new VecPairCase(196608, 262144, -65536, 32768, 131072, 294912, 262144, 229376, -65536, 360448, 65536, 147456),
        new VecPairCase(-131072, 98304, 32768, -163840, -98304, -65536, -163840, 262144, -311296, 278528, -49152, -32768),
        new VecPairCase(123456, -789012, 345678, 901234, 469134, 112222, -222222, -1690246, -10199104, 5859479, 234567, 56111)
    };

    private static final VecSingleCase[] VEC_SINGLE_CASES = {
        new VecSingleCase(0, 0, 0, 0, 0, 0, 0, 0, 0, 0),
        new VecSingleCase(65536, 0, 65536, 65536, 65536, 0, 0, 65536, 0, 65536),
        new VecSingleCase(0, 65536, 65536, 65536, 0, 65536, -65536, 0, -65536, 0),
        new VecSingleCase(196608, 262144, 1638400, 327680, 39321, 52428, -262144, 196608, -262144, 196608),
        new VecSingleCase(-196608, -262144, 1638400, 327680, -39321, -52428, 262144, -196608, 262144, -196608),
        new VecSingleCase(123456, -789012, 9731770, 798612, 10131, -64748, 789012, 123456, 789012, 123456)
    };

    @Test
    void fixedConstantsAndOverflowPolicyMatchTs() {
        assertEquals(Fixed.OverflowPolicy.WRAPPING, Fixed.OVERFLOW_POLICY);
        assertEquals(102944, Fixed.FIXED_HALF_PI.raw());
        assertEquals(205887, Fixed.FIXED_PI.raw());
        assertEquals(411775, Fixed.FIXED_TWO_PI.raw());
    }

    @Test
    void fixedBinaryOperatorsMatchTsGolden() {
        for (FixedPairCase tc : FIXED_PAIR_CASES) {
            Fixed a = Fixed.ofRaw(tc.a);
            Fixed b = Fixed.ofRaw(tc.b);
            assertEquals(tc.add, Fixed.add(a, b).raw());
            assertEquals(tc.sub, Fixed.sub(a, b).raw());
            assertEquals(tc.mul, Fixed.mul(a, b).raw());
            assertEquals(tc.div, Fixed.div(a, b).raw());
        }
    }

    @Test
    void fixedUnaryOperatorsMatchTsGolden() {
        for (FixedSingleCase tc : FIXED_SINGLE_CASES) {
            Fixed a = Fixed.ofRaw(tc.a);
            assertEquals(tc.abs, Fixed.abs(a).raw());
            assertEquals(tc.neg, Fixed.neg(a).raw());
            assertEquals(tc.floor, Fixed.floor(a).raw());
            assertEquals(tc.ceil, Fixed.ceil(a).raw());
            assertEquals(tc.round, Fixed.round(a).raw());
            assertEquals(tc.sqrt, Fixed.sqrt(a).raw());
            assertEquals(tc.sin, Fixed.sin(a).raw());
            assertEquals(tc.cos, Fixed.cos(a).raw());
        }
    }

    @Test
    void fixedAtanAndLerpMatchTsGolden() {
        for (AtanCase tc : ATAN_CASES) {
            assertEquals(tc.atan2, Fixed.atan2(Fixed.ofRaw(tc.y), Fixed.ofRaw(tc.x)).raw());
        }
        for (LerpCase tc : LERP_CASES) {
            Fixed result = Fixed.lerp(Fixed.ofRaw(tc.a), Fixed.ofRaw(tc.b), Fixed.ofRaw(tc.t));
            assertEquals(tc.lerp, result.raw());
        }
    }

    @Test
    void fixedMinMaxClampMatchTsGolden() {
        Fixed lo = Fixed.ofRaw(-1000);
        Fixed hi = Fixed.ofRaw(1000);
        assertEquals(-1000, Fixed.min(Fixed.ofRaw(-1000), Fixed.ofRaw(1000)).raw());
        assertEquals(1000, Fixed.max(Fixed.ofRaw(-1000), Fixed.ofRaw(1000)).raw());
        assertEquals(-1000, Fixed.clamp(Fixed.ofRaw(-2000), lo, hi).raw());
        assertEquals(1000, Fixed.clamp(Fixed.ofRaw(2000), lo, hi).raw());
        assertEquals(500, Fixed.clamp(Fixed.ofRaw(500), lo, hi).raw());
    }

    @Test
    void vec2PairOperatorsMatchTsGolden() {
        Fixed half = Fixed.ofRaw(32768);
        for (VecPairCase tc : VEC_PAIR_CASES) {
            Vec2 a = Vec2.create(Fixed.ofRaw(tc.ax), Fixed.ofRaw(tc.ay));
            Vec2 b = Vec2.create(Fixed.ofRaw(tc.bx), Fixed.ofRaw(tc.by));

            Vec2 add = Vec2.add(a, b);
            Vec2 sub = Vec2.sub(a, b);
            Vec2 lerp = Vec2.lerp(a, b, half);

            assertEquals(tc.addX, add.x().raw());
            assertEquals(tc.addY, add.y().raw());
            assertEquals(tc.subX, sub.x().raw());
            assertEquals(tc.subY, sub.y().raw());
            assertEquals(tc.dot, Vec2.dot(a, b).raw());
            assertEquals(tc.cross, Vec2.cross(a, b).raw());
            assertEquals(tc.lerpX, lerp.x().raw());
            assertEquals(tc.lerpY, lerp.y().raw());
        }
    }

    @Test
    void vec2SingleOperatorsMatchTsGolden() {
        for (VecSingleCase tc : VEC_SINGLE_CASES) {
            Vec2 v = Vec2.create(Fixed.ofRaw(tc.x), Fixed.ofRaw(tc.y));

            assertEquals(tc.lenSq, Vec2.lenSq(v).raw());
            assertEquals(tc.len, Vec2.len(v).raw());

            Vec2 norm = Vec2.norm(v);
            assertEquals(tc.normX, norm.x().raw());
            assertEquals(tc.normY, norm.y().raw());

            Vec2 perp = Vec2.perp(v);
            assertEquals(tc.perpX, perp.x().raw());
            assertEquals(tc.perpY, perp.y().raw());

            Vec2 rotateHalfPi = Vec2.rotate(v, Fixed.FIXED_HALF_PI);
            assertEquals(tc.rotateX, rotateHalfPi.x().raw());
            assertEquals(tc.rotateY, rotateHalfPi.y().raw());
        }
    }

    private record FixedPairCase(int a, int b, int add, int sub, int mul, int div) {
    }

    private record FixedSingleCase(int a, int abs, int neg, int floor, int ceil, int round, int sqrt, int sin, int cos) {
    }

    private record LerpCase(int a, int b, int t, int lerp) {
    }

    private record AtanCase(int y, int x, int atan2) {
    }

    private record VecPairCase(
        int ax,
        int ay,
        int bx,
        int by,
        int addX,
        int addY,
        int subX,
        int subY,
        int dot,
        int cross,
        int lerpX,
        int lerpY
    ) {
    }

    private record VecSingleCase(
        int x,
        int y,
        int lenSq,
        int len,
        int normX,
        int normY,
        int perpX,
        int perpY,
        int rotateX,
        int rotateY
    ) {
    }
}
