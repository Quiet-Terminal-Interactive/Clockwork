import { describe, it, expect, vi } from 'vitest'
import {
  buildPacket,
  CorePacketType,
  decodeAck,
  decodeConnectAccept,
  decodeConnectDeny,
  decodeHeader,
  decodeSessionConfig,
  DEST_BROADCAST,
  DEST_HOST,
  encodeAck,
  encodeConnectRequest,
  encodeHeader,
  encodePing,
  decodePing,
  HEADER_SIZE,
  NEON_MAGIC,
  NEON_VERSION
} from './packet.js'
import { MockTransport } from './transport.js'
import { NeonPacketRegistry } from './registry.js'
import { NeonClient } from './client.js'

describe('encodeHeader / decodeHeader', () => {
  it('round-trips a header', () => {
    const header = {
      magic: NEON_MAGIC,
      version: NEON_VERSION,
      packetType: 0x01,
      sequence: 42,
      clientId: 3,
      destinationId: 1
    }
    const bytes = encodeHeader(header)
    expect(bytes.length).toBe(HEADER_SIZE)
    const decoded = decodeHeader(bytes)
    expect(decoded).toEqual(header)
  })

  it('returns null for bad magic', () => {
    const bytes = encodeHeader({
      magic: 0x1234,
      version: NEON_VERSION,
      packetType: 0x01,
      sequence: 0,
      clientId: 0,
      destinationId: 0
    })
    expect(decodeHeader(bytes)).toBeNull()
  })

  it('returns null for undersized buffer', () => {
    expect(decodeHeader(new Uint8Array(3))).toBeNull()
  })
})

describe('buildPacket', () => {
  it('prepends header bytes before payload', () => {
    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef])
    const packet = buildPacket(0x10, 7, 2, DEST_HOST, payload)
    expect(packet.length).toBe(HEADER_SIZE + 4)
    const header = decodeHeader(packet)
    expect(header?.packetType).toBe(0x10)
    expect(header?.sequence).toBe(7)
    expect(header?.clientId).toBe(2)
    expect(header?.destinationId).toBe(DEST_HOST)
    expect(Array.from(packet.subarray(HEADER_SIZE))).toEqual([0xde, 0xad, 0xbe, 0xef])
  })
})

describe('ConnectRequest encode', () => {
  it('encodes and can be read back field-by-field', () => {
    const bytes = encodeConnectRequest({
      clientVersion: 1,
      playerName: 'Alice',
      targetSessionId: 99,
      gameIdentifier: 0xcafe
    })
    const view = new DataView(bytes.buffer)
    expect(view.getUint8(0)).toBe(1)
    const nameLen = view.getInt32(1, true)
    expect(nameLen).toBe(5)
    const name = new TextDecoder().decode(bytes.subarray(5, 5 + nameLen))
    expect(name).toBe('Alice')
    expect(view.getInt32(5 + nameLen, true)).toBe(99)
    expect(view.getInt32(5 + nameLen + 4, true)).toBe(0xcafe)
  })
})

describe('ConnectAccept decode', () => {
  it('decodes assigned client ID, session ID and token', () => {
    const buf = new ArrayBuffer(13)
    const view = new DataView(buf)
    view.setUint8(0, 5)
    view.setInt32(1, 1234, true)
    view.setBigInt64(5, BigInt('9876543210'), true)
    const result = decodeConnectAccept(new Uint8Array(buf), 0)
    expect(result.assignedClientId).toBe(5)
    expect(result.sessionId).toBe(1234)
    expect(result.sessionToken).toBe(BigInt('9876543210'))
  })
})

describe('ConnectDeny decode', () => {
  it('decodes the reason string', () => {
    const reasonBytes = new TextEncoder().encode('session_full')
    const buf = new ArrayBuffer(4 + reasonBytes.length)
    new DataView(buf).setInt32(0, reasonBytes.length, true)
    new Uint8Array(buf, 4).set(reasonBytes)
    const result = decodeConnectDeny(new Uint8Array(buf), 0)
    expect(result.reason).toBe('session_full')
  })
})

