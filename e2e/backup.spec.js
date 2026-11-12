import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { createResume, expectSaved, fillWithSample, savedResumes, uploadPhoto } from './helpers'

const panel = (page) => page.getByRole('region', { name: 'Cópia de segurança' })
const restoreFile = (page, file) => panel(page).getByLabel('Arquivo da cópia de segurança').setInputFiles(file)

/** Cria um currículo com o exemplo e uma foto e baixa a cópia de segurança. Retorna o arquivo. */
async function downloadBackup(page) {
  const id = await createResume(page)
  await fillWithSample(page)
  await uploadPhoto(page)
  await expectSaved(page, (record) => record.id === id && record.resume.personal.photo.startsWith('data:image/jpeg'))
  await page.goto('/curriculos')
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    panel(page).getByRole('button', { name: 'Baixar cópia de segurança' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^curriculos-tapajos-\d{4}-\d{2}-\d{2}\.json$/)
  const path = await download.path()
  return { id, path, content: readFileSync(path, 'utf8') }
}

test('baixar e restaurar em outro navegador (vazio) traz o currículo inteiro, com foto', async ({ page, browser }) => {
  const { id, path, content } = await downloadBackup(page)
  const backup = JSON.parse(content)
  expect(backup).toMatchObject({ app: 'curriculo-tapajos', type: 'backup', version: 1 })
  expect(backup.resumes).toHaveLength(1)

  // "Outro aparelho": um navegador novo, sem nada salvo.
  const other = await browser.newContext()
  const fresh = await other.newPage()
  await fresh.goto('/curriculos')
  await restoreFile(fresh, path)
  const preview = fresh.getByRole('region', { name: 'Prévia da restauração' })
  await expect(preview).toContainText('1 currículo novo para restaurar')
  await preview.getByRole('button', { name: 'Restaurar' }).click()
  await expect(panel(fresh).getByRole('status')).toContainText('1 currículo restaurado')

  await fresh.getByRole('link', { name: /Marina Albuquerque/ }).first().click()
  await expect(fresh).toHaveURL(new RegExp(`/editor/${id}$`))
  await expect(fresh.getByLabel(/Nome completo/)).toHaveValue('Marina Albuquerque')
  await expect(fresh.getByRole('img', { name: 'Sua foto de perfil' })).toBeVisible()
  await other.close()
})

test('restaurar o mesmo arquivo de novo não duplica; versão diferente entra como cópia', async ({ page }) => {
  const { id, path } = await downloadBackup(page)
  await restoreFile(page, path)
  const preview = page.getByRole('region', { name: 'Prévia da restauração' })
  await expect(preview).toContainText('Todos os currículos deste arquivo já estão aqui')
  await expect(preview.getByRole('button', { name: 'Restaurar' })).toHaveCount(0)
  expect(await savedResumes(page)).toHaveLength(1)

  // O currículo daqui muda depois do backup: restaurar não pode substituí-lo.
  await page.goto(`/editor/${id}`)
  await page.getByLabel('Cargo ou área').fill('Cargo novo, depois do backup')
  await expectSaved(page, (record) => record.resume.personal.title === 'Cargo novo, depois do backup')
  await page.goto('/curriculos')
  await restoreFile(page, path)
  await expect(page.getByRole('region', { name: 'Prévia da restauração' })).toContainText('entra como cópia, sem substituir')
  await page.getByRole('region', { name: 'Prévia da restauração' }).getByRole('button', { name: 'Restaurar' }).click()

  const records = await savedResumes(page)
  expect(records).toHaveLength(2)
  expect(records.find((record) => record.id === id).resume.personal.title).toBe('Cargo novo, depois do backup')
  expect(records.find((record) => record.id !== id).title).toMatch(/\(restaurado\)$/)

  // Restaurar o mesmo arquivo outra vez não cria uma segunda cópia "(restaurado)".
  await restoreFile(page, path)
  await expect(page.getByRole('region', { name: 'Prévia da restauração' })).toContainText(
    'Todos os currículos deste arquivo já estão aqui',
  )
  expect(await savedResumes(page)).toHaveLength(2)
})

test('arquivo inválido ou de outro tipo: mensagem clara e nada é gravado', async ({ page }) => {
  await page.goto('/curriculos')
  await restoreFile(page, { name: 'curriculo.json', mimeType: 'application/json', buffer: Buffer.from('{ quebrado') })
  await expect(panel(page).getByRole('status')).toContainText('Não foi possível ler o arquivo')
  await restoreFile(page, { name: 'outro.json', mimeType: 'application/json', buffer: Buffer.from('{"nome":"x"}') })
  await expect(panel(page).getByRole('status')).toContainText('não é uma cópia de segurança do Currículo Tapajós')
  expect(await savedResumes(page)).toHaveLength(0)
})

test('sem espaço no navegador durante a restauração: avisa quantos entraram e o que fazer', async ({ page, browser }) => {
  const { path } = await downloadBackup(page)
  const other = await browser.newContext()
  const fresh = await other.newPage()
  await fresh.goto('/curriculos')
  // Enche o armazenamento deste navegador de teste (não toca em dados de ninguém).
  await fresh.evaluate(() => {
    for (const size of [262144, 16384, 1024, 64, 1]) {
      try {
        for (let i = 0; i < 100000; i++) localStorage.setItem(`__f_${size}_${i}`, 'x'.repeat(size))
      } catch {
        // não cabe mais neste tamanho
      }
    }
  })
  await restoreFile(fresh, path)
  await fresh.getByRole('region', { name: 'Prévia da restauração' }).getByRole('button', { name: 'Restaurar' }).click()
  await expect(panel(fresh).getByRole('status')).toContainText('Restaurados 0 de 1. Não há espaço neste navegador')
  await other.close()
})
