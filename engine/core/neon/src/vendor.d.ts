declare module '@tauri-apps/plugin-net' {
  interface UdpMessage {
    data: number[]
    remoteAddr: { ip: string; port: number }
  }
  class UdpSocket {
    static bind(addr: string): Promise<UdpSocket>
    send(data: { type: 'Raw'; data: number[] }, addr: string): Promise<void>
    on(event: 'message', handler: (msg: UdpMessage) => void): void
    close(): Promise<void>
  }
  export { UdpSocket }
}
