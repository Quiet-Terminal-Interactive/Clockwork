package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a structural body fractures. */
public final class BodyFracturedEvent extends ClockworkEvent {
    private final long source;
    private final long[] fragments;

    public BodyFracturedEvent(long source, long[] fragments) {
        this.source = source;
        this.fragments = fragments.clone();
    }

    public long source() {
        return source;
    }

    public long[] fragments() {
        return fragments.clone();
    }
}
