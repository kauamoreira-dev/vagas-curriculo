import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5174,
  },
  test: {
    // Testes puros rodam em node; os que precisam de DOM declaram `// @vitest-environment jsdom`.
    environment: 'node',
    setupFiles: ['./src/test/setup.js'],
  },
})
