package com.quietterminal.clockwork.math;

/** Q16.16 fixed-point number. */
public record Fixed(int raw) implements Comparable<Fixed> {
    public static final int SHIFT = 16;
    public static final int FRAC_BITS = SHIFT;
    public static final int ONE = 1 << SHIFT;
    public static final int SCALE = ONE;

    public static final Fixed ZERO = new Fixed(0);
    public static final Fixed FIXED_PI = new Fixed((int) Math.round(Math.PI * SCALE));
    public static final Fixed FIXED_TWO_PI = new Fixed((int) Math.round(2.0 * Math.PI * SCALE));
    public static final Fixed FIXED_HALF_PI = new Fixed((int) Math.round((Math.PI / 2.0) * SCALE));

    public static final OverflowPolicy OVERFLOW_POLICY = OverflowPolicy.WRAPPING;

    private static final int[] SIN_TABLE = buildSinTable();
    private static final int[] ATAN_TABLE = buildAtanTable();

    public enum OverflowPolicy {
        WRAPPING
    }

    public static Fixed from(double value) {
        long rounded = Math.round(value * SCALE);
        return new Fixed(wrap32(rounded));
    }

    public static Fixed ofRaw(int raw) {
        return new Fixed(raw);
    }

    public static double to(Fixed value) {
        return ((double) value.raw) / SCALE;
    }

    public static double toDouble(Fixed value) {
        return to(value);
    }

    public static Fixed add(Fixed a, Fixed b) {
        return new Fixed(wrap32((long) a.raw + b.raw));
    }

    public static Fixed sub(Fixed a, Fixed b) {
        return new Fixed(wrap32((long) a.raw - b.raw));
    }

    public static Fixed mul(Fixed a, Fixed b) {
        long product = (long) a.raw * b.raw;
        return new Fixed(wrap32(product >> FRAC_BITS));
    }

    public static Fixed div(Fixed a, Fixed b) {
        if (b.raw == 0) {
            throw new ArithmeticException("Division by zero");
        }
        long numerator = ((long) a.raw) << FRAC_BITS;
        return new Fixed(wrap32(numerator / b.raw));
    }

    public static Fixed abs(Fixed value) {
        return new Fixed(wrap32(Math.abs((long) value.raw)));
    }

    public static Fixed neg(Fixed value) {
        return new Fixed(wrap32(-(long) value.raw));
    }

    public static Fixed min(Fixed a, Fixed b) {
        return a.raw <= b.raw ? a : b;
    }

    public static Fixed max(Fixed a, Fixed b) {
        return a.raw >= b.raw ? a : b;
    }

    public static Fixed clamp(Fixed value, Fixed lo, Fixed hi) {
        if (value.raw < lo.raw) {
            return lo;
        }
        if (value.raw > hi.raw) {
            return hi;
        }
        return value;
    }

    public static Fixed floor(Fixed value) {
        return new Fixed((value.raw >> FRAC_BITS) << FRAC_BITS);
    }

    public static Fixed ceil(Fixed value) {
        int raw = (((value.raw + SCALE - 1) >> FRAC_BITS) << FRAC_BITS);
        return new Fixed(raw);
    }

    public static Fixed round(Fixed value) {
        int raw = (((value.raw + (SCALE >> 1)) >> FRAC_BITS) << FRAC_BITS);
        return new Fixed(raw);
    }

    public static Fixed sqrt(Fixed value) {
        if (value.raw <= 0) {
            return ZERO;
        }

        // Integer Newton-Raphson on scaled n = a << FRAC_BITS to keep deterministic integer output.
        long n = ((long) value.raw) << FRAC_BITS;
        long r = (long) Math.ceil(Math.sqrt(value.raw) * 256.0);
        if (r == 0L) {
            return ZERO;
        }

        long r1 = (r + (n / r)) >> 1;
        while (r1 < r) {
            r = r1;
            r1 = (r + (n / r)) >> 1;
        }

        return new Fixed(wrap32(r));
    }

    public static Fixed sin(Fixed angle) {
        return new Fixed(sinLookup(angle.raw));
    }

    public static Fixed cos(Fixed angle) {
        return new Fixed(sinLookup((long) angle.raw + FIXED_HALF_PI.raw));
    }

    public static Fixed atan2(Fixed y, Fixed x) {
        if (x.raw == 0 && y.raw == 0) {
            return ZERO;
        }

        // Reduce to first octant, then rebuild the full quadrant sign/orientation.
        long ax = Math.abs((long) x.raw);
        long ay = Math.abs((long) y.raw);

        int theta;
        if (ax >= ay) {
            theta = atanFirstOctant((ay * 512.0) / ax);
        } else {
            theta = FIXED_HALF_PI.raw - atanFirstOctant((ax * 512.0) / ay);
        }

        if (x.raw < 0) {
            theta = FIXED_PI.raw - theta;
        }
        if (y.raw < 0) {
            theta = -theta;
        }

        return new Fixed(theta);
    }

    public static Fixed lerp(Fixed a, Fixed b, Fixed t) {
        int delta = b.raw - a.raw;
        long interpolated = ((long) delta * t.raw) >> FRAC_BITS;
        return new Fixed(wrap32((long) a.raw + interpolated));
    }

    @Override
    public int compareTo(Fixed other) {
        return Integer.compare(this.raw, other.raw);
    }

    private static int[] buildSinTable() {
        int[] table = new int[257];
        for (int i = 0; i < table.length; i++) {
            table[i] = (int) Math.round(Math.sin((i / 256.0) * 2.0 * Math.PI) * SCALE);
        }
        return table;
    }

    private static int[] buildAtanTable() {
        int[] table = new int[513];
        for (int i = 0; i < table.length; i++) {
            table[i] = (int) Math.round(Math.atan(i / 512.0) * SCALE);
        }
        return table;
    }

    private static int sinLookup(long angleRaw) {
        long normalized = Math.floorMod(angleRaw, (long) FIXED_TWO_PI.raw);
        double indexF = (normalized * 256.0) / FIXED_TWO_PI.raw;
        int i = (int) Math.floor(indexF);
        double frac = indexF - i;

        int v0 = SIN_TABLE[i];
        int v1 = SIN_TABLE[i + 1];
        return (int) Math.round(v0 + ((v1 - v0) * frac));
    }

    private static int atanFirstOctant(double ratio512) {
        if (ratio512 >= 512.0) {
            return ATAN_TABLE[512];
        }

        int i = (int) Math.floor(ratio512);
        double frac = ratio512 - i;
        int v0 = ATAN_TABLE[i];
        int v1 = ATAN_TABLE[i + 1];
        return (int) Math.round(v0 + ((v1 - v0) * frac));
    }

    private static int wrap32(long value) {
        return (int) value;
    }
}
