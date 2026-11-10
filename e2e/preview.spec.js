import { expect, test } from '@playwright/test'
import { RESUME_PREFIX, createResume, fillWithSample, pdfPages } from './helpers'

const TEMPLATES = [
  ['classico', 'Clássico'],
  ['moderno', 'Moderno'],
  ['essencial', 'Essencial'],
]

const job = (n, bullets) => ({
  id: `e${n}`,
  role: `Cargo ${n + 1}`,
  company: 'Empresa de exemplo Ltda.',
  start: `mar/${2005 + n}`,
  end: `fev/${2006 + n}`,
  description: Array.from({ length: bullets }, (_, i) => `Resultado ${i + 1}: organizei processos da área.`).join('\n'),
})

// Tópico longo (2 linhas): experiências de 6 tópicos viram blocos grandes que não se partem.
const LONG_LINE = 'Coordenei a reestruturação completa dos processos de atendimento e dos indicadores da área comercial.'
const bigJob = (n) => ({ ...job(n, 6), description: Array.from({ length: 6 }, () => LONG_LINE).join('\n') })

// Currículos de tamanhos diferentes: curto, longo por um parágrafo, longo por experiências e o
// pior caso para a estimativa (blocos grandes perto do fim das páginas, que deixam vãos).
const RESUMES = {
  curto: { experience: [job(0, 3)] },
  'resumo longo': { experience: [job(0, 3)], summary: 'Frase de teste para o resumo. '.repeat(160) },
  'muitas experiências': { experience: Array.from({ length: 12 }, (_, n) => job(n, 6)) },
  'blocos grandes (6)': { experience: Array.from({ length: 6 }, (_, n) => bigJob(n)), education: [] },
  'blocos grandes (9)': { experience: Array.from({ length: 9 }, (_, n) => bigJob(n)), education: [] },
}

async function openResume(page, templateId, extra) {
  const record = {
    id: `prev-${templateId}-${Object.keys(extra).join('')}-${extra.experience.length}`,
    title: '',
    templateId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    resume: {
      personal: { name: 'Ana Souza', title: 'Analista', email: 'ana@email.com', phone: '(91) 90000-0000', city: 'Belém', state: 'PA' },
      summary: 'Resumo curto.',
      education: [{ id: 'f1', course: 'Administração', institution: 'Universidade', start: '2010', end: '2014' }],
      skills: ['Excel', 'SQL'],
      ...extra,
    },
  }
  await page.goto('/')
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [RESUME_PREFIX + record.id, JSON.stringify(record)])
  await page.goto(`/editor/${record.id}`)
  await page.evaluate(() => document.fonts.ready)
}

test.describe('estimativa de páginas', () => {
  test.skip(({ isMobile }) => isMobile, 'O PDF é igual em qualquer tela; basta conferir no desktop.')

  for (const [templateId, templateName] of TEMPLATES) {
    for (const [size, extra] of Object.entries(RESUMES)) {
      test(`${templateName}, ${size}: a estimativa contém o número real de páginas do PDF`, async ({ page }) => {
        await openResume(page, templateId, extra)
        const estimate = page.getByText(/^Estimativa: /)
        await expect(estimate).toBeVisible()
        const [, min, max] = (await estimate.textContent()).match(/(\d+)(?: (?:ou|a) (\d+))? página/)
        const real = pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true })).length
        expect(real).toBeGreaterThanOrEqual(Number(min))
        expect(real).toBeLessThanOrEqual(Number(max ?? min))
      })
    }
  }

  test('a estimativa acompanha a edição', async ({ page }) => {
    await createResume(page)
    await fillWithSample(page)
    await expect(page.getByText(/^Estimativa: /)).toHaveText('Estimativa: 1 página')
    await page.getByRole('textbox', { name: 'Resumo profissional' }).fill('Frase de teste para o resumo. '.repeat(200))
    await expect(page.getByText(/^Estimativa: /)).toHaveText(/Estimativa: 2( ou 3)? páginas/)
  })
})

test.describe('celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'Medidas de celular')

  for (const width of [320, 375, 390, 430]) {
    test(`em ${width}px a barra da prévia cabe numa linha e nenhum modo rola a página de lado`, async ({ page }) => {
      await page.setViewportSize({ width, height: 800 })
      await createResume(page)
      await fillWithSample(page)
      await page.getByRole('tab', { name: 'Visualizar' }).click()

      const estimate = page.getByText(/^Estimativa: /)
      const zoom = page.getByRole('radiogroup', { name: 'Zoom da prévia' })
      await expect(estimate).toBeVisible()
      const [estimateBox, zoomBox] = [await estimate.boundingBox(), await zoom.boundingBox()]
      expect(Math.abs(estimateBox.y + estimateBox.height / 2 - (zoomBox.y + zoomBox.height / 2))).toBeLessThan(4)
      expect(estimateBox.x + estimateBox.width).toBeLessThanOrEqual(zoomBox.x)

      for (const name of ['Tamanho real', 'Página inteira']) {
        await zoom.getByRole('radio', { name }).click()
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), name).toBe(0)
      }
      await expect(page.getByText(/^Prévia em A4/)).toContainText('“Salvar como PDF”')
    })
  }

  test('em tamanho real o texto fica no tamanho da folha e a folha rola só por dentro', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 })
    await createResume(page)
    await fillWithSample(page)
    await page.getByRole('tab', { name: 'Visualizar' }).click()
    const sheet = page.locator('[data-actual-size] [style*="scale"]')
    const scaleOf = () => sheet.evaluate((element) => Number(element.style.transform.match(/scale\(([\d.]+)\)/)[1]))
    expect(await scaleOf()).toBeLessThan(0.5)

    await page.getByRole('radio', { name: 'Tamanho real' }).click()
    expect(await scaleOf()).toBe(1)
    const scroller = page.locator('[data-actual-size="true"]')
    expect(await scroller.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true)
    // Abre na coluna de texto: no Clássico a margem lateral é de 72px, e sobra um respiro de 16px.
    await expect.poll(() => scroller.evaluate((element) => element.scrollLeft)).toBe(56)
    await scroller.evaluate((element) => element.scrollBy(300, 0))
    expect(await scroller.evaluate((element) => element.scrollLeft)).toBeGreaterThan(56)
    expect(await page.evaluate(() => window.scrollX)).toBe(0)
  })
})
