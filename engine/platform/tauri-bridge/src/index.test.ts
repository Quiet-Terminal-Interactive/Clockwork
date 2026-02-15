import { describe, expect, it } from 'vitest'
import {
  HeadlessWindow,
  MemoryFileSystem,
  SystemTimeSource,
  packageId
} from './index'

describe('tauri-bridge package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('@clockwork/tauri-bridge')
  })
})

describe('memory file system', () => {
  it('reads, writes, lists, and watches files', async () => {
    const fs = new MemoryFileSystem({
      'assets/config.json': new TextEncoder().encode('{"v":1}')
    })

    const before = await fs.readFile('assets/config.json')
    expect(new TextDecoder().decode(before)).toBe('{"v":1}')

    let changes = 0
    const stop = fs.watch('assets/config.json', () => {
      changes += 1
    })

    await fs.writeFile(
      'assets/config.json',
      new TextEncoder().encode('{"v":2}')
    )
    stop()

    const after = await fs.readFile('assets/config.json')
    expect(new TextDecoder().decode(after)).toBe('{"v":2}')
    expect(await fs.listDir('assets')).toEqual(['config.json'])
    expect(changes).toBe(1)
  })
})

describe('headless window and time source', () => {
  it('tracks mutable window state without platform dependencies', () => {
    const window = new HeadlessWindow({ width: 320, height: 240 })
    expect(window.getSize()).toEqual({ width: 320, height: 240 })

    window.setSize(800, 600)
    window.setTitle('Clockwork Test')
    window.setFullscreen(true)
    window.close()

    expect(window.getSize()).toEqual({ width: 800, height: 600 })
    expect(window.isFullscreen()).toBe(true)
    expect(window.getTitle()).toBe('Clockwork Test')
    expect(window.isClosed()).toBe(true)
  })

  it('provides monotonic timestamps when available', () => {
    const time = new SystemTimeSource()
    expect(time.now()).toBeTypeOf('number')
  })
})
