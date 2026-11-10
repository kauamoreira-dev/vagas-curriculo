import { expect, test } from '@playwright/test'
import { RESUME_PREFIX, createResume, expectSaved, fillWithSample, savedResumes } from './helpers'

/** Currículo já salvo, com conteúdo, no modelo Clássico. Retorna o id e o JSON gravado. */
async function existingResume(page) {
  const id = await createResume(page)
  await fillWithSample(page)
  await expectSaved(page, (record) => record.id === id && record.resume.personal.name === 'Marina Albuquerque')
  const raw = await page.evaluate((key) => localStorage.getItem(key), RESUME_PREFIX + id)
  expect(JSON.parse(raw).templateId).toBe('classico')
  return { id, raw }
}

const rawOf = (page, id) => page.evaluate((key) => localStorage.getItem(key), RESUME_PREFIX + id)

for (const [origin, open] of [
  ['página inicial', (page) => page.goto('/').then(() => page.locator('a[href="/editor?modelo=moderno"]').first().click())],
  ['página de modelos', (page) => page.goto('/modelos').then(() => page.getByRole('link', { name: 'Usar o modelo Moderno' }).click())],
]) {
  test(`escolher o Moderno na ${origin} cria um currículo novo e não mexe no existente`, async ({ page }) => {
    const existing = await existingResume(page)
    await open(page)

    await page.waitForURL((url) => /^\/editor\/[^/]+$/.test(url.pathname) && !url.pathname.endsWith(existing.id))
    const newId = new URL(page.url()).pathname.split('/').pop()
    await expect(page.getByLabel(/Nome completo/)).toHaveValue('')
    await expect(page.locator('#modelo-moderno')).toHaveAttribute('aria-checked', 'true')

    const records = await savedResumes(page)
    expect(records).toHaveLength(2)
    expect(records.find((record) => record.id === newId).templateId).toBe('moderno')
    // O currículo que já existia continua exatamente igual (dados, modelo e data).
    expect(await rawOf(page, existing.id)).toBe(existing.raw)

    // A lista mostra os dois.
    await page.goto('/curriculos')
    await expect(page.getByRole('listitem').getByRole('heading', { level: 2 })).toHaveCount(2)
  })
}

test('voltar com o botão do navegador não cria outro currículo', async ({ page }) => {
  await page.goto('/modelos')
  await page.getByRole('link', { name: 'Usar o modelo Essencial' }).click()
  await page.waitForURL(/\/editor\/[^/?]+$/)
  await page.goBack()
  await expect(page).toHaveURL(/\/modelos$/)
  await page.waitForTimeout(500)
  expect(await savedResumes(page)).toHaveLength(1)
})

test('dentro do editor, trocar o modelo continua valendo para o currículo aberto', async ({ page }) => {
  const existing = await existingResume(page)
  await page.goto(`/editor/${existing.id}`)
  const picker = page.getByRole('radio', { name: 'Essencial' })
  if (!(await picker.isVisible())) await page.getByRole('tab', { name: 'Visualizar' }).click()
  await picker.click()
  await expectSaved(page, (record) => record.id === existing.id && record.templateId === 'essencial')
  expect(await savedResumes(page)).toHaveLength(1)
  const saved = JSON.parse(await rawOf(page, existing.id))
  expect(saved.resume).toEqual(JSON.parse(existing.raw).resume)
})
