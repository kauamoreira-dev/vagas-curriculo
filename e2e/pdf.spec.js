import { expect, test } from '@playwright/test'
import {
  A4_HEIGHT as PAGE_HEIGHT,
  PRINT_MARGIN as MARGIN,
  createResume,
  fillWithSample,
  pdfImageDraws,
  pdfImages,
  pdfPages,
  textBaselines,
  uploadPhoto,
} from './helpers'

/*
 * PDF de verdade, gerado pelo Chromium a partir do CSS de impressão (como no "Salvar PDF").
 * Só no projeto desktop: o layout impresso não depende da tela, e page.pdf() é lento.
 */

// Retângulos de 250 px de largura pintados no azul da coluna do Moderno (#0b2470), com sua altura.
const BLUE_COLUMN = /\.0431 \.1412 \.4392 rg[\s\S]{0,60}?0 0 250 ([\d.]+) re/g
const blueColumnHeights = (content) => [...content.matchAll(BLUE_COLUMN)].map(([, height]) => Number(height))

/*
 * Preenchimentos de outra cor pintados por cima da faixa azul (depois dela, sobre x < 250):
 * escondem a coluna mesmo com o retângulo azul presente no PDF.
 */
function fillsOverBlueColumn(content) {
  const start = content.search(BLUE_COLUMN_START)
  if (start < 0) return []
  let color = BLUE // a varredura começa na própria faixa azul
  const covering = []
  for (const line of content.slice(start).split('\n')) {
    const fill = line.match(/([\d.]+ [\d.]+ [\d.]+) rg$/)
    if (fill) color = fill[1]
    const rect = line.match(/^([-\d.]+) [-\d.]+ ([\d.]+) ([\d.]+) re$/)
    if (rect && color !== BLUE && Number(rect[1]) < 250 && Number(rect[2]) >= 250 && Number(rect[3]) > 100) {
      covering.push({ color, line })
    }
  }
  return covering
}
const BLUE = '.0431 .1412 .4392'
const BLUE_COLUMN_START = /0 0 250 1\d{3}(\.\d+)? re/

// A4 a 96 dpi tem 1122,5 px de altura; a área útil, sem as margens de 14 mm do @page, ~1017 px.
const FULL_PAGE = 1100

const TEMPLATES = ['Clássico', 'Moderno', 'Essencial']
const LONG_SUMMARY = Array.from(
  { length: 120 },
  (_, index) => `Frase ${index + 1} de um resumo bem longo, para o currículo passar de uma página.`,
).join(' ')

async function printPdf(page, options = {}) {
  return pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true, ...options }))
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

    test('sem cabeçalho e rodapé do navegador (URL, data, nº de página), mesmo com a opção ligada', async ({
      page,
    }) => {
      await page.getByRole('textbox', { name: 'Resumo profissional' }).fill(LONG_SUMMARY)
      const plain = await printPdf(page)
      // Com displayHeaderFooter, o Chromium desenha data, título, URL e "1/2" na margem da página.
      const withHeaderFooter = await printPdf(page, { displayHeaderFooter: true })
      expect(withHeaderFooter).toHaveLength(plain.length)
      for (const [index, content] of withHeaderFooter.entries()) {
        expect(content, `página ${index + 1}`).toBe(plain[index])
      }
    })

    test('margem de 14 mm no topo e no pé de todas as páginas, em A4', async ({ page }) => {
      await page.getByRole('textbox', { name: 'Resumo profissional' }).fill(LONG_SUMMARY)
      const buffer = await page.pdf({ preferCSSPageSize: true, printBackground: true })
      // A4 em pontos: 595,3 × 841,9 (o Chromium arredonda para px inteiros)
      const [, width, height] = buffer.toString('latin1').match(/\/MediaBox \[0 0 ([\d.]+) ([\d.]+)\]/)
      expect(Number(width)).toBeCloseTo(595.3, 0)
      expect(Number(height)).toBeCloseTo(841.9, 0)
      const pages = pdfPages(buffer)
      expect(pages.length).toBeGreaterThanOrEqual(2)
      for (const [index, content] of pages.entries()) {
        const baselines = textBaselines(content)
        expect(baselines.length, `página ${index + 1}`).toBeGreaterThan(0)
        expect(Math.min(...baselines), `topo da página ${index + 1}`).toBeGreaterThan(MARGIN)
        expect(Math.max(...baselines), `pé da página ${index + 1}`).toBeLessThan(PAGE_HEIGHT - MARGIN)
      }
    })

    test('currículo de 3 páginas: margens em todas e sem cabeçalho/rodapé do navegador', async ({ page }) => {
      // Duas vezes o resumo longo e mais experiências com vários tópicos.
      await page.getByRole('textbox', { name: 'Resumo profissional' }).fill(`${LONG_SUMMARY} ${LONG_SUMMARY}`)
      const description = Array.from({ length: 8 }, (_, index) => `Resultado ${index + 1} com indicadores da área.`)
      for (let count = 0; count < 3; count++) {
        await page.getByRole('button', { name: 'Adicionar experiência' }).click()
        const role = page.getByRole('textbox', { name: /^Cargo/ }).last()
        await role.fill(`Cargo ${count + 1}`)
        await page.getByRole('textbox', { name: 'Atividades e resultados' }).last().fill(description.join('\n'))
      }
      const pages = await printPdf(page)
      expect(pages.length).toBeGreaterThanOrEqual(3)
      expect(await printPdf(page, { displayHeaderFooter: true })).toEqual(pages)
      for (const [index, content] of pages.entries()) {
        const baselines = textBaselines(content)
        expect(Math.min(...baselines), `topo da página ${index + 1}`).toBeGreaterThan(MARGIN)
        expect(Math.max(...baselines), `pé da página ${index + 1}`).toBeLessThan(PAGE_HEIGHT - MARGIN)
      }
    })

    if (template === 'Moderno') {
      test('a coluna azul ocupa a altura toda de cada página', async ({ page }) => {
        await page.getByRole('textbox', { name: 'Resumo profissional' }).fill(LONG_SUMMARY)
        const pages = await printPdf(page)
        for (const [index, content] of pages.entries()) {
          expect(Math.max(0, ...blueColumnHeights(content)), `página ${index + 1}`).toBeGreaterThanOrEqual(
            FULL_PAGE,
          )
          expect(fillsOverBlueColumn(content), `nada cobre a coluna na página ${index + 1}`).toEqual([])
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
