import {
  buildPacket,
  CorePacketType,
  decodeAck,
  decodeConnectAccept,
  decodeConnectDeny,
  decodePing,
  decodePong,
  DEST_BROADCAST,
  DEST_HOST,
  encodeAck,
  encodeConnectRequest,
  encodePing,
  encodePong,
  encodeReconnectRequest,
  HEADER_SIZE,
  NEON_VERSION,
  type PacketHeader,
  decodeHeader
} from './packet.js'
import { NeonPacketRegistry } from './registry.js'
import { type NeonTransport } from './transport.js'

export type NeonClientState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'

export interface NeonClientConfig {
  transport: NeonTransport
  playerName: string
  gameIdentifier: number
  registry?: NeonPacketRegistry
  protocolVersion?: number
  pingIntervalMs?: number
  connectionTimeoutMs?: number
  maxReconnectAttempts?: number
  reconnectDelayMs?: number
}

interface ResolvedConfig {
  readonly transport: NeonTransport
  readonly playerName: string
  readonly gameIdentifier: number
  readonly registry: NeonPacketRegistry
  readonly protocolVersion: number
  readonly pingIntervalMs: number
  readonly connectionTimeoutMs: number
  readonly maxReconnectAttempts: number
  readonly reconnectDelayMs: number
}

interface PendingReliable {
  data: Uint8Array
  retries: number
  nextRetryAt: number
}

interface IncomingItem {
  packetType: number
  senderId: number
  sequence: number
  payload: unknown
}

const MAX_ACK_RETRIES = 5
const DUPLICATE_WINDOW = 128

export class NeonClient {
  private _state: NeonClientState = 'disconnected'
  private _clientId: number | null = null
  private _sessionId: number | null = null
  private _sessionToken: bigint | null = null
  private _ping = 0

  private relayAddress = ''
  private relayPort = 0

  private outgoingSequence = 0
  private readonly seenSequences = new Set<number>()
  private readonly seenSeqOrder: number[] = []

  private readonly pendingAcks = new Map<number, PendingReliable>()
  private readonly incomingQueue: IncomingItem[] = []
  private readonly pendingOutgoingAcks: number[] = []

  private pingIntervalHandle: ReturnType<typeof setInterval> | null = null
  private connectionTimeoutHandle: ReturnType<typeof setTimeout> | null = null
  private reconnectHandle: ReturnType<typeof setTimeout> | null = null
  private pendingPingTimestamp: bigint | null = null

  private reconnectAttempts = 0

  private readonly listeners = new Map<
    number,
    Set<(payload: unknown, senderId: number) => void>
  >()
  private readonly connectedHandlers = new Set<(clientId: number) => void>()
  private readonly disconnectedHandlers = new Set<(reason: string) => void>()
  private readonly peerJoinedHandlers = new Set<(clientId: number) => void>()
  private readonly peerLeftHandlers = new Set<(clientId: number) => void>()
  private readonly reliabilityFailureHandlers = new Set<
    (sequence: number) => void
  >()

  private readonly cfg: ResolvedConfig

  constructor(config: NeonClientConfig) {
    this.cfg = {
      transport: config.transport,
      playerName: config.playerName,
      gameIdentifier: config.gameIdentifier,
      registry: config.registry ?? new NeonPacketRegistry(),
      protocolVersion: config.protocolVersion ?? NEON_VERSION,
      pingIntervalMs: config.pingIntervalMs ?? 5000,
      connectionTimeoutMs: config.connectionTimeoutMs ?? 10000,
      maxReconnectAttempts: config.maxReconnectAttempts ?? 5,
      reconnectDelayMs: config.reconnectDelayMs ?? 1000
    }

    config.transport.onReceive((data) => {
      this.handleIncomingRaw(data)
    })
  }

  get state(): NeonClientState {
    return this._state
  }
  get clientId(): number | null {
    return this._clientId
  }
  get sessionId(): number | null {
    return this._sessionId
  }
  get ping(): number {
    return this._ping
  }

