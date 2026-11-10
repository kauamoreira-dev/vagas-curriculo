import { expect, test } from '@playwright/test'
import {
  INDEX_KEY,
  LEGACY_KEY,
  RESUME_PREFIX,
  createResume,
  expectSaved,
  fillWithSample,
  savedResumes,
  uploadPhoto,
} from './helpers'

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
  await uploadPhoto(page)
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

test('seções novas (endereço, idiomas, habilidades, certificações) continuam lá depois de recarregar', async ({
  page,
}) => {
  await createResume(page)
  await page.getByLabel(/Nome completo/).fill('Ana Souza')
  await page.getByLabel('Cidade', { exact: true }).fill('Santarém')
  await page.getByLabel('Estado', { exact: true }).selectOption('PA')
  await page.getByRole('radio', { name: 'Endereço completo' }).check()
  await page.getByLabel('CEP', { exact: true }).fill('68005000')
  await page.getByLabel('Competências técnicas').fill('Excel, Canva')
  await page.getByLabel('Competências técnicas').press('Enter')
  await page.getByRole('button', { name: 'Idiomas' }).click()
  await page.getByRole('button', { name: 'Adicionar idioma' }).click()
  await page.getByRole('textbox', { name: /^Idioma/ }).fill('Inglês')
  await page.getByLabel('Nível', { exact: true }).selectOption('Avançado')
  await page.getByRole('button', { name: 'Certificações' }).click()
  await page.getByRole('button', { name: 'Adicionar certificação' }).click()
  await page.getByLabel(/Nome da certificação/).fill('Primeiros socorros')
  await expectSaved(page, (record) => record.resume.certifications[0]?.name === 'Primeiros socorros')

  await page.reload()
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('Santarém')
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('PA')
  await expect(page.getByLabel('CEP', { exact: true })).toHaveValue('68005-000')
  await expect(page.getByRole('list', { name: 'Competências técnicas' }).getByRole('listitem')).toHaveCount(2)
  // Grupos opcionais com conteúdo reabrem já expandidos.
  await expect(page.getByRole('textbox', { name: /^Idioma/ })).toHaveValue('Inglês')
  await expect(page.getByLabel('Nível', { exact: true })).toHaveValue('Avançado')
  await expect(page.getByLabel(/Nome da certificação/)).toHaveValue('Primeiros socorros')
})

test('currículo salvo antes das seções novas: editar não apaga nenhum dado antigo', async ({ page }) => {
  // Formato anterior: `location` livre, `skills` em texto, sem as seções novas.
  const old = {
    id: 'antigo',
    title: 'Vaga antiga',
    templateId: 'essencial',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    resume: {
      personal: {
        name: 'Rita Lopes',
        title: 'Recepcionista',
        email: 'rita@email.com',
        phone: '(93) 99999-0000',
        location: 'Santarém, PA',
        link: 'linkedin.com/in/rita',
        photo: '',
        photoVisible: false,
      },
      summary: 'Atendimento ao público há cinco anos.',
      experience: [
        { id: 'e1', role: 'Recepcionista', company: 'Clínica Sol', start: '2021', end: 'Atual', description: 'Agenda\nTriagem' },
      ],
      education: [{ id: 'f1', course: 'Ensino médio', institution: 'Escola Estadual', start: '2014', end: '2016' }],
      skills: 'Atendimento, Excel\nOrganização',
    },
  }
  await page.addInitScript(
    ([key, record]) => {
      if (sessionStorage.getItem('antigo-gravado')) return
      sessionStorage.setItem('antigo-gravado', '1')
      localStorage.setItem(key, JSON.stringify(record))
    },
    [`${RESUME_PREFIX}antigo`, old],
  )

  await page.goto('/editor/antigo')
  await expect(page.getByLabel('Cidade', { exact: true })).toHaveValue('Santarém')
  await expect(page.getByLabel('Estado', { exact: true })).toHaveValue('PA')
  await expect(page.getByRole('list', { name: 'Competências técnicas' }).getByRole('listitem')).toHaveCount(3)

  await page.getByRole('button', { name: 'Objetivo profissional' }).click()
  await page.getByRole('textbox', { name: 'Objetivo' }).fill('Atuar como recepcionista.')
  await expectSaved(page, (record) => record.resume.objective === 'Atuar como recepcionista.')

  const [saved] = await savedResumes(page)
  const { location, ...personal } = old.resume.personal
  expect(location).toBe('Santarém, PA')
  expect(saved).toMatchObject({ id: 'antigo', title: 'Vaga antiga', templateId: 'essencial' })
  expect(saved.resume.personal).toMatchObject({ ...personal, city: 'Santarém', state: 'PA' })
  expect(saved.resume.summary).toBe(old.resume.summary)
  expect(saved.resume.experience).toEqual(old.resume.experience)
  expect(saved.resume.education).toEqual(old.resume.education)
  expect(saved.resume.skills).toEqual(['Atendimento', 'Excel', 'Organização'])

  // E aparece inteiro no currículo final.
  const sheet = page.locator('.print-only')
  await expect(sheet.getByText('Santarém, PA')).toHaveCount(1)
  await expect(sheet.getByText('Triagem')).toHaveCount(1)
  await expect(sheet.getByText('Organização')).toHaveCount(1)
})
