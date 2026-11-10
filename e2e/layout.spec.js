import { expect, test } from '@playwright/test'
import { createResume, fillWithSample } from './helpers'

const ROUTES = ['/', '/modelos', '/curriculos', '/editor']
const PHONE_WIDTHS = [320, 375]

// Largura do conteúdo além da janela: > 0 significa rolagem horizontal na página.
const horizontalOverflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)

test.describe('celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'Medidas de celular')

  for (const width of PHONE_WIDTHS) {
    test(`nenhuma página rola de lado em ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      for (const route of ROUTES) {
        await page.goto(route)
        await page.waitForLoadState('networkidle')
        expect(await horizontalOverflow(page), route).toBe(0)
      }
    })

    test(`o editor com conteúdo não rola de lado em ${width}px, nem na folha em tamanho real`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      await createResume(page)
      await fillWithSample(page)
      await page.getByLabel('E-mail').fill(`${'x'.repeat(120)}@email.com`)
      expect(await horizontalOverflow(page)).toBe(0)

      await page.getByRole('tab', { name: 'Visualizar' }).click()
      expect(await horizontalOverflow(page)).toBe(0)

      await page.getByRole('radio', { name: 'Tamanho real' }).click()
      expect(await horizontalOverflow(page)).toBe(0)
      // A rolagem lateral fica dentro da área da folha.
      const scroller = page.locator('[data-actual-size="true"]')
      expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
    })
  }

  test('na aba Editar o cabeçalho fixo é baixo e o modelo fica na aba Visualizar', async ({ page }) => {
    await createResume(page)
    const picker = page.getByRole('radiogroup', { name: 'Modelo do currículo' })
    const stickyHeight = () =>
      page.locator('[data-view] > div').first().evaluate((element) => element.getBoundingClientRect().height)

    await expect(picker).toBeHidden()
    expect(await stickyHeight()).toBeLessThanOrEqual(120)

    await page.getByRole('tab', { name: 'Visualizar' }).click()
    await expect(picker).toBeVisible()
  })

  test('botões visíveis do editor têm pelo menos 44 px de altura', async ({ page }) => {
    await createResume(page)
    await fillWithSample(page)
    for (const view of ['Editar', 'Visualizar']) {
      await page.getByRole('tab', { name: view }).click()
      const small = await page.locator('button:visible').evaluateAll((buttons) =>
        buttons
          .filter((button) => button.getBoundingClientRect().height < 44)
          .map((button) => button.getAttribute('aria-label') || button.textContent.trim()),
      )
      expect(small, `aba ${view}`).toEqual([])
    }
  })

  for (const [scenario, placeEmail] of [
    ['longe, no fim do formulário', (page) => page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))],
    // O caso difícil: o campo já está na janela, mas escondido atrás do cabeçalho fixo.
    [
      'escondido atrás do cabeçalho',
      (page) =>
        page.getByLabel('E-mail').evaluate((element) => {
          window.scrollBy(0, element.getBoundingClientRect().top - 40)
        }),
    ],
  ]) {
    test(`o campo inválido focado ao gerar o PDF fica visível (${scenario})`, async ({ page }) => {
      await createResume(page)
      await fillWithSample(page)
      const email = page.getByLabel('E-mail')
      await email.fill('marina@')
      await email.blur()
      await placeEmail(page)
      page.once('dialog', (dialog) => dialog.dismiss())
      await page.getByRole('button', { name: 'Salvar PDF' }).click()

      await expect(email).toBeFocused()
      const headerBottom = await page
        .locator('[data-view] > div')
        .first()
        .evaluate((element) => element.getBoundingClientRect().bottom)
      await expect
        .poll(() => email.evaluate((element) => element.getBoundingClientRect().top))
        .toBeGreaterThanOrEqual(headerBottom)
    })
  }
})

test.describe('computador', () => {
  test.skip(({ isMobile }) => isMobile, 'Medidas de computador')

  test('o editor ocupa a janela, com formulário e folha lado a lado', async ({ page }) => {
    await createResume(page)
    await expect(page.getByRole('radiogroup', { name: 'Modelo do currículo' })).toBeVisible()
    await expect(page.getByRole('tablist')).toBeHidden()
    expect(await page.evaluate(() => document.documentElement.scrollHeight - innerHeight)).toBe(0)
    expect(await horizontalOverflow(page)).toBe(0)
  })
})