  async connect(
    relayAddress: string,
    relayPort: number,
    sessionId: number
  ): Promise<void> {
    if (this._state !== 'disconnected') {
      throw new Error(`Cannot connect from state "${this._state}"`)
    }
    this.relayAddress = relayAddress
    this.relayPort = relayPort
    this._sessionId = sessionId
    this._state = 'connecting'

    this.sendConnectRequest(sessionId)

    this.connectionTimeoutHandle = setTimeout(() => {
      if (this._state === 'connecting') {
        this.enterDisconnected('connection_timeout', false)
      }
    }, this.cfg.connectionTimeoutMs)
  }

  async disconnect(): Promise<void> {
    if (this._state === 'connected') {
      void this.sendRawAsync(CorePacketType.DisconnectNotice, new Uint8Array(0), DEST_HOST)
    }
    this.enterDisconnected('local_disconnect', false)
    await this.cfg.transport.close()
  }

  send<T>(packetType: number, payload: T, destination = DEST_HOST): void {
    const payloadBytes = this.cfg.registry.serialize(packetType, payload)
    if (!payloadBytes) return
    const packet = buildPacket(
      packetType,
      this.nextSequence(),
      this._clientId ?? 0,
      destination,
      payloadBytes
    )
    void this.cfg.transport.send(packet, this.relayAddress, this.relayPort)
  }

  async sendReliable<T>(
    packetType: number,
    payload: T,
    destination = DEST_HOST
  ): Promise<void> {
    const payloadBytes = this.cfg.registry.serialize(packetType, payload)
    if (!payloadBytes) return
    const seq = this.nextSequence()
    const packet = buildPacket(
      packetType,
      seq,
      this._clientId ?? 0,
      destination,
      payloadBytes
    )
    this.pendingAcks.set(seq, {
      data: packet,
      retries: 0,
      nextRetryAt: Date.now() + 200
    })
    await this.cfg.transport.send(packet, this.relayAddress, this.relayPort)
  }

  broadcast<T>(packetType: number, payload: T): void {
    this.send(packetType, payload, DEST_BROADCAST)
  }

  /** Call once per tick (before game systems) to dispatch received packets. */
  processIncoming(): void {
    if (this.pendingOutgoingAcks.length > 0) {
      const ackPayload = encodeAck(this.pendingOutgoingAcks.splice(0))
      void this.sendRawAsync(CorePacketType.Ack, ackPayload, DEST_HOST)
    }

    const queue = this.incomingQueue.splice(0)
    for (const item of queue) {
      const handlers = this.listeners.get(item.packetType)
      if (!handlers) continue
      for (const handler of handlers) {
        handler(item.payload, item.senderId)
      }
    }
  }

  /** Drive reliable-packet retries; call once per tick with current time in ms. */
  tickReliability(nowMs: number): void {
    for (const [sequence, pending] of this.pendingAcks) {
      if (nowMs < pending.nextRetryAt) continue

      if (pending.retries >= MAX_ACK_RETRIES) {
        this.pendingAcks.delete(sequence)
        for (const h of this.reliabilityFailureHandlers) h(sequence)
        continue
      }

      pending.retries++
      pending.nextRetryAt = nowMs + 200 * Math.pow(2, pending.retries)
      void this.cfg.transport.send(
        pending.data,
        this.relayAddress,
        this.relayPort
      )
    }
  }

  on<T>(
    packetType: number,
    handler: (payload: T, senderId: number) => void
  ): () => void {
    let set = this.listeners.get(packetType)
    if (!set) {
      set = new Set()
      this.listeners.set(packetType, set)
    }
    set.add(handler as (payload: unknown, senderId: number) => void)
    return () => {
      this.listeners
        .get(packetType)
        ?.delete(handler as (payload: unknown, senderId: number) => void)
    }
  }

