import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      'qti-clockwork-app': fileURLToPath(
        new URL('./engine/core/app/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-assets': fileURLToPath(
        new URL('./engine/core/assets/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-audio': fileURLToPath(
        new URL('./engine/core/audio/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-ecs': fileURLToPath(
        new URL('./engine/core/ecs/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-events': fileURLToPath(
        new URL('./engine/core/events/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-input': fileURLToPath(
        new URL('./engine/core/input/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-scheduler': fileURLToPath(
        new URL('./engine/core/scheduler/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-serialization': fileURLToPath(
        new URL('./engine/core/serialization/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-tauri-bridge': fileURLToPath(
        new URL('./engine/platform/tauri-bridge/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-gl': fileURLToPath(
        new URL('./engine/renderer-webgl2/gl/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-materials': fileURLToPath(
        new URL(
          './engine/renderer-webgl2/materials/src/index.ts',
          import.meta.url
        )
      ),
      'qti-clockwork-passes': fileURLToPath(
        new URL('./engine/renderer-webgl2/passes/src/index.ts', import.meta.url)
      ),
      'qti-clockwork-shaders': fileURLToPath(
        new URL(
          './engine/renderer-webgl2/shaders/src/index.ts',
          import.meta.url
        )
      )
    }
  },
  test: {
    include: ['engine/**/*.test.ts', 'apps/**/*.test.ts'],
    environment: 'node',
    globals: true
  }
})

