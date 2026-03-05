import { type AppBuilder, type Plugin } from 'qti-clockwork-app'
import { type System, type SystemContext } from 'qti-clockwork-scheduler'
import { NeonClient, type NeonClientConfig } from './client.js'
import { type NeonPacketRegistry } from './registry.js'
import { type NeonTransport } from './transport.js'

export const NEON_CLIENT_RESOURCE = 'neon:client'

export interface NeonPluginConfig {
  transport: NeonTransport
  playerName: string
  gameIdentifier: number
  registry?: NeonPacketRegistry
  pingIntervalMs?: number
  connectionTimeoutMs?: number
  maxReconnectAttempts?: number
  reconnectDelayMs?: number
}

/** Clockwork plugin that wires NeonClient into the fixed-tick loop. */
export function NeonPlugin(config: NeonPluginConfig): Plugin {
  return {
    id: 'qti-neon-client',
    version: '1.0.0',
    init(app: AppBuilder) {
      const client = new NeonClient(config as NeonClientConfig)
      app.resources.insert(NEON_CLIENT_RESOURCE, client)
      app.systems.add('FixedUpdate', makeReceiveSystem(client), { order: -1000 })
      app.systems.add('FixedUpdate', makeSendSystem(client), { order: 1000 })
    }
  }
}

/**
 * Runs at the start of FixedUpdate (order -1000): dispatches received packets
 * as ECS events and drives pending-ACK batches.
 */
function makeReceiveSystem(client: NeonClient): System {
  return {
    id: 'neon:receive',
    stage: 'FixedUpdate',
    order: -1000,
    reads: [],
    writes: [],
    execute(_ctx: SystemContext): void {
      client.tickReliability(Date.now())
      client.processIncoming()
    }
  }
}

/**
 * Runs at the end of FixedUpdate (order 1000): sends any packets queued this tick.
 * In the lockstep model this is where the local InputFrame broadcast happens.
 */
function makeSendSystem(_client: NeonClient): System {
  return {
    id: 'neon:send',
    stage: 'FixedUpdate',
    order: 1000,
    reads: [],
    writes: [],
    execute(_ctx: SystemContext): void {
      // Game systems call client.send() directly during their tick.
      // This system is a scheduling anchor — the InputFrame broadcast
      // is the game input system's responsibility, not ours.
    }
  }
}
