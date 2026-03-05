export const packageId = 'qti-neon-client'

export {
  NEON_MAGIC,
  NEON_VERSION,
  HEADER_SIZE,
  DEST_BROADCAST,
  DEST_HOST,
  CorePacketType,
  encodeHeader,
  decodeHeader,
  buildPacket,
  encodeConnectRequest,
  decodeConnectAccept,
  decodeConnectDeny,
  decodeSessionConfig,
  encodePing,
  decodePing,
  encodePong,
  decodePong,
  encodeAck,
  decodeAck,
  encodeReconnectRequest,
  type PacketHeader,
  type ConnectRequestPayload,
  type ConnectAcceptPayload,
  type ConnectDenyPayload,
  type SessionConfigPayload
} from './packet.js'

export {
  type NeonTransport,
  MockTransport,
  TauriUdpTransport
} from './transport.js'

export { NeonPacketRegistry, type PacketDescriptor } from './registry.js'

export {
  NeonClient,
  type NeonClientConfig,
  type NeonClientState
} from './client.js'

export {
  NeonPlugin,
  NEON_CLIENT_RESOURCE,
  type NeonPluginConfig
} from './plugin.js'
