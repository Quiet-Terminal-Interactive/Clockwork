import { describe, expect, it } from 'vitest'
import {
  HeadlessWindow,
  MemoryFileSystem,
  SystemTimeSource,
  TauriCrashLogger,
  TauriFileSystem,
  TauriPathProvider,
  TauriWindowAdapter,
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

describe('tauri adapters', () => {
  it('proxies file operations through tauri invoke', async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = []
    const tauri = {
      async invoke<T>(
        command: string,
        args?: Record<string, unknown>
      ): Promise<T> {
        calls.push({ command, ...(args !== undefined && { args }) })
        if (command === 'read_file') {
          return [1, 2, 3] as T
        }
        if (command === 'list_dir') {
          return ['a', 'b'] as T
        }
        return undefined as T
      }
    }

    const fs = new TauriFileSystem(tauri)
    expect(await fs.readFile('a.bin')).toEqual(Uint8Array.of(1, 2, 3))
    expect(await fs.listDir('/')).toEqual(['a', 'b'])
    await fs.writeFile('x', Uint8Array.of(4))
    expect(calls.map((call) => call.command)).toContain('write_file')
  })

  it('tracks tauri window state and crash logs', async () => {
    const window = new TauriWindowAdapter({
      setSize() {},
      setTitle() {},
      isFullscreen() {
        return true
      },
      setFullscreen() {},
      close() {},
      innerSize() {
        return { width: 900, height: 700 }
      }
    })

    window.setFullscreen(true)
    await window.refreshSize()
    expect(window.getSize()).toEqual({ width: 900, height: 700 })
    expect(window.isFullscreen()).toBe(true)

    const calls: string[] = []
    const tauri = {
      async invoke<T>(command: string): Promise<T> {
        calls.push(command)
        if (command === 'app_data_dir') {
          return '/tmp/app' as T
        }
        return undefined as T
      }
    }

    const path = new TauriPathProvider(tauri)
    expect(await path.appDataDir()).toBe('/tmp/app')

    const crash = new TauriCrashLogger(tauri)
    await crash.log(new Error('boom'))
    expect(calls).toContain('log_crash')
  })
})
