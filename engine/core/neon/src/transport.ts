/** Transport abstraction so UDP implementation can be swapped for tests or future ports. */

export interface NeonTransport {
  send(data: Uint8Array, address: string, port: number): Promise<void>
  onReceive(
    handler: (data: Uint8Array, address: string, port: number) => void
  ): void
  close(): Promise<void>
}

/** In-memory loopback transport for unit tests. No Tauri dependency. */
export class MockTransport implements NeonTransport {
  private handler: ((data: Uint8Array, address: string, port: number) => void) | null =
    null
  private peer: MockTransport | null = null

  static createPair(): [MockTransport, MockTransport] {
    const a = new MockTransport()
    const b = new MockTransport()
    a.peer = b
    b.peer = a
    return [a, b]
  }

  async send(data: Uint8Array, address: string, port: number): Promise<void> {
    this.peer?.handler?.(data.slice(), address, port)
  }

  onReceive(
    handler: (data: Uint8Array, address: string, port: number) => void
  ): void {
    this.handler = handler
  }

  async close(): Promise<void> {
    this.handler = null
  }
}

/** Production transport backed by Tauri's UDP socket plugin. */
export class TauriUdpTransport implements NeonTransport {
  private socket: import('@tauri-apps/plugin-net').UdpSocket | null = null
  private receiveHandler: ((data: Uint8Array, address: string, port: number) => void) | null =
    null

  onReceive(
    handler: (data: Uint8Array, address: string, port: number) => void
  ): void {
    this.receiveHandler = handler
  }

  async bind(localPort = 0): Promise<void> {
    const { UdpSocket } = await import('@tauri-apps/plugin-net')
    const socket = await UdpSocket.bind(`0.0.0.0:${localPort}`)
    this.socket = socket
    socket.on('message', (msg) => {
      this.receiveHandler?.(
        new Uint8Array(msg.data),
        msg.remoteAddr.ip,
        msg.remoteAddr.port
      )
    })
  }

  async send(data: Uint8Array, address: string, port: number): Promise<void> {
    if (!this.socket) return
    await this.socket.send({ type: 'Raw', data: Array.from(data) }, `${address}:${port}`)
  }

  async close(): Promise<void> {
    if (this.socket) {
      await this.socket.close()
      this.socket = null
    }
  }
}
