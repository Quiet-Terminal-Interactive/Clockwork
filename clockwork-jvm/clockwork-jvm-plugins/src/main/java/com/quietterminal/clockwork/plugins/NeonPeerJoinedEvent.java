package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.ClockworkEvent;

/** Event emitted when a peer joins. */
public final class NeonPeerJoinedEvent extends ClockworkEvent {
    private final String peerId;

    public NeonPeerJoinedEvent(String peerId) {
        this.peerId = peerId;
    }

    public String peerId() {
        return peerId;
    }
}