describe('SessionConfig decode', () => {
  it('decodes version, tickRate and maxPacketSize', () => {
    const buf = new ArrayBuffer(5)
    const view = new DataView(buf)
    view.setUint8(0, 2)
    view.setInt16(1, 60, true)
    view.setInt16(3, 1400, true)
    const result = decodeSessionConfig(new Uint8Array(buf), 0)
    expect(result.version).toBe(2)
    expect(result.tickRate).toBe(60)
    expect(result.maxPacketSize).toBe(1400)
  })
})

describe('Ping / Pong encode+decode', () => {
  it('round-trips a timestamp', () => {
    const ts = BigInt(Date.now())
    const bytes = encodePing(ts)
    expect(bytes.length).toBe(8)
    expect(decodePing(bytes, 0)).toBe(ts)
  })
})

describe('Ack encode / decode', () => {
  it('round-trips multiple sequences', () => {
    const sequences = [0, 1, 127, 65535]
    const bytes = encodeAck(sequences)
    expect(decodeAck(bytes, 0)).toEqual(sequences)
  })

  it('handles empty sequence list', () => {
    const bytes = encodeAck([])
    expect(decodeAck(bytes, 0)).toEqual([])
  })
})

describe('MockTransport.createPair', () => {
  it('delivers packets from A to B synchronously', async () => {
    const [a, b] = MockTransport.createPair()
    const received: Uint8Array[] = []
    b.onReceive((data) => received.push(data))
    await a.send(new Uint8Array([1, 2, 3]), '127.0.0.1', 7777)
    expect(received.length).toBe(1)
    expect(Array.from(received[0]!)).toEqual([1, 2, 3])
  })

  it('delivers packets from B to A symmetrically', async () => {
    const [a, b] = MockTransport.createPair()
    const received: Uint8Array[] = []
    a.onReceive((data) => received.push(data))
    await b.send(new Uint8Array([9, 8, 7]), '127.0.0.1', 7777)
    expect(Array.from(received[0]!)).toEqual([9, 8, 7])
  })

  it('does not share buffer references (each send is a copy)', async () => {
    const [a, b] = MockTransport.createPair()
    const received: Uint8Array[] = []
    b.onReceive((data) => received.push(data))
    const original = new Uint8Array([1, 2, 3])
    await a.send(original, '127.0.0.1', 7777)
    original[0] = 0xff
    expect(received[0]![0]).toBe(1)
  })
})

interface Coord {
  x: number
  y: number
}

describe('NeonPacketRegistry', () => {
  it('serializes and deserializes a registered packet type', () => {
    const registry = new NeonPacketRegistry()
    registry.register<Coord>({
      id: 0x10,
      name: 'Coord',
      serialize(payload, view, offset) {
        view.setFloat32(offset, payload.x, true)
        view.setFloat32(offset + 4, payload.y, true)
        return 8
      },
      deserialize(view, offset) {
        return { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) }
      }
    })

    const bytes = registry.serialize(0x10, { x: 1.5, y: -3.0 })
    expect(bytes).not.toBeNull()
    const view = new DataView(bytes!.buffer, bytes!.byteOffset, bytes!.byteLength)
    const result = registry.deserialize(0x10, view, 0, bytes!.length) as Coord
    expect(result.x).toBeCloseTo(1.5)
    expect(result.y).toBeCloseTo(-3.0)
  })

  it('returns null for unregistered type', () => {
    const registry = new NeonPacketRegistry()
    expect(registry.serialize(0x99, {})).toBeNull()
    expect(
      registry.deserialize(0x99, new DataView(new ArrayBuffer(0)), 0, 0)
    ).toBeNull()
  })
})

function makeConnectAcceptPacket(clientId: number, sessionId: number): Uint8Array {
  const payload = new ArrayBuffer(13)
  const view = new DataView(payload)
  view.setUint8(0, clientId)
  view.setInt32(1, sessionId, true)
  view.setBigInt64(5, BigInt(0), true)
  return buildPacket(CorePacketType.ConnectAccept, 0, 1, 2, new Uint8Array(payload))
}

function makeConnectDenyPacket(reason: string): Uint8Array {
  const reasonBytes = new TextEncoder().encode(reason)
  const payload = new ArrayBuffer(4 + reasonBytes.length)
  new DataView(payload).setInt32(0, reasonBytes.length, true)
  new Uint8Array(payload, 4).set(reasonBytes)
  return buildPacket(CorePacketType.ConnectDeny, 0, 1, 2, new Uint8Array(payload))
}

