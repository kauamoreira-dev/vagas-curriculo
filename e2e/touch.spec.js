import { expect, test } from '@playwright/test'
import { createResume } from './helpers'

const WIDTHS = [320, 375, 390, 430]

// Altura e largura (até o texto) de um elemento clicável.
const box = (locator) =>
  locator.evaluate((element) => {
    const rect = element.getBoundingClientRect()
    return { width: rect.width, height: rect.height }
  })

test.describe('celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'Medidas de celular')

  for (const width of WIDTHS) {
    test(`em ${width}px cabeçalho, rodapé e links do site têm área de toque de 44px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await page.goto('/')
      const targets = [
        page.getByRole('link', { name: 'Currículo Tapajós — página inicial' }).first(),
        page.getByRole('button', { name: /menu/i }),
        page.getByRole('link', { name: 'Comparar modelos' }),
        ...['Modelos', 'Editor', 'Meus currículos', 'Como funciona'].map((name) =>
          page.getByRole('contentinfo').getByRole('link', { name, exact: true }),
        ),
      ]
      for (const target of targets) {
        const { height, width: targetWidth } = await box(target)
        expect(height, await target.textContent()).toBeGreaterThanOrEqual(44)
        expect(targetWidth).toBeGreaterThanOrEqual(44)
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    })
  }

  test('no editor, o símbolo da marca (sem o nome) tem área de toque de 44px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 700 })
    await createResume(page)
    // Espera o editor terminar de abrir (na transição, o logo da lista ainda está na tela).
    await expect(page.getByLabel(/Nome completo/)).toBeVisible()
    const logo = await box(page.getByRole('link', { name: 'Currículo Tapajós — página inicial' }))
    expect(logo.width).toBeGreaterThanOrEqual(44)
    expect(logo.height).toBeGreaterThanOrEqual(44)
  })
})

test('placeholders dos campos com contraste de pelo menos 4,5:1', async ({ page }) => {
  await createResume(page)
  const ratio = await page.getByLabel('Cargo ou área').evaluate((input) => {
    const channels = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number)
    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const text = luminance(channels(getComputedStyle(input, '::placeholder').color))
    const background = luminance(channels(getComputedStyle(input).backgroundColor))
    const [light, dark] = [text, background].sort((a, b) => b - a)
    return (light + 0.05) / (dark + 0.05)
  })
  expect(ratio).toBeGreaterThanOrEqual(4.5)
})

test('página inicial sem deslocamento perceptível enquanto as fontes carregam (CLS ~0)', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Usa a limitação de CPU do Chromium')
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    window.__cls = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) if (!entry.hadRecentInput) window.__cls += entry.value
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
  // Com a fonte de reserva calibrada, o título não muda de quebra quando a Newsreader chega.
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.02)
})