  once<T>(
    packetType: number,
    handler: (payload: T, senderId: number) => void
  ): () => void {
    const unsub = this.on<T>(packetType, (payload, senderId) => {
      unsub()
      handler(payload, senderId)
    })
    return unsub
  }

  onConnected(handler: (clientId: number) => void): () => void {
    this.connectedHandlers.add(handler)
    return () => this.connectedHandlers.delete(handler)
  }

  onDisconnected(handler: (reason: string) => void): () => void {
    this.disconnectedHandlers.add(handler)
    return () => this.disconnectedHandlers.delete(handler)
  }

  onPeerJoined(handler: (clientId: number) => void): () => void {
    this.peerJoinedHandlers.add(handler)
    return () => this.peerJoinedHandlers.delete(handler)
  }

  onPeerLeft(handler: (clientId: number) => void): () => void {
    this.peerLeftHandlers.add(handler)
    return () => this.peerLeftHandlers.delete(handler)
  }

  onReliabilityFailure(handler: (sequence: number) => void): () => void {
    this.reliabilityFailureHandlers.add(handler)
    return () => this.reliabilityFailureHandlers.delete(handler)
  }

  private handleIncomingRaw(data: Uint8Array): void {
    const header = decodeHeader(data)
    if (!header) return

    const payload = data.subarray(HEADER_SIZE)

    switch (header.packetType) {
      case CorePacketType.ConnectAccept:
        this.handleConnectAccept(payload)
        break
      case CorePacketType.ConnectDeny:
        this.handleConnectDeny(payload)
        break
      case CorePacketType.SessionConfig:
        break
      case CorePacketType.Ping:
        this.handlePing(payload)
        break
      case CorePacketType.Pong:
        this.handlePong(payload)
        break
      case CorePacketType.DisconnectNotice:
        this.handleDisconnectNotice()
        break
      case CorePacketType.Ack:
        this.handleAck(payload)
        break
      default:
        if (header.packetType >= 0x10) {
          this.handleGamePacket(header, payload)
        }
        break
    }
  }

  private handleConnectAccept(payload: Uint8Array): void {
    if (this._state !== 'connecting' && this._state !== 'reconnecting') return

    const accepted = decodeConnectAccept(payload, 0)
    this._clientId = accepted.assignedClientId
    this._sessionToken = accepted.sessionToken
    this._sessionId = accepted.sessionId

    this.clearConnectionTimeout()
    this._state = 'connected'
    this.reconnectAttempts = 0
    this.startPingLoop()

    for (const h of this.connectedHandlers) h(this._clientId)
  }

  private handleConnectDeny(payload: Uint8Array): void {
    const { reason } = decodeConnectDeny(payload, 0)
    this.enterDisconnected(reason, false)
  }

  private handlePing(payload: Uint8Array): void {
    const timestamp = decodePing(payload, 0)
    void this.sendRawAsync(CorePacketType.Pong, encodePong(timestamp), DEST_HOST)
  }

  private handlePong(payload: Uint8Array): void {
    const originalTs = decodePong(payload, 0)
    if (this.pendingPingTimestamp !== null && this.pendingPingTimestamp === originalTs) {
      this._ping = Number(BigInt(Date.now()) - originalTs)
      this.pendingPingTimestamp = null
    }
  }

  private handleDisconnectNotice(): void {
    this.enterDisconnected('server_disconnect', true)
  }

  private handleAck(payload: Uint8Array): void {
    for (const seq of decodeAck(payload, 0)) {
      this.pendingAcks.delete(seq)
    }
  }

  private handleGamePacket(header: PacketHeader, payload: Uint8Array): void {
    if (this.isDuplicate(header.sequence)) return
    this.markSeen(header.sequence)

    this.pendingOutgoingAcks.push(header.sequence)

    const descriptor = this.cfg.registry.get(header.packetType)
    if (!descriptor) {
      return
    }

    const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength)
    const deserialized = descriptor.deserialize(view, 0, payload.length)

