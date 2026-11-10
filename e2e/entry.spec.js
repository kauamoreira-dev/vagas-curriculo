import { expect, test } from '@playwright/test'
import { expectSaved, savedResumes } from './helpers'

test('primeira visita: "Criar meu currículo" leva direto ao editor, com 1 toque', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('link', { name: 'Criar meu currículo' }).click()
  await expect(page).toHaveURL(/\/editor$/)
  // Nada é gravado só por abrir: o currículo nasce na primeira edição.
  expect(await savedResumes(page)).toHaveLength(0)

  await page.getByLabel(/Nome completo/).fill('Ana Souza')
  await expectSaved(page, (record) => record.resume.personal.name === 'Ana Souza')
  await expect(page).toHaveURL(/\/editor\/[^/]+$/)

  // Com um currículo salvo, o mesmo botão leva à lista, para escolher ou criar outro.
  await page.goto('/')
  await page.getByRole('link', { name: 'Criar meu currículo' }).click()
  await expect(page).toHaveURL(/\/curriculos$/)
  await expect(page.getByRole('button', { name: 'Novo currículo' })).toBeVisible()
})

test('lista vazia mostra um só botão de criar', async ({ page }) => {
  await page.goto('/curriculos')
  await expect(page.getByRole('button', { name: 'Criar meu primeiro currículo' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Novo currículo' })).toHaveCount(0)
})

test('a página inicial: as folhas em miniatura não empurram o conteúdo e o CLS fica em "bom"', async ({
  page,
  browserName,
}) => {
  test.skip(browserName !== 'chromium', 'Usa a limitação de CPU do Chromium')
  // CPU 4× mais lenta (como num celular comum): a folha leva mais tempo para ser medida.
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  await page.addInitScript(() => {
    window.__cls = 0
    window.__bigShifts = 0
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.hadRecentInput) continue
        window.__cls += entry.value
        // Assinatura do defeito corrigido: a moldura nascia com altura 0 e, ao ser medida, empurrava
        // o texto abaixo centenas de pixels. (A troca da fonte do título move poucos pixels.)
        if (entry.sources.some((source) => source.currentRect.y - source.previousRect.y > 100)) window.__bigShifts += 1
      }
    }).observe({ type: 'layout-shift', buffered: true })
  })
  await page.goto('/')
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
  await page.waitForTimeout(800)
  expect(await page.evaluate(() => window.__bigShifts)).toBe(0)
  // "Bom" pelo Core Web Vitals é até 0,1 (antes desta correção, a página inicial passava disso).
  // O que ainda resta vem da troca da fonte do título quando a fonte web chega.
  expect(await page.evaluate(() => window.__cls)).toBeLessThan(0.1)
})

test('abas Editar/Visualizar: texto da aba inativa com contraste de pelo menos 4,5:1', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'As abas só aparecem no celular e no tablet')
  await page.goto('/editor')
  const ratio = await page.getByRole('tab', { name: 'Visualizar' }).evaluate((tab) => {
    const channels = (value) => value.match(/[\d.]+/g).slice(0, 3).map(Number)
    const luminance = (rgb) => {
      const [r, g, b] = rgb.map((c) => c / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
      return 0.2126 * r + 0.7152 * g + 0.0722 * b
    }
    const text = luminance(channels(getComputedStyle(tab).color))
    const background = luminance(channels(getComputedStyle(tab.parentElement).backgroundColor))
    const [light, dark] = [text, background].sort((a, b) => b - a)
    return (light + 0.05) / (dark + 0.05)
  })
  expect(ratio).toBeGreaterThanOrEqual(4.5)
})
