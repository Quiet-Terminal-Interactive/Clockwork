import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  resolve: {
    alias: {
      '@clockwork/app': fileURLToPath(
        new URL('./engine/core/app/src/index.ts', import.meta.url)
      ),
      '@clockwork/assets': fileURLToPath(
        new URL('./engine/core/assets/src/index.ts', import.meta.url)
      ),
      '@clockwork/audio': fileURLToPath(
        new URL('./engine/core/audio/src/index.ts', import.meta.url)
      ),
      '@clockwork/ecs': fileURLToPath(
        new URL('./engine/core/ecs/src/index.ts', import.meta.url)
      ),
      '@clockwork/events': fileURLToPath(
        new URL('./engine/core/events/src/index.ts', import.meta.url)
      ),
      '@clockwork/input': fileURLToPath(
        new URL('./engine/core/input/src/index.ts', import.meta.url)
      ),
      '@clockwork/scheduler': fileURLToPath(
        new URL('./engine/core/scheduler/src/index.ts', import.meta.url)
      ),
      '@clockwork/serialization': fileURLToPath(
        new URL('./engine/core/serialization/src/index.ts', import.meta.url)
      ),
      '@clockwork/tauri-bridge': fileURLToPath(
        new URL('./engine/platform/tauri-bridge/src/index.ts', import.meta.url)
      ),
      '@clockwork/gl': fileURLToPath(
        new URL('./engine/renderer-webgl2/gl/src/index.ts', import.meta.url)
      ),
      '@clockwork/materials': fileURLToPath(
        new URL(
          './engine/renderer-webgl2/materials/src/index.ts',
          import.meta.url
        )
      ),
      '@clockwork/passes': fileURLToPath(
        new URL('./engine/renderer-webgl2/passes/src/index.ts', import.meta.url)
      ),
      '@clockwork/shaders': fileURLToPath(
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
