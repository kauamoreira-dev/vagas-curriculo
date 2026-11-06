import { expect, test } from '@playwright/test'
import { INDEX_KEY, LEGACY_KEY, createResume, expectSaved, fillWithSample, savedResumes } from './helpers'

const listItems = (page) => page.getByRole('listitem').getByRole('heading', { level: 2 })

test('o currículo editado continua lá depois de recarregar a página', async ({ page }) => {
  const id = await createResume(page)
  await page.getByLabel(/Nome completo/).fill('Ana Souza')
  await page.getByLabel('Cargo ou área').fill('Designer')
  await page.getByLabel('Nome deste currículo').fill('Vaga na agência')
  await page.getByRole('textbox', { name: 'Resumo profissional' }).fill('Resumo da Ana.')
  await expectSaved(page, (record) => record.id === id && record.resume.summary === 'Resumo da Ana.')

  await page.reload()
  await expect(page.getByLabel(/Nome completo/)).toHaveValue('Ana Souza')
  await expect(page.getByLabel('Cargo ou área')).toHaveValue('Designer')
  await expect(page.getByLabel('Nome deste currículo')).toHaveValue('Vaga na agência')
  await expect(page.getByRole('textbox', { name: 'Resumo profissional' })).toHaveValue('Resumo da Ana.')
})

test('alterações feitas logo antes de sair da página não se perdem', async ({ page }) => {
  const id = await createResume(page)
  await page.getByLabel(/Nome completo/).fill('Ana Souza')
  // Sai imediatamente, antes dos 400 ms do salvamento automático: o pagehide grava.
  await page.goto('/curriculos')
  await expect(listItems(page)).toHaveText(['Ana Souza'])
  expect((await savedResumes(page)).find((record) => record.id === id).resume.personal.name).toBe('Ana Souza')
})

test('vários currículos: lista, troca, duplica e exclui', async ({ page }) => {
  const first = await createResume(page)
  await page.getByLabel(/Nome completo/).fill('Ana Souza')
  await expectSaved(page, (record) => record.id === first && record.resume.personal.name === 'Ana Souza')

  const second = await createResume(page)
  await page.getByLabel(/Nome completo/).fill('Bruno Lima')
  await expectSaved(page, (record) => record.id === second && record.resume.personal.name === 'Bruno Lima')

  // Mais recente primeiro.
  await page.goto('/curriculos')
  await expect(listItems(page)).toHaveText(['Bruno Lima', 'Ana Souza'])

  // Abrir e editar o mais antigo o traz para o topo, sem misturar os dados.
  await page.getByRole('link', { name: 'Ana Souza', exact: true }).click()
  await expect(page).toHaveURL(new RegExp(`/editor/${first}`))
  await expect(page.getByLabel(/Nome completo/)).toHaveValue('Ana Souza')
  await page.getByLabel('Cargo ou área').fill('Designer')
  await expectSaved(page, (record) => record.id === first && record.resume.personal.title === 'Designer')
  await page.goto('/curriculos')
  await expect(listItems(page)).toHaveText(['Ana Souza · Designer', 'Bruno Lima'])

  await page.getByRole('button', { name: 'Duplicar “Bruno Lima”' }).click()
  await expect(page.getByRole('status')).toHaveText('Cópia de “Bruno Lima” criada.')
  await expect(listItems(page)).toHaveText(['Bruno Lima (cópia)', 'Ana Souza · Designer', 'Bruno Lima'])

  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Excluir “Bruno Lima (cópia)”' }).click()
  await expect(listItems(page)).toHaveText(['Ana Souza · Designer', 'Bruno Lima'])

  // Recarregar não traz o excluído de volta.
  await page.reload()
  await expect(listItems(page)).toHaveText(['Ana Souza · Designer', 'Bruno Lima'])
})

test('cancelar a exclusão mantém o currículo', async ({ page }) => {
  await createResume(page)
  await fillWithSample(page)
  await page.goto('/curriculos')
  page.once('dialog', (dialog) => dialog.dismiss())
  await page.getByRole('button', { name: /^Excluir/ }).click()
  await expect(listItems(page)).toHaveCount(1)
})

test('a foto enviada é salva e aparece na lista', async ({ page }) => {
  const id = await createResume(page)
  await page.getByLabel(/Nome completo/).fill('Ana Souza')
  const png = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 600
    canvas.height = 400
    const context = canvas.getContext('2d')
    context.fillStyle = '#3a7'
    context.fillRect(0, 0, 600, 400)
    return canvas.toDataURL('image/png').split(',')[1]
  })
  await page.locator('input[type="file"]').setInputFiles({
    name: 'foto.png',
    mimeType: 'image/png',
    buffer: Buffer.from(png, 'base64'),
  })
  await page.getByRole('button', { name: 'Usar esta foto' }).click()
  await expect(page.getByRole('img', { name: 'Sua foto de perfil' })).toBeVisible()
  await expectSaved(page, (record) => record.id === id && record.resume.personal.photo.startsWith('data:image/jpeg'))

  await page.goto('/curriculos')
  await expect(page.getByText('Com foto')).toBeVisible()
})

test.describe('rascunho da versão anterior', () => {
  test.beforeEach(async ({ page }) => {
    // Grava o rascunho v1 só antes do primeiro carregamento (o script roda a cada navegação).
    await page.addInitScript((key) => {
      if (sessionStorage.getItem('legado-gravado')) return
      sessionStorage.setItem('legado-gravado', '1')
      localStorage.setItem(
        key,
        JSON.stringify({ templateId: 'moderno', resume: { personal: { name: 'Carla Dias', title: 'Professora' } } }),
      )
    }, LEGACY_KEY)
  })

  test('é migrado para a lista ao abrir o site e pode ser editado', async ({ page }) => {
    await page.goto('/curriculos')
    await expect(listItems(page)).toHaveText(['Carla Dias · Professora'])
    expect(await page.evaluate((key) => localStorage.getItem(key), LEGACY_KEY)).toBeNull()
    expect(await page.evaluate((key) => JSON.parse(localStorage.getItem(key)).version, INDEX_KEY)).toBe(2)

    await page.reload() // não migra de novo
    await expect(listItems(page)).toHaveCount(1)

    await page.getByRole('link', { name: 'Carla Dias · Professora', exact: true }).click()
    await expect(page.getByLabel(/Nome completo/)).toHaveValue('Carla Dias')
  })
})
