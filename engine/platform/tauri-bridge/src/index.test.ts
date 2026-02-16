import { describe, expect, it, vi } from 'vitest'
import {
  ConsoleLogger,
  CrashReportingLogger,
  RuntimeConfigLoader,
  HeadlessWindow,
  MemoryFileSystem,
  SystemTimeSource,
  TauriCrashLogger,
  TauriFileSystem,
  TauriPathProvider,
  TauriWindowAdapter,
  packageId,
  type CrashLogger
} from './index'

describe('tauri-bridge package', () => {
  it('exports stable package id', () => {
    expect(packageId).toBe('qti-clockwork-tauri-bridge')
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

  it('rejects malformed invoke payloads', async () => {
    const calls: string[] = []
    const fs = new TauriFileSystem({
      async invoke<T>(command: string): Promise<T> {
        calls.push(command)
        if (command === 'read_file') {
          return [1, 300] as T
        }
        if (command === 'list_dir') {
          return ['ok', 123] as T
        }
        return undefined as T
      }
    })

    await expect(fs.readFile('bad.bin')).rejects.toThrow('invalid byte')
    await expect(fs.listDir('dir')).rejects.toThrow('invalid payload')
    expect(calls).toContain('log_crash')
  })

  it('poll watch only emits on explicit change and survives transient errors', async () => {
    vi.useFakeTimers()
    try {
      let tick = 0
      const changes: number[] = []
      const fs = new TauriFileSystem({
        async invoke<T>(command: string): Promise<T> {
          if (command !== 'watch_ping') {
            return undefined as T
          }
          tick += 1
          if (tick === 1) {
            throw new Error('temporary failure')
          }
          return (tick === 3) as T
        }
      })

      const stop = fs.watch('assets/config.json', () => {
        changes.push(tick)
      })

      await vi.runOnlyPendingTimersAsync()
      await vi.runOnlyPendingTimersAsync()
      await vi.runOnlyPendingTimersAsync()
      stop()
      await vi.runOnlyPendingTimersAsync()

      expect(changes).toEqual([3])
    } finally {
      vi.useRealTimers()
    }
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

describe('runtime config loader', () => {
  it('merges defaults, env, and file config with validation', async () => {
    const fs = new MemoryFileSystem({
      'config/runtime.json': new TextEncoder().encode(
        JSON.stringify({ modRoot: 'mods-live', enableCrashReporting: true })
      )
    })
    const loader = new RuntimeConfigLoader(fs, {
      CLOCKWORK_LOG_LEVEL: 'debug',
      CLOCKWORK_ASSET_ROOT: 'assets-dev'
    })

    const file = await loader.loadFromFile('config/runtime.json')
    const env = loader.loadFromEnv()
    const merged = loader.merge(env, file)

    expect(merged.logLevel).toBe('debug')
    expect(merged.assetRoot).toBe('assets-dev')
    expect(merged.modRoot).toBe('mods-live')
    expect(merged.enableCrashReporting).toBe(true)
  })

  it('rejects path traversal in file config', async () => {
    const fs = new MemoryFileSystem({
      'config/bad.json': new TextEncoder().encode(
        JSON.stringify({ modRoot: '../../etc' })
      )
    })
    const loader = new RuntimeConfigLoader(fs)
    await expect(loader.loadFromFile('config/bad.json')).rejects.toThrow(
      'path traversal'
    )
  })

  it('rejects path traversal in env config', () => {
    const loader = new RuntimeConfigLoader(new MemoryFileSystem(), {
      CLOCKWORK_ASSET_ROOT: '../../../secrets'
    })
    expect(() => loader.loadFromEnv()).toThrow('path traversal')
  })

  it('filters logger output by level', () => {
    const entries: string[] = []
    const logger = new ConsoleLogger('warn', {
      debug(message: string) {
        entries.push(`debug:${message}`)
      },
      info(message: string) {
        entries.push(`info:${message}`)
      },
      warn(message: string) {
        entries.push(`warn:${message}`)
      },
      error(message: string) {
        entries.push(`error:${message}`)
      }
    })

    logger.info('skip')
    logger.warn('keep')
    logger.error('also-keep')
    expect(entries).toEqual(['warn:keep', 'error:also-keep'])
  })

  it('escalates repeated crash telemetry failures to error level', async () => {
    const entries: string[] = []
    const sink = {
      debug(message: string) {
        entries.push(`debug:${message}`)
      },
      info(message: string) {
        entries.push(`info:${message}`)
      },
      warn(message: string) {
        entries.push(`warn:${message}`)
      },
      error(message: string) {
        entries.push(`error:${message}`)
      }
    }
    const fallback = new ConsoleLogger('debug', sink)
    const crashLogger: CrashLogger = {
      async log(): Promise<void> {
        throw new Error('telemetry down')
      }
    }

    const logger = new CrashReportingLogger(crashLogger, fallback)

    // Fire 4 errors and wait for each telemetry attempt to settle.
    for (let i = 0; i < 4; i += 1) {
      logger.error(`crash-${i}`)
      await new Promise((resolve) => setTimeout(resolve, 0))
    }

    // First 2 telemetry failures should be warn-level, 3rd+ should escalate to error.
    const telemetryMessages = entries.filter((entry) =>
      entry.includes('telemetry submission failed')
    )
    expect(telemetryMessages.length).toBe(4)
    expect(telemetryMessages[0]).toMatch(/^warn:/)
    expect(telemetryMessages[2]).toMatch(/^error:/)
  })
})

