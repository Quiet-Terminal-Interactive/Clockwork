import { describe, expect, it } from 'vitest'
import { AudioEngine, HeadlessAudioContext, packageId } from './index'

describe('audio package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-audio')
  })

  it('plays and stops clips through buses', async () => {
    const engine = new AudioEngine(new HeadlessAudioContext())
    const clip = await engine.decodeClip(new Uint8Array([1, 2, 3, 4]).buffer)

    const instance = engine.play(clip, 'sfx', { loop: true, volume: 0.5 })
    expect(engine.getActiveInstances().length).toBe(1)

    engine.stop(instance)
    expect(engine.getActiveInstances().length).toBe(0)
  })

  it('supports bus and master volume control', () => {
    const engine = new AudioEngine(new HeadlessAudioContext())

    engine.setBusVolume('music', 0.2)
    engine.setBusMuted('music', true)
    engine.setMasterVolume(0.8)

    expect(engine.buses.get('music')?.muted).toBe(true)
    expect(engine.buses.get('master')?.volume).toBe(0.8)
  })

  it('rejects invalid play options and disposed engine usage', async () => {
    const engine = new AudioEngine(new HeadlessAudioContext())
    const clip = await engine.decodeClip(new Uint8Array([1, 2, 3]).buffer)

    expect(() => engine.play(clip, 'sfx', { pitch: 0 })).toThrow('pitch')
    expect(() => engine.play(clip, 'sfx', { volume: Number.NaN })).toThrow(
      'volume'
    )

    engine.dispose()
    expect(() => engine.play(clip)).toThrow('disposed')
    expect(() => engine.setMasterVolume(1)).toThrow('disposed')
  })
})

