package com.quietterminal.clockwork.plugins;

import com.quietterminal.clockwork.exceptions.ClockworkNetworkException;

import java.util.Objects;

/** Java-facing Neon client API. */
public final class NeonClient {

    // 1MB should be more than enough for game packets, therwise stop sending the whole universe in one packet.
    private static final int MAX_PACKET_BYTES = 1024 * 1024;

    public void send(byte[] packet) {
        validatePacket(packet);
    }

    public void sendReliable(byte[] packet) {
        validatePacket(packet);
    }

    public void broadcast(byte[] packet) {
        validatePacket(packet);
    }

    private static void validatePacket(byte[] packet) {
        Objects.requireNonNull(packet, "packet");
        if (packet.length > MAX_PACKET_BYTES) {
            throw new ClockworkNetworkException(
                    "Packet size " + packet.length + " exceeds maximum of " + MAX_PACKET_BYTES + " bytes");
        }
    }
}
