package com.quietterminal.clockwork.plugins;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Packet registry for typed packet mappings. */
public final class PacketRegistry {
    private final Map<Integer, Class<?>> packets = new ConcurrentHashMap<>();

    public void register(int id, Class<?> packetType) {
        packets.put(id, packetType);
    }

    public Class<?> resolve(int id) {
        return packets.get(id);
    }
}
