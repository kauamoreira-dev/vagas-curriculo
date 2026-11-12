import { expect, test } from '@playwright/test'

test.describe('computador', () => {
  test.skip(({ isMobile }) => isMobile, 'Medidas de computador')

  test('os títulos dos três passos ficam na mesma linha, mesmo com textos de tamanhos diferentes', async ({ page }) => {
    await page.goto('/')
    const titles = page.locator('#como-funciona h3')
    await expect(titles).toHaveCount(3)
    const tops = await titles.evaluateAll((elements) => elements.map((element) => element.getBoundingClientRect().top))
    expect(Math.max(...tops) - Math.min(...tops)).toBeLessThan(1)
  })
})

test.describe('celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'Medidas de celular')

  test('carrossel de modelos: cada cartão é alcançado pelo teclado e fica à vista ao receber o foco', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const cards = page.locator('a[href^="/editor?modelo="]')
    await expect(cards).toHaveCount(3)
    for (const name of ['Clássico', 'Moderno', 'Essencial']) {
      const card = cards.filter({ hasText: name })
      await card.focus()
      await expect(card).toBeFocused()
      // O cartão focado rola para dentro da tela (a faixa tem rolagem lateral própria).
      await expect
        .poll(async () => {
          const box = await card.boundingBox()
          return box.x >= 0 && box.x + box.width <= 375
        })
        .toBe(true)
    }
    // A rolagem lateral fica na faixa: a página não rola de lado.
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
  })

  test('o nome de cada cartão de modelo é curto: modelo, área indicada e ação (sem o texto da miniatura)', async ({
    page,
  }) => {
    await page.goto('/')
    await expect(page.locator('a[href="/editor?modelo=moderno"]')).toHaveAccessibleName(
      'Moderno Tecnologia, marketing, comercial Usar este modelo',
    )
  })

  test('as anotações do exemplo têm números sobre a folha, na mesma ordem da legenda', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/')
    const notes = page.getByRole('list', { name: 'Anotações sobre o exemplo' }).getByRole('listitem')
    await expect(notes).toHaveCount(4)
    const markers = page.locator('figure [aria-hidden="true"]').filter({ hasText: /^[1-4]$/ })
    await expect(markers).toHaveText(['1', '2', '3', '4'])
    for (const marker of await markers.all()) await expect(marker).toBeVisible()
  })
})
