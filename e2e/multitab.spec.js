import { expect, test } from '@playwright/test'
import { RESUME_PREFIX, expectSaved, savedResumes } from './helpers'

/**
 * Duas abas do mesmo navegador abertas no mesmo currículo, já salvo com um nome.
 * `holdB`: o salvamento automático da aba B espera 3 s em vez de 400 ms, para a gravação da aba A
 * chegar sempre enquanto B tem uma alteração pendente (sem depender da velocidade da máquina).
 */
async function twoTabs(context, { holdB = false } = {}) {
  const a = await context.newPage()
  await a.goto('/editor')
  await a.getByLabel(/Nome completo/).fill('Ana Souza')
  await a.waitForURL(/\/editor\/[^/]+$/)
  const id = new URL(a.url()).pathname.split('/').pop()
  await expectSaved(a, (record) => record.id === id && record.resume.personal.name === 'Ana Souza')
  const b = await context.newPage()
  if (holdB) {
    await b.addInitScript(() => {
      const setTimeoutOriginal = window.setTimeout
      window.setTimeout = (callback, delay, ...args) => setTimeoutOriginal(callback, delay === 400 ? 3000 : delay, ...args)
    })
  }
  await b.goto(`/editor/${id}`)
  await expect(b.getByLabel(/Nome completo/)).toHaveValue('Ana Souza')
  return { a, b, id }
}

const storedResume = (page, id) =>
  page.evaluate((key) => JSON.parse(localStorage.getItem(key))?.resume ?? null, RESUME_PREFIX + id)

test('cenário da auditoria: edições em abas diferentes se somam, nenhuma se perde', async ({ context }) => {
  const { a, b, id } = await twoTabs(context)
  await a.getByLabel(/Nome completo/).fill('Ana Souza Lima')
  await expectSaved(a, (record) => record.resume.personal.name === 'Ana Souza Lima')
  // A aba B, sem nada pendente, passa a mostrar o nome novo antes de a pessoa editar.
  await expect(b.getByLabel(/Nome completo/)).toHaveValue('Ana Souza Lima')
  await expect(b.getByText(/^Atualizado com a versão de outra aba/)).toBeVisible()

  await b.getByRole('textbox', { name: 'Resumo profissional' }).fill('Resumo escrito na aba B')
  await expectSaved(b, (record) => record.resume.summary === 'Resumo escrito na aba B')
  const saved = await storedResume(a, id)
  expect(saved).toMatchObject({ summary: 'Resumo escrito na aba B', personal: { name: 'Ana Souza Lima' } })

  await a.reload()
  await expect(a.getByLabel(/Nome completo/)).toHaveValue('Ana Souza Lima')
  await expect(a.getByRole('textbox', { name: 'Resumo profissional' })).toHaveValue('Resumo escrito na aba B')
})

test('edição ao mesmo tempo nas duas abas: conflito, e "Manter as minhas" decide sem perda silenciosa', async ({
  context,
}) => {
  const { a, b, id } = await twoTabs(context, { holdB: true })
  // B fica com uma alteração pendente (salvamento segurado); A grava enquanto isso.
  await b.getByRole('textbox', { name: 'Resumo profissional' }).fill('Resumo da aba B')
  await a.getByLabel(/Nome completo/).fill('Nome da aba A')

  const notice = b.getByRole('alert').filter({ hasText: 'Este currículo mudou em outra aba' })
  await expect(notice).toBeVisible()
  // Depois do salvamento automático de B (3 s, ver `holdB`).
  await b.waitForTimeout(3500)
  // Enquanto a pessoa não escolhe, nada da aba B grava por cima da aba A.
  expect(await storedResume(b, id)).toMatchObject({ personal: { name: 'Nome da aba A' } })

  await notice.getByRole('button', { name: 'Manter as minhas' }).click()
  await expect(notice).toBeHidden()
  await expectSaved(b, (record) => record.id === id && record.resume.summary === 'Resumo da aba B')
  // A aba A, sem nada pendente, passa a mostrar a versão escolhida.
  await expect(a.getByRole('textbox', { name: 'Resumo profissional' })).toHaveValue('Resumo da aba B')
})

test('conflito: "Salvar as minhas como cópia" mantém as duas versões', async ({ context }) => {
  const { a, b, id } = await twoTabs(context, { holdB: true })
  await b.getByRole('textbox', { name: 'Resumo profissional' }).fill('Resumo da aba B')
  await a.getByLabel(/Nome completo/).fill('Nome da aba A')
  const notice = b.getByRole('alert').filter({ hasText: 'Este currículo mudou em outra aba' })
  await notice.getByRole('button', { name: 'Salvar as minhas como cópia' }).click()

  await b.waitForURL((url) => /\/editor\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith(id))
  await expect(b.getByRole('textbox', { name: 'Resumo profissional' })).toHaveValue('Resumo da aba B')
  const records = await savedResumes(b)
  expect(records).toHaveLength(2)
  expect(records.find((record) => record.id === id).resume.personal.name).toBe('Nome da aba A')
  expect(records.find((record) => record.id !== id).title).toMatch(/\(minha versão\)$/)
})

test('excluído em outra aba com alterações aqui: avisa e "Salvar de novo" recupera', async ({ context }) => {
  const { a, b, id } = await twoTabs(context)
  await b.getByRole('textbox', { name: 'Resumo profissional' }).fill('Resumo que não pode sumir')
  await a.goto('/curriculos')
  a.once('dialog', (dialog) => dialog.accept())
  await a.getByRole('button', { name: /^Excluir/ }).click()

  const notice = b.getByRole('alert').filter({ hasText: 'Este currículo foi excluído em outra aba' })
  await expect(notice).toBeVisible()
  await notice.getByRole('button', { name: 'Salvar de novo' }).click()
  await expectSaved(b, (record) => record.id === id && record.resume.summary === 'Resumo que não pode sumir')
})

test('fechar a aba sem escolher guarda as alterações dela numa cópia', async ({ context }) => {
  const { a, b, id } = await twoTabs(context, { holdB: true })
  await b.getByRole('textbox', { name: 'Resumo profissional' }).fill('Resumo da aba B')
  await a.getByLabel(/Nome completo/).fill('Nome da aba A')
  await expect(b.getByRole('alert').filter({ hasText: 'Este currículo mudou em outra aba' })).toBeVisible()
  await b.close({ runBeforeUnload: true })

  await expect.poll(async () => (await savedResumes(a)).length).toBe(2)
  const records = await savedResumes(a)
  expect(records.find((record) => record.id === id).resume.personal.name).toBe('Nome da aba A')
  const recovery = records.find((record) => record.id !== id)
  expect(recovery.title).toMatch(/\(alterações não salvas\)$/)
  expect(recovery.resume.summary).toBe('Resumo da aba B')
})
