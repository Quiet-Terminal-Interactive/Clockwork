/** Game packet registry: associates packet type IDs with typed serialize/deserialize functions. */

export interface PacketDescriptor<T = unknown> {
  id: number
  name: string
  /** Write payload into view starting at offset; return number of bytes written. */
  serialize(payload: T, view: DataView, offset: number): number
  /** Read payload from view; offset is start of payload, length is payload byte count. */
  deserialize(view: DataView, offset: number, length: number): T
}

export class NeonPacketRegistry {
  private readonly descriptors = new Map<number, PacketDescriptor<unknown>>()

  register<T>(descriptor: PacketDescriptor<T>): void {
    this.descriptors.set(descriptor.id, descriptor as PacketDescriptor<unknown>)
  }

  get(id: number): PacketDescriptor<unknown> | undefined {
    return this.descriptors.get(id)
  }

  /** Serialize a game payload to bytes, or null if the type is unregistered. */
  serialize(id: number, payload: unknown): Uint8Array | null {
    const descriptor = this.descriptors.get(id)
    if (!descriptor) return null
    const buf = new ArrayBuffer(65507)
    const view = new DataView(buf)
    const written = descriptor.serialize(payload, view, 0)
    return new Uint8Array(buf, 0, written)
  }

  /** Deserialize a game payload from a DataView slice, or null if unregistered. */
  deserialize(
    id: number,
    view: DataView,
    offset: number,
    length: number
  ): unknown | null {
    const descriptor = this.descriptors.get(id)
    if (!descriptor) return null
    return descriptor.deserialize(view, offset, length)
  }
}
