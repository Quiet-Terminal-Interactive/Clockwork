export const packageId = '@clockwork/audio'

export interface AudioBufferLike {
  duration: number
}

export interface AudioContextLike {
  readonly currentTime: number
  createGain(): GainNodeLike
  createBufferSource(): BufferSourceNodeLike
  decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike>
}

export interface GainNodeLike {
  gain: { value: number }
  connect(target: unknown): void
  disconnect(): void
}

export interface BufferSourceNodeLike {
  buffer: AudioBufferLike | null
  loop: boolean
  playbackRate: { value: number }
  connect(target: unknown): void
  start(when?: number): void
  stop(when?: number): void
  disconnect(): void
  onended: (() => void) | null
}

export interface AudioOptions {
  volume?: number
  pitch?: number
  loop?: boolean
}

/** Decoded audio buffer wrapper exposing duration metadata. */
export class AudioClip {
  constructor(readonly buffer: AudioBufferLike) {}

  get duration(): number {
    return this.buffer.duration
  }
}

/** Named audio routing channel with independent volume and mute controls. */
export class AudioBus {
  volume = 1
  muted = false

  constructor(
    readonly name: string,
    readonly gain: GainNodeLike
  ) {}

  setVolume(volume: number): void {
    this.volume = Math.max(0, volume)
    this.refreshGain()
  }

  setMuted(muted: boolean): void {
    this.muted = muted
    this.refreshGain()
  }

  private refreshGain(): void {
    this.gain.gain.value = this.muted ? 0 : this.volume
  }
}

export class AudioInstance {
  private stopped = false

  constructor(
    readonly id: number,
    readonly clip: AudioClip,
    readonly bus: AudioBus,
    readonly source: BufferSourceNodeLike,
    readonly gain: GainNodeLike
  ) {}

  stop(): void {
    if (this.stopped) {
      return
    }
    this.stopped = true

    try {
      this.source.stop()
    } catch (error) {
      // Some backends throw on double-stop but we prefer a quiet cleanup path.
      console.warn('AudioInstance stop() ignored backend error', {
        error: error instanceof Error ? error.message : String(error),
        id: this.id
      })
    }
    this.source.disconnect()
    this.gain.disconnect()
  }
}

export interface AudioSource {
  clip: AudioClip
  volume: number
  pitch: number
  loop: boolean
  playing: boolean
  bus: string
  instance?: AudioInstance
}
/** WebAudio abstraction managing playback, bus routing, and lifecycle. */
export class AudioEngine {
  readonly buses = new Map<string, AudioBus>()

  private readonly master: AudioBus
  private readonly active = new Map<number, AudioInstance>()
  private nextId = 1
  private disposed = false

  constructor(readonly context: AudioContextLike) {
    this.master = this.createBus('master')
    this.createBus('music')
    this.createBus('sfx')
    this.createBus('ui')
  }

  async decodeClip(data: ArrayBuffer): Promise<AudioClip> {
    this.assertNotDisposed()
    const buffer = await this.context.decodeAudioData(data)
    return new AudioClip(buffer)
  }

  play(clip: AudioClip, bus = 'master', options?: AudioOptions): AudioInstance {
    this.assertNotDisposed()
    if (!Number.isFinite(clip.duration) || clip.duration < 0) {
      throw new Error('Audio clip has invalid duration')
    }

    const volume = options?.volume ?? 1
    if (!Number.isFinite(volume) || volume < 0) {
      throw new Error('Audio option "volume" must be a finite number >= 0')
    }
    const pitch = options?.pitch ?? 1
    if (!Number.isFinite(pitch) || pitch <= 0) {
      throw new Error('Audio option "pitch" must be a finite number > 0')
    }

    const targetBus = this.getOrCreateBus(bus)
    const source = this.context.createBufferSource()
    const gain = this.context.createGain()

    source.buffer = clip.buffer
    source.loop = options?.loop ?? false
    source.playbackRate.value = pitch
    gain.gain.value = volume

    source.connect(gain)
    gain.connect(targetBus.gain)

    const instance = new AudioInstance(
      this.nextId++,
      clip,
      targetBus,
      source,
      gain
    )
    this.active.set(instance.id, instance)

    source.onended = () => {
      this.active.delete(instance.id)
      source.disconnect()
      gain.disconnect()
    }

    source.start(this.context.currentTime)
    return instance
  }

  stop(instance: AudioInstance): void {
    instance.stop()
    this.active.delete(instance.id)
  }

  stopAll(): void {
    for (const instance of this.active.values()) {
      instance.stop()
    }
    this.active.clear()
  }

  setBusVolume(bus: string, volume: number): void {
    this.assertNotDisposed()
    this.getOrCreateBus(bus).setVolume(volume)
  }

  setBusMuted(bus: string, muted: boolean): void {
    this.assertNotDisposed()
    this.getOrCreateBus(bus).setMuted(muted)
  }

  setMasterVolume(volume: number): void {
    this.assertNotDisposed()
    this.master.setVolume(volume)
  }

  getActiveInstances(): readonly AudioInstance[] {
    return [...this.active.values()]
  }

  dispose(): void {
    if (this.disposed) {
      return
    }
    this.stopAll()
    for (const bus of this.buses.values()) {
      bus.gain.disconnect()
    }
    this.disposed = true
  }

  private createBus(name: string): AudioBus {
    const node = this.context.createGain()
    if (name !== 'master') {
      node.connect(this.master.gain)
    }

    const bus = new AudioBus(name, node)
    this.buses.set(name, bus)
    return bus
  }

  private getOrCreateBus(name: string): AudioBus {
    const existing = this.buses.get(name)
    if (existing) {
      return existing
    }
    return this.createBus(name)
  }

  private assertNotDisposed(): void {
    if (this.disposed) {
      throw new Error('AudioEngine has been disposed')
    }
  }
}
export class HeadlessAudioContext implements AudioContextLike {
  currentTime = 0

  createGain(): GainNodeLike {
    return {
      gain: { value: 1 },
      connect() {},
      disconnect() {}
    }
  }

  createBufferSource(): BufferSourceNodeLike {
    return {
      buffer: null,
      loop: false,
      playbackRate: { value: 1 },
      connect() {},
      start: () => {
        this.currentTime += 0.016
      },
      stop() {},
      disconnect() {},
      onended: null
    }
  }

  async decodeAudioData(data: ArrayBuffer): Promise<AudioBufferLike> {
    const bytes = data.byteLength
    return { duration: bytes / 48000 }
  }
}
