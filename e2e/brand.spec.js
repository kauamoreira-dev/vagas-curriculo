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

test('a logo continua sendo o arquivo oficial e carrega', async ({ page }) => {
  await page.goto('/')
  const image = page.locator('img[src="/brand/logo-vagas-curriculo.png"]').first()
  await expect(image).toBeAttached()
  // Espera o download terminar: instantâneo localmente, mas o PNG oficial tem ~950 KB pela internet.
  await expect
    .poll(() => image.evaluate((element) => element.complete && element.naturalWidth > 0), { timeout: 20_000 })
    .toBe(true)
  await expect(page.locator('link[rel="icon"]')).toHaveAttribute('href', '/brand/logo-vagas-curriculo.png')
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