    this.incomingQueue.push({
      packetType: header.packetType,
      senderId: header.clientId,
      sequence: header.sequence,
      payload: deserialized
    })
  }

  private sendConnectRequest(sessionId: number): void {
    const payload = encodeConnectRequest({
      clientVersion: this.cfg.protocolVersion,
      playerName: this.cfg.playerName,
      targetSessionId: sessionId,
      gameIdentifier: this.cfg.gameIdentifier
    })
    void this.sendRawAsync(CorePacketType.ConnectRequest, payload, DEST_HOST)
  }

  private sendRawAsync(
    packetType: number,
    payload: Uint8Array,
    destination: number
  ): Promise<void> {
    const packet = buildPacket(
      packetType,
      this.nextSequence(),
      this._clientId ?? 0,
      destination,
      payload
    )
    return this.cfg.transport.send(packet, this.relayAddress, this.relayPort)
  }

  private startPingLoop(): void {
    this.pingIntervalHandle = setInterval(() => {
      if (this._state !== 'connected') return
      const timestamp = BigInt(Date.now())
      this.pendingPingTimestamp = timestamp
      void this.sendRawAsync(CorePacketType.Ping, encodePing(timestamp), DEST_HOST)
    }, this.cfg.pingIntervalMs)
  }

  private stopPingLoop(): void {
    if (this.pingIntervalHandle !== null) {
      clearInterval(this.pingIntervalHandle)
      this.pingIntervalHandle = null
    }
  }

  private clearConnectionTimeout(): void {
    if (this.connectionTimeoutHandle !== null) {
      clearTimeout(this.connectionTimeoutHandle)
      this.connectionTimeoutHandle = null
    }
  }

  private enterDisconnected(reason: string, attemptReconnect: boolean): void {
    this.clearConnectionTimeout()
    if (this.reconnectHandle !== null) {
      clearTimeout(this.reconnectHandle)
      this.reconnectHandle = null
    }
    this.stopPingLoop()

    const wasConnected = this._state === 'connected'
    this._state = 'disconnected'

    if (wasConnected && attemptReconnect) {
      this.scheduleReconnect()
      return
    }

    this._clientId = null
    for (const h of this.disconnectedHandlers) h(reason)
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.cfg.maxReconnectAttempts) {
      this._clientId = null
      this._state = 'disconnected'
      for (const h of this.disconnectedHandlers) h('reconnect_failed')
      return
    }

    this._state = 'reconnecting'
    const delay = this.cfg.reconnectDelayMs * Math.pow(2, this.reconnectAttempts)
    this.reconnectAttempts++

    this.reconnectHandle = setTimeout(() => {
      if (this._state !== 'reconnecting') return

      if (this._sessionToken !== null && this._sessionId !== null) {
        const payload = encodeReconnectRequest(
          this._sessionToken,
          this._sessionId,
          this._clientId ?? 0
        )
        void this.sendRawAsync(
          CorePacketType.ReconnectRequest,
          payload,
          DEST_HOST
        )
      } else {
        this.sendConnectRequest(this._sessionId ?? 0)
      }

      this.connectionTimeoutHandle = setTimeout(() => {
        if (this._state === 'reconnecting') {
          this.scheduleReconnect()
        }
      }, this.cfg.connectionTimeoutMs)
    }, delay)
  }

  private nextSequence(): number {
    const seq = this.outgoingSequence
    this.outgoingSequence = (this.outgoingSequence + 1) & 0xffff
    return seq
  }

  private isDuplicate(sequence: number): boolean {
    return this.seenSequences.has(sequence)
  }

  private markSeen(sequence: number): void {
    this.seenSequences.add(sequence)
    this.seenSeqOrder.push(sequence)
    if (this.seenSeqOrder.length > DUPLICATE_WINDOW) {
      this.seenSequences.delete(this.seenSeqOrder.shift()!)
    }
  }
}
