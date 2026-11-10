import { createHash } from 'node:crypto'
import { expect, test } from '@playwright/test'

// Nome do site em todos os lugares em que aparece; o símbolo da logo é o arquivo oficial, sem mudanças.
const NAME = 'Currículo Tapajós'

test('o nome do site aparece na aba, na logo e no rodapé', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(NAME)
  expect(await page.locator('meta[name="description"]').getAttribute('content')).toContain(NAME)

  const logo = page.getByRole('link', { name: `${NAME} — página inicial` }).first()
  await expect(logo).toBeVisible()
  await expect(logo).toContainText(NAME)
  await expect(page.getByRole('contentinfo')).toContainText(NAME)
  await expect(page.locator('body')).not.toContainText('Vagas Currículo')
})

// Arquivo oficial da marca: não pode mudar. As páginas exibem cópias reduzidas dele.
const OFFICIAL_LOGO = '/brand/logo-vagas-curriculo.png'
const OFFICIAL_SHA256 = 'c77d17ba9a4cd0155eb34595ab0f916f470ead61b3b33b5cf1447129ac6cd880'

test('o arquivo oficial da logo continua publicado, sem nenhuma alteração', async ({ request }) => {
  const response = await request.get(OFFICIAL_LOGO)
  expect(response.ok()).toBe(true)
  expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(OFFICIAL_SHA256)
})

test('a logo usa as cópias leves (72/144 px), nítidas para a densidade da tela', async ({ page }) => {
  const logos = []
  page.on('response', (response) => {
    if (response.url().includes('/brand/')) logos.push(response)
  })
  await page.goto('/')
  const image = page.locator('header img[src^="/brand/"]').first()
  // Espera o download terminar: instantâneo localmente, mais lento pela internet.
  await expect
    .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0), { timeout: 20_000 })
    .toBe(true)

  const { currentSrc, naturalWidth, renderedWidth, dpr } = await image.evaluate((element) => ({
    currentSrc: new URL(element.currentSrc).pathname,
    naturalWidth: element.naturalWidth,
    renderedWidth: element.getBoundingClientRect().width,
    dpr: window.devicePixelRatio,
  }))
  expect(currentSrc).toBe(dpr > 1 ? '/brand/logo-vagas-curriculo-144.png' : '/brand/logo-vagas-curriculo-72.png')
  // Nítida: o arquivo escolhido tem pelo menos os pixels físicos em que é desenhado (até 2×).
  // (Com srcset por densidade, naturalWidth vem dividido pela densidade; por isso o tamanho do arquivo.)
  const filePixels = currentSrc.endsWith('-144.png') ? 144 : 72
  expect(naturalWidth).toBeGreaterThan(0)
  expect(filePixels).toBeGreaterThanOrEqual(Math.ceil(renderedWidth * Math.min(dpr, 2)))

  // O arquivo oficial (~1 MB) não é baixado pela página; o que se baixa é leve.
  expect(logos.map((response) => new URL(response.url()).pathname)).not.toContain(OFFICIAL_LOGO)
  for (const response of logos) expect((await response.body()).length).toBeLessThan(30_000)

  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/brand/logo-vagas-curriculo-72.png')
  await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
    'href',
    '/brand/logo-vagas-curriculo-144.png',
  )
})

for (const width of [320, 375]) {
  test(`em ${width}px a logo não encosta nos botões do cabeçalho`, async ({ page, isMobile }) => {
    test.skip(!isMobile, 'Medida de celular')
    await page.setViewportSize({ width, height: 700 })
    for (const [route, control] of [
      ['/editor', page.getByRole('button', { name: 'Salvar PDF' })],
      ['/', page.getByRole('button', { name: /menu/i })],
    ]) {
      await page.goto(route)
      // Mede com as fontes da logo já carregadas: antes disso o nome aparece na fonte reserva do
      // sistema, que no Linux do CI é mais larga e deixa só ~3px (instável, não reflete o site pronto).
      await page.evaluate(() =>
        Promise.all([document.fonts.load('700 1em "Public Sans"'), document.fonts.load('italic 400 1em Newsreader')]),
      )
      const logo = await page.getByRole('link', { name: `${NAME} — página inicial` }).first().boundingBox()
      const next = await control.boundingBox()
      expect(next.x - (logo.x + logo.width), `${route}: espaço entre a logo e o botão`).toBeGreaterThanOrEqual(8)
    }
  })
}

test('cada página põe o nome do site no título da aba', async ({ page }) => {
  await page.goto('/curriculos')
  await expect(page).toHaveTitle(`Meus currículos · ${NAME}`)
  await page.goto('/editor')
  await expect(page).toHaveTitle(`Editor · ${NAME}`)
  await expect(page.getByRole('link', { name: `${NAME} — página inicial` })).toBeVisible()
})
