import { expect, test } from '@playwright/test'
import { createResume, fillWithSample, pdfImageDraws, pdfImages, pdfPages, uploadPhoto } from './helpers'

/*
 * PDF de verdade, gerado pelo Chromium a partir do CSS de impressão (como no "Salvar PDF").
 * Só no projeto desktop: o layout impresso não depende da tela, e page.pdf() é lento.
 */

// Retângulos de 250 px de largura pintados no azul da coluna do Moderno (#0b2470), com sua altura.
const BLUE_COLUMN = /\.0431 \.1412 \.4392 rg[\s\S]{0,60}?0 0 250 ([\d.]+) re/g
const blueColumnHeights = (content) => [...content.matchAll(BLUE_COLUMN)].map(([, height]) => Number(height))

// A4 a 96 dpi tem 1122,5 px de altura; a área útil, sem as margens de 14 mm do @page, ~1017 px.
const FULL_PAGE = 1100

const TEMPLATES = ['Clássico', 'Moderno', 'Essencial']
const LONG_SUMMARY = Array.from(
  { length: 120 },
  (_, index) => `Frase ${index + 1} de um resumo bem longo, para o currículo passar de uma página.`,
).join(' ')

async function printPdf(page) {
  return pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
}

test.beforeEach(async ({ page, isMobile }) => {
  test.skip(isMobile, 'O PDF é igual em qualquer tela; basta gerá-lo no desktop.')
  await createResume(page)
  await fillWithSample(page)
})

for (const template of TEMPLATES) {
  test.describe(`modelo ${template}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('radio', { name: template }).click()
    })

    test('o exemplo cabe em uma página', async ({ page }) => {
      expect(await printPdf(page)).toHaveLength(1)
    })

    test('conteúdo longo continua nas páginas seguintes', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Resumo profissional' }).fill(LONG_SUMMARY)
      expect((await printPdf(page)).length).toBeGreaterThanOrEqual(2)
    })

    if (template === 'Moderno') {
      test('a coluna azul ocupa a altura toda de cada página', async ({ page }) => {
        await page.getByRole('textbox', { name: 'Resumo profissional' }).fill(LONG_SUMMARY)
        const pages = await printPdf(page)
        for (const [index, content] of pages.entries()) {
          expect(Math.max(0, ...blueColumnHeights(content)), `página ${index + 1}`).toBeGreaterThanOrEqual(
            FULL_PAGE,
          )
        }
      })
    } else {
      test('não tem coluna lateral azul', async ({ page }) => {
        const [content] = await printPdf(page)
        expect(blueColumnHeights(content)).toEqual([])
      })
    }
  })
}

test.describe('foto de perfil', () => {
  test.beforeEach(async ({ page }) => {
    await uploadPhoto(page)
  })

  for (const template of TEMPLATES) {
    test(`aparece no PDF do modelo ${template}: o JPEG 400×400 desenhado uma vez, quadrado`, async ({ page }) => {
      await page.getByRole('radio', { name: template }).click()
      const buffer = await page.pdf({ preferCSSPageSize: true, printBackground: true })

      // A foto preparada pelo app (recorte quadrado em JPEG de 400 px) vai embutida sem conversão.
      expect(pdfImages(buffer)).toEqual([{ width: 400, height: 400, jpeg: true }])
      const [firstPage, ...rest] = pdfPages(buffer)
      const draws = pdfImageDraws(firstPage)
      expect(draws).toHaveLength(1)
      expect(draws[0].width).toBeGreaterThan(0)
      expect(draws[0].width).toBeCloseTo(draws[0].height, 3)
      for (const content of rest) expect(pdfImageDraws(content)).toEqual([])
    })
  }

  test('fica fora do PDF quando a pessoa a oculta', async ({ page }) => {
    await page.getByRole('checkbox', { name: 'Mostrar foto no currículo' }).uncheck()
    for (const template of TEMPLATES) {
      await page.getByRole('radio', { name: template }).click()
      const buffer = await page.pdf({ preferCSSPageSize: true, printBackground: true })
      expect(pdfImages(buffer), template).toEqual([])
      expect(pdfImageDraws(pdfPages(buffer)[0]), template).toEqual([])
    }
  })

  test('no Moderno, a foto não apaga a coluna azul', async ({ page }) => {
    await page.getByRole('radio', { name: 'Moderno' }).click()
    const [content] = await printPdf(page)
    expect(Math.max(0, ...blueColumnHeights(content))).toBeGreaterThanOrEqual(FULL_PAGE)
    expect(pdfImageDraws(content)).toHaveLength(1)
  })
})

test('na impressão só a folha aparece, sem a interface do editor', async ({ page }) => {
  await page.getByRole('radio', { name: 'Essencial' }).click()
  await page.emulateMedia({ media: 'print' })
  await expect(page.locator('#root')).toBeHidden()
  const sheet = page.locator('.print-only')
  await expect(sheet).toBeVisible()
  await expect(sheet.getByRole('heading', { level: 1 })).toHaveText('Marina Albuquerque')
  await expect(sheet.getByText('Usar exemplo')).toHaveCount(0)
})
