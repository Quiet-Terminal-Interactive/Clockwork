import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    target: 'es2022',
    minify: 'esbuild',
    cssCodeSplit: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['qti-clockwork-ecs']
        }
      }
    }
  }
})

