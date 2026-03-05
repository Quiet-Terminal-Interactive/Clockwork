import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/fixed.ts', 'src/vec2.ts', 'src/aabb.ts'],
  format: ['esm', 'cjs'],
  dts: {
    compilerOptions: {
      composite: false,
    },
  },
  clean: true,
})
