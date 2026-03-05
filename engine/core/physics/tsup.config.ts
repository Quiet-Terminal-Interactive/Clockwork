import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    compilerOptions: {
      baseUrl: '.',
      composite: false,
      paths: {
        'qti-clockwork-app': ['../app/dist/index.d.ts'],
        'qti-clockwork-ecs': ['../ecs/dist/index.d.ts'],
        'qti-clockwork-events': ['../events/dist/index.d.ts'],
        'qti-clockwork-math': ['../math/dist/index.d.ts'],
        'qti-clockwork-scheduler': ['../scheduler/dist/index.d.ts']
      }
    }
  },
  clean: true
})
