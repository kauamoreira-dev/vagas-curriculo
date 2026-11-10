import { expect, test } from '@playwright/test'
import { createResume, expectSaved, fillWithSample, savedResumes } from './helpers'

const PHONE_WIDTHS = [320, 375, 390]

// Cabeçalho fixo do editor (barra + abas).
const stickyBox = (page) => page.locator('[data-view] > div').first().boundingBox()

/** Conta as chamadas a window.print sem abrir o diálogo do navegador. */
async function stubPrint(page) {
  await page.addInitScript(() => {
    window.__prints = 0
    window.print = () => {
      window.__prints += 1
    }
  })
}
const printCount = (page) => page.evaluate(() => window.__prints)

test.describe('celular', () => {
  test.skip(({ isMobile }) => !isMobile, 'Medidas de celular')

  for (const width of PHONE_WIDTHS) {
    test(`em ${width}px o cabeçalho da aba Editar é uma linha só, sem rolagem lateral`, async ({ page }) => {
      await page.setViewportSize({ width, height: 700 })
      await createResume(page)
      await fillWithSample(page)
      const header = await stickyBox(page)
      expect(header.height).toBeLessThanOrEqual(80)
      // Marca, abas e PDF lado a lado, sem sobrepor.
      const tabs = await page.getByRole('tablist').boundingBox()
      const pdf = await page.getByRole('button', { name: 'Salvar PDF' }).boundingBox()
      expect(tabs.x + tabs.width).toBeLessThanOrEqual(pdf.x)
      expect(Math.abs(tabs.y + tabs.height / 2 - (pdf.y + pdf.height / 2))).toBeLessThan(4)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
    })
  }

  for (const width of PHONE_WIDTHS) {
    test(`em ${width}px o índice aberto é uma grade compacta, sem rolagem lateral e com toque de 44 px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 800 })
      await createResume(page)
      await fillWithSample(page)
      await page.getByText('Seções', { exact: true }).click()
      const links = page.getByRole('navigation', { name: 'Seções do currículo' }).getByRole('button')
      await expect(links).toHaveCount(11)
      const boxes = await links.evaluateAll((buttons) =>
        buttons.map((button) => {
          const { x, height } = button.getBoundingClientRect()
          return { x: Math.round(x), height }
        }),
      )
      // Duas colunas: só duas posições horizontais distintas.
      expect(new Set(boxes.map((box) => box.x)).size).toBe(2)
      expect(Math.min(...boxes.map((box) => box.height))).toBeGreaterThanOrEqual(44)
      expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0)
      // Nomes longos quebram entre palavras, nunca para fora do botão.
      const clipped = await links.evaluateAll((buttons) =>
        buttons.filter((button) => button.scrollWidth > button.clientWidth).map((button) => button.textContent),
      )
      expect(clipped).toEqual([])
    })
  }

  test('o índice fica recolhido e leva até a seção, que para logo abaixo do cabeçalho', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await createResume(page)
    const index = page.getByRole('navigation', { name: 'Seções do currículo' })
    await expect(index).toBeHidden()

    await page.getByText('Seções', { exact: true }).click()
    await index.getByRole('button', { name: /^Idiomas/ }).click()
    const toggle = page.getByRole('button', { name: 'Idiomas Opcional' })
    await expect(toggle).toHaveAttribute('aria-expanded', 'true')
    await expect(toggle).toBeFocused()
    const header = await stickyBox(page)
    await expect
      .poll(async () => (await toggle.boundingBox()).y)
      .toBeGreaterThanOrEqual(header.y + header.height)
  })
})

test('salvamento: mostra "Salvo" só depois de gravar; falha avisa e "Tentar de novo" recupera', async ({ page }) => {
  // Interruptor para simular o armazenamento cheio sem afetar o carregamento da página.
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem
    Storage.prototype.setItem = function (key, value) {
      if (window.__storageFull) throw new DOMException('Sem espaço', 'QuotaExceededError')
      return original.call(this, key, value)
    }
  })
  const id = await createResume(page)
  const status = page.getByText(/^(Salvo|Salvando) neste navegador|^Ainda não salvo/)

  await page.getByLabel(/Nome completo/).fill('Ana Souza')
  await expect(status).toHaveText(/^Salvo neste navegador às \d{2}:\d{2}$/)
  await expectSaved(page, (record) => record.id === id && record.resume.personal.name === 'Ana Souza')

  await page.evaluate(() => {
    window.__storageFull = true
  })
  await page.getByLabel('Cargo ou área').fill('Designer')
  await expect(page.getByRole('alert')).toContainText('Não foi possível salvar neste navegador')
  expect((await savedResumes(page)).find((record) => record.id === id).resume.personal.title).toBe('')

  await page.evaluate(() => {
    window.__storageFull = false
  })
  await page.getByRole('button', { name: 'Tentar de novo' }).click()
  await expect(status).toHaveText(/^Salvo neste navegador/)
  await page.reload()
  await expect(page.getByLabel('Cargo ou área')).toHaveValue('Designer')
})

test('PDF: erro impede gerar; corrigido, o resumo oferece "Gerar PDF"', async ({ page }) => {
  await stubPrint(page)
  await createResume(page)
  await fillWithSample(page)
  const email = page.getByLabel('E-mail')
  await email.fill('marina@')
  await page.getByRole('button', { name: 'Salvar PDF' }).click()

  const summary = page.getByRole('region', { name: /Corrija 1 campo para gerar o PDF/ })
  await expect(summary).toBeVisible()
  await expect(summary.getByRole('button', { name: /Gerar PDF/ })).toHaveCount(0)
  await expect(email).toBeFocused()
  expect(await printCount(page)).toBe(0)

  await email.fill('marina@email.com')
  const ready = page.getByRole('region', { name: 'Tudo certo para gerar o PDF' })
  await ready.getByRole('button', { name: 'Gerar PDF' }).click()
  expect(await printCount(page)).toBe(1)
  await expect(ready).toBeHidden()
})

test('PDF: só avisos (item opcional incompleto) permitem gerar mesmo assim', async ({ page }) => {
  await stubPrint(page)
  await createResume(page)
  await fillWithSample(page)
  await page.getByRole('textbox', { name: 'Empresa' }).first().fill('')
  await page.getByRole('button', { name: 'Salvar PDF' }).click()

  const summary = page.getByRole('region', { name: /item opcional está incompleto/ })
  await expect(summary).toContainText('Informe a empresa.')
  expect(await printCount(page)).toBe(0)
  await summary.getByRole('button', { name: 'Gerar PDF mesmo assim' }).click()
  expect(await printCount(page)).toBe(1)
})

test('remover e desfazer: o item volta à posição original e isso fica salvo', async ({ page }) => {
  const id = await createResume(page)
  await fillWithSample(page)
  const roles = page.getByRole('textbox', { name: 'Cargo', exact: true })
  await expect(roles).toHaveCount(2)

  await page.getByRole('button', { name: 'Remover “Analista de Dados Pleno”' }).click()
  await expect(roles).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Desfazer' })).toBeFocused()
  await page.getByRole('button', { name: 'Desfazer' }).click()
  await expect(roles.first()).toHaveValue('Analista de Dados Pleno')
  await expectSaved(
    page,
    (record) =>
      record.id === id &&
      record.resume.experience.map((item) => item.role).join('|') ===
        'Analista de Dados Pleno|Assistente de Planejamento',
  )

  await page.reload()
  await expect(roles).toHaveCount(2)
  await expect(roles.first()).toHaveValue('Analista de Dados Pleno')
  await expect(page.getByRole('textbox', { name: 'Empresa', exact: true }).first()).toHaveValue(
    'Cooperativa Rio Claro',
  )
})
