/** Neon protocol wire format: header, core payload encode/decode. All multi-byte values little-endian. */

export const NEON_MAGIC = 0x4e45
export const NEON_VERSION = 1
export const HEADER_SIZE = 8

export const DEST_BROADCAST = 0
export const DEST_HOST = 1

export const enum CorePacketType {
  ConnectRequest = 0x01,
  ConnectAccept = 0x02,
  ConnectDeny = 0x03,
  SessionConfig = 0x04,
  PacketTypeRegistry = 0x05,
  ReconnectRequest = 0x06,
  Ping = 0x0b,
  Pong = 0x0c,
  DisconnectNotice = 0x0d,
  Ack = 0x0e
}

export interface PacketHeader {
  magic: number
  version: number
  packetType: number
  sequence: number
  clientId: number
  destinationId: number
}

export function encodeHeader(h: PacketHeader): Uint8Array {
  const buf = new ArrayBuffer(HEADER_SIZE)
  const view = new DataView(buf)
  view.setUint16(0, h.magic, true)
  view.setUint8(2, h.version)
  view.setUint8(3, h.packetType)
  view.setUint16(4, h.sequence, true)
  view.setUint8(6, h.clientId)
  view.setUint8(7, h.destinationId)
  return new Uint8Array(buf)
}

export function decodeHeader(data: Uint8Array): PacketHeader | null {
  if (data.length < HEADER_SIZE) return null
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const magic = view.getUint16(0, true)
  if (magic !== NEON_MAGIC) return null
  return {
    magic,
    version: view.getUint8(2),
    packetType: view.getUint8(3),
    sequence: view.getUint16(4, true),
    clientId: view.getUint8(6),
    destinationId: view.getUint8(7)
  }
}

/** Assemble a full packet: header + payload bytes into one buffer. */
export function buildPacket(
  packetType: number,
  sequence: number,
  clientId: number,
  destinationId: number,
  payload: Uint8Array
): Uint8Array {
  const result = new Uint8Array(HEADER_SIZE + payload.length)
  result.set(
    encodeHeader({
      magic: NEON_MAGIC,
      version: NEON_VERSION,
      packetType,
      sequence,
      clientId,
      destinationId
    })
  )
  result.set(payload, HEADER_SIZE)
  return result
}

export interface ConnectRequestPayload {
  clientVersion: number
  playerName: string
  targetSessionId: number
  gameIdentifier: number
}

export function encodeConnectRequest(p: ConnectRequestPayload): Uint8Array {
  const encoder = new TextEncoder()
  const nameBytes = encoder.encode(p.playerName.slice(0, 64))
  const buf = new ArrayBuffer(1 + 4 + nameBytes.length + 4 + 4)
  const view = new DataView(buf)
  let offset = 0
  view.setUint8(offset++, p.clientVersion)
  view.setInt32(offset, nameBytes.length, true)
  offset += 4
  new Uint8Array(buf, offset, nameBytes.length).set(nameBytes)
  offset += nameBytes.length
  view.setInt32(offset, p.targetSessionId, true)
  offset += 4
  view.setInt32(offset, p.gameIdentifier, true)
  return new Uint8Array(buf)
}

export interface ConnectAcceptPayload {
  assignedClientId: number
  sessionId: number
  sessionToken: bigint
}

export function decodeConnectAccept(
  data: Uint8Array,
  offset: number
): ConnectAcceptPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return {
    assignedClientId: view.getUint8(offset),
    sessionId: view.getInt32(offset + 1, true),
    sessionToken: view.getBigInt64(offset + 5, true)
  }
}

export interface ConnectDenyPayload {
  reason: string
}

export function decodeConnectDeny(
  data: Uint8Array,
  offset: number
): ConnectDenyPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const reasonLen = view.getInt32(offset, true)
  const reason = new TextDecoder().decode(
    data.subarray(offset + 4, offset + 4 + reasonLen)
  )
  return { reason }
}

export interface SessionConfigPayload {
  version: number
  tickRate: number
  maxPacketSize: number
}

export function decodeSessionConfig(
  data: Uint8Array,
  offset: number
): SessionConfigPayload {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  return {
    version: view.getUint8(offset),
    tickRate: view.getInt16(offset + 1, true),
    maxPacketSize: view.getInt16(offset + 3, true)
  }
}

export function encodePing(timestamp: bigint): Uint8Array {
  const buf = new ArrayBuffer(8)
  new DataView(buf).setBigInt64(0, timestamp, true)
  return new Uint8Array(buf)
}

export function decodePing(data: Uint8Array, offset: number): bigint {
  return new DataView(data.buffer, data.byteOffset, data.byteLength).getBigInt64(
    offset,
    true
  )
}

export const encodePong = encodePing
export const decodePong = decodePing

export function encodeAck(sequences: number[]): Uint8Array {
  const buf = new ArrayBuffer(4 + sequences.length * 2)
  const view = new DataView(buf)
  view.setInt32(0, sequences.length, true)
  for (let i = 0; i < sequences.length; i++) {
    view.setUint16(4 + i * 2, sequences[i]!, true)
  }
  return new Uint8Array(buf)
}

export function decodeAck(data: Uint8Array, offset: number): number[] {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const count = view.getInt32(offset, true)
  const sequences: number[] = new Array(count)
  for (let i = 0; i < count; i++) {
    sequences[i] = view.getUint16(offset + 4 + i * 2, true)
  }
  return sequences
}

export function encodeReconnectRequest(
  sessionToken: bigint,
  targetSessionId: number,
  previousClientId: number
): Uint8Array {
  const buf = new ArrayBuffer(8 + 4 + 1)
  const view = new DataView(buf)
  view.setBigInt64(0, sessionToken, true)
  view.setInt32(8, targetSessionId, true)
  view.setUint8(12, previousClientId)
  return new Uint8Array(buf)
}
