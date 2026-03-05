import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: {
    compilerOptions: {
      composite: false
    }
  },
  external: ['@tauri-apps/plugin-net'],
  clean: true
})
