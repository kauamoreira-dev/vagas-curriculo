import { inflateSync } from 'node:zlib'
import { expect } from '@playwright/test'

// Mesmos valores de src/services/resumeStore.js (os testes rodam fora do Vite, sem o alias @/).
export const INDEX_KEY = 'vagas-curriculo:v2:indice'
export const RESUME_PREFIX = 'vagas-curriculo:v2:curriculo:'
export const LEGACY_KEY = 'vagas-curriculo:rascunho:v1'

/** Currículos gravados no localStorage da página, como objetos. */
export function savedResumes(page) {
  return page.evaluate(
    (prefix) =>
      Object.keys(localStorage)
        .filter((key) => key.startsWith(prefix))
        .map((key) => JSON.parse(localStorage.getItem(key))),
    RESUME_PREFIX,
  )
}

/** Espera o salvamento automático (400 ms após a última alteração) gravar algo que satisfaça `check`. */
export async function expectSaved(page, check) {
  await expect.poll(async () => (await savedResumes(page)).some(check), { timeout: 5000 }).toBe(true)
}

/** Cria um currículo pela lista e espera o editor abrir. Retorna o id da URL. */
export async function createResume(page) {
  await page.goto('/curriculos')
  await page.getByRole('button', { name: 'Novo currículo' }).click()
  await page.waitForURL(/\/editor\/[^/?]+/)
  return new URL(page.url()).pathname.split('/').pop()
}

/** "Usar exemplo": na barra superior no computador, no fim do formulário no celular. */
export async function fillWithSample(page) {
  await page.getByRole('button', { name: 'Usar exemplo' }).filter({ visible: true }).first().click()
}

/**
 * Leitura mínima de um PDF gerado pelo Chromium: o conteúdo (descompactado) de cada página.
 * Suficiente para contar páginas e procurar operadores de desenho; não extrai texto.
 */
export function pdfPages(buffer) {
  const source = buffer.toString('latin1')
  const objects = new Map()
  for (const match of source.matchAll(/(\d+) 0 obj([\s\S]*?)endobj/g)) objects.set(match[1], match[2])

  function streamOf(body = '') {
    const stream = body.match(/stream\r?\n([\s\S]*?)\r?\nendstream/)
    if (!stream) return ''
    const raw = Buffer.from(stream[1], 'latin1')
    return (/FlateDecode/.test(body) ? inflateSync(raw) : raw).toString('latin1')
  }

  return [...objects.values()]
    .filter((body) => /\/Type\s*\/Page\b(?!s)/.test(body))
    .map((body) => {
      const contents = body.match(/\/Contents\s*(\[[^\]]*\]|\d+ 0 R)/)?.[1] ?? ''
      return [...contents.matchAll(/(\d+) 0 R/g)].map(([, id]) => streamOf(objects.get(id))).join('\n')
    })
}
