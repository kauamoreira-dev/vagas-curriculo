import { defineConfig, devices } from '@playwright/test'

// Porta própria, para não disputar com o `npm run dev` (5174) aberto durante o desenvolvimento.
const PORT = 5175
// Com PLAYWRIGHT_BASE_URL, os testes rodam contra um site já publicado (ex.: a produção na Vercel).
const REMOTE_URL = process.env.PLAYWRIGHT_BASE_URL

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  // Contra um site publicado cada página vem pela internet: menos paralelismo e mais tempo por teste.
  ...(REMOTE_URL && { workers: 4, timeout: 60_000 }),
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  // No CI: anotações nas linhas que falharam + relatório HTML (com traces) publicado como artefato.
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: REMOTE_URL ?? `http://localhost:${PORT}`,
    trace: 'retain-on-failure',
  },
  projects: [
    // Celular com tela de toque (pointer: coarse); os testes de layout também medem 320 e 375 px.
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: REMOTE_URL
    ? undefined
    : {
        command: `npx vite --port ${PORT} --strictPort`,
        url: `http://localhost:${PORT}`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
})