describe('NeonClient', () => {
  it('starts in disconnected state', () => {
    const [transport] = MockTransport.createPair()
    const client = new NeonClient({
      transport,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234
    })
    expect(client.state).toBe('disconnected')
    expect(client.clientId).toBeNull()
    expect(client.sessionId).toBeNull()
  })

  it('transitions to connecting on connect()', async () => {
    const [transportA, transportB] = MockTransport.createPair()
    const client = new NeonClient({
      transport: transportA,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234,
      connectionTimeoutMs: 60000
    })

    const sent: Uint8Array[] = []
    transportB.onReceive((data) => sent.push(data))

    void client.connect('127.0.0.1', 7777, 42)
    expect(client.state).toBe('connecting')
    expect(sent.length).toBeGreaterThan(0)
    const header = decodeHeader(sent[0]!)
    expect(header?.packetType).toBe(CorePacketType.ConnectRequest)

    await client.disconnect()
  })

  it('transitions to connected on ConnectAccept', async () => {
    const [transportA, transportB] = MockTransport.createPair()
    const client = new NeonClient({
      transport: transportA,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234,
      connectionTimeoutMs: 60000,
      pingIntervalMs: 60000
    })

    let connectedClientId = -1
    client.onConnected((id) => { connectedClientId = id })

    void client.connect('127.0.0.1', 7777, 42)
    await transportB.send(makeConnectAcceptPacket(5, 42), '127.0.0.1', 7777)

    expect(client.state).toBe('connected')
    expect(client.clientId).toBe(5)
    expect(client.sessionId).toBe(42)
    expect(connectedClientId).toBe(5)

    await client.disconnect()
  })

  it('fires onDisconnected with reason on ConnectDeny', async () => {
    const [transportA, transportB] = MockTransport.createPair()
    const client = new NeonClient({
      transport: transportA,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234,
      connectionTimeoutMs: 60000
    })

    let disconnectReason = ''
    client.onDisconnected((reason) => { disconnectReason = reason })

    void client.connect('127.0.0.1', 7777, 42)
    await transportB.send(makeConnectDenyPacket('session_full'), '127.0.0.1', 7777)

    expect(client.state).toBe('disconnected')
    expect(disconnectReason).toBe('session_full')
  })

  it('dispatches received game packets via on()', async () => {
    const registry = new NeonPacketRegistry()
    registry.register<Coord>({
      id: 0x10,
      name: 'Coord',
      serialize(p, view, offset) {
        view.setFloat32(offset, p.x, true)
        view.setFloat32(offset + 4, p.y, true)
        return 8
      },
      deserialize(view, offset) {
        return { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) }
      }
    })

    const [transportA, transportB] = MockTransport.createPair()
    const client = new NeonClient({
      transport: transportA,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234,
      registry,
      connectionTimeoutMs: 60000,
      pingIntervalMs: 60000
    })

    void client.connect('127.0.0.1', 7777, 42)
    await transportB.send(makeConnectAcceptPacket(5, 42), '127.0.0.1', 7777)

    const received: Coord[] = []
    client.on<Coord>(0x10, (payload) => received.push(payload))

    const coordPayload = new ArrayBuffer(8)
    new DataView(coordPayload).setFloat32(0, 2.0, true)
    new DataView(coordPayload).setFloat32(4, 4.0, true)
    const gamePacket = buildPacket(0x10, 1, 3, DEST_BROADCAST, new Uint8Array(coordPayload))
    await transportB.send(gamePacket, '127.0.0.1', 7777)

    client.processIncoming()

    expect(received.length).toBe(1)
    expect(received[0]!.x).toBeCloseTo(2.0)
    expect(received[0]!.y).toBeCloseTo(4.0)

    await client.disconnect()
  })

  it('drops duplicate game packets (same sequence from same flow)', async () => {
    const registry = new NeonPacketRegistry()
    registry.register<Coord>({
      id: 0x10,
      name: 'Coord',
      serialize(p, view, offset) {
        view.setFloat32(offset, p.x, true)
        view.setFloat32(offset + 4, p.y, true)
        return 8
      },
      deserialize(view, offset) {
        return { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) }
      }
    })

    const [transportA, transportB] = MockTransport.createPair()
    const client = new NeonClient({
      transport: transportA,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234,
      registry,
      connectionTimeoutMs: 60000,
      pingIntervalMs: 60000
    })

    void client.connect('127.0.0.1', 7777, 42)
    await transportB.send(makeConnectAcceptPacket(5, 42), '127.0.0.1', 7777)

    const received: Coord[] = []
    client.on<Coord>(0x10, (payload) => received.push(payload))

    const coordPayload = new ArrayBuffer(8)
    const gamePacket = buildPacket(0x10, 7, 3, DEST_BROADCAST, new Uint8Array(coordPayload))
    await transportB.send(gamePacket, '127.0.0.1', 7777)
    await transportB.send(gamePacket, '127.0.0.1', 7777)

    client.processIncoming()
    expect(received.length).toBe(1)

    await client.disconnect()
  })

  it('fires onReliabilityFailure after max retries', () => {
    vi.useFakeTimers()

    const [transport] = MockTransport.createPair()
    const client = new NeonClient({
      transport,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234,
      connectionTimeoutMs: 60000
    })

    Object.assign(client, { _state: 'connected', _clientId: 5 })

    const registry = new NeonPacketRegistry()
    registry.register<Coord>({
      id: 0x10,
      name: 'Coord',
      serialize(p, view, offset) {
        view.setFloat32(offset, p.x, true)
        view.setFloat32(offset + 4, p.y, true)
        return 8
      },
      deserialize(view, offset) {
        return { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) }
      }
    })
    Object.assign(client['cfg'], { registry })

    const failures: number[] = []
    client.onReliabilityFailure((seq) => failures.push(seq))

    void client.sendReliable<Coord>(0x10, { x: 1, y: 2 })

    for (let i = 0; i <= 6; i++) {
      vi.advanceTimersByTime(10_000)
      client.tickReliability(Date.now())
    }

    expect(failures.length).toBe(1)

    vi.useRealTimers()
  })

  it('once() unsubscribes after first delivery', async () => {
    const registry = new NeonPacketRegistry()
    registry.register<Coord>({
      id: 0x10,
      name: 'Coord',
      serialize(p, view, offset) {
        view.setFloat32(offset, p.x, true)
        view.setFloat32(offset + 4, p.y, true)
        return 8
      },
      deserialize(view, offset) {
        return { x: view.getFloat32(offset, true), y: view.getFloat32(offset + 4, true) }
      }
    })

    const [transportA, transportB] = MockTransport.createPair()
    const client = new NeonClient({
      transport: transportA,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234,
      registry,
      connectionTimeoutMs: 60000,
      pingIntervalMs: 60000
    })

    void client.connect('127.0.0.1', 7777, 42)
    await transportB.send(makeConnectAcceptPacket(5, 42), '127.0.0.1', 7777)

    const received: Coord[] = []
    client.once<Coord>(0x10, (payload) => received.push(payload))

    const coordPayload = new ArrayBuffer(8)
    const p1 = buildPacket(0x10, 1, 3, DEST_BROADCAST, new Uint8Array(coordPayload))
    const p2 = buildPacket(0x10, 2, 3, DEST_BROADCAST, new Uint8Array(coordPayload))
    await transportB.send(p1, '127.0.0.1', 7777)
    await transportB.send(p2, '127.0.0.1', 7777)

    client.processIncoming()
    expect(received.length).toBe(1)

    await client.disconnect()
  })

  it('throws if connect() is called while already connecting', async () => {
    const [transport] = MockTransport.createPair()
    const client = new NeonClient({
      transport,
      playerName: 'TestPlayer',
      gameIdentifier: 0x1234,
      connectionTimeoutMs: 60000
    })

    void client.connect('127.0.0.1', 7777, 1)
    await expect(client.connect('127.0.0.1', 7777, 2)).rejects.toThrow()
    await client.disconnect()
  })
})

describe('protocol constants', () => {
  it('DEST_BROADCAST is 0', () => {
    expect(DEST_BROADCAST).toBe(0)
  })

  it('DEST_HOST is 1', () => {
    expect(DEST_HOST).toBe(1)
  })

  it('NEON_MAGIC is 0x4E45', () => {
    expect(NEON_MAGIC).toBe(0x4e45)
  })
})
