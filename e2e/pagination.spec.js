import { expect, test } from '@playwright/test'
import { A4_HEIGHT, PRINT_MARGIN, RESUME_PREFIX, pdfPages, textBaselines } from './helpers'

/*
 * Regressões de paginação do PDF (Chromium), nos três modelos. Cada teste monta, medindo a folha
 * com o CSS de impressão, o currículo que leva a quebra ao ponto delicado — sem depender de alturas
 * calibradas à mão, que mudariam com qualquer ajuste de fonte ou espaçamento.
 */

const TEMPLATES = [
  ['classico', 'Clássico'],
  ['moderno', 'Moderno'],
  ['essencial', 'Essencial'],
]

// Fim da área útil da 1ª página, em px a partir do topo da folha.
const PAGE_BOTTOM = A4_HEIGHT - PRINT_MARGIN

const job = (n, bullets) => ({
  id: `e${n}`,
  role: `Cargo ${n + 1}`,
  company: 'Empresa de exemplo',
  start: `mar/${2005 + n}`,
  end: `fev/${2006 + n}`,
  description: Array.from({ length: bullets }, (_, i) => `Resultado ${i + 1} na rotina da área.`).join('\n'),
})

async function openResume(page, templateId, resume) {
  const record = {
    id: `pag-${templateId}`,
    title: '',
    templateId,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    resume: {
      personal: { name: 'Ana Souza', title: 'Analista', email: 'ana@email.com', phone: '(91) 90000-0000', city: 'Belém', state: 'PA' },
      ...resume,
    },
  }
  await page.evaluate(([key, value]) => localStorage.setItem(key, value), [RESUME_PREFIX + record.id, JSON.stringify(record)])
  await page.goto(`/editor/${record.id}`)
  await page.locator('.print-only').waitFor({ state: 'attached' })
  await page.evaluate(() => document.fonts.ready)
}

// Posições (px a partir do topo da folha) na folha impressa contínua, antes de qualquer quebra.
async function printLayout(page, measure) {
  await page.emulateMedia({ media: 'print' })
  const result = await page.evaluate(measure)
  await page.emulateMedia({ media: null })
  return result
}

// Linhas de texto distintas de cada página do PDF (trechos na mesma linha de base contam uma vez).
async function pdfLines(page) {
  const pages = pdfPages(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
  return pages.map((content) => [...new Set(textBaselines(content).map((y) => Math.round(y)))].sort((a, b) => a - b))
}

test.describe('paginação do PDF', () => {
  test.skip(({ isMobile }) => isMobile, 'O PDF é igual em qualquer tela; basta gerá-lo no desktop.')
  test.setTimeout(90_000)

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  for (const [templateId, templateName] of TEMPLATES) {
    test(`${templateName}: formação e cursos ocupam o pé da página em vez de saltar inteiros para a seguinte`, async ({
      page,
    }) => {
      // Itens só com cabeçalho (formação, cursos) seguidos. O bloco todo cabe numa página nova, mas
      // não no que sobra da 1ª: era aí que ele saltava inteiro, deixando o pé da página vazio.
      const education = [
        { id: 'f1', course: 'Tecnologia em Gestão', institution: 'Universidade Federal', start: '2016', end: '2019' },
        { id: 'f2', course: 'Técnico em Administração', institution: 'Instituto Federal', start: '2011', end: '2012' },
      ]
      const courses = Array.from({ length: 6 }, (_, n) => ({
        id: `c${n}`,
        name: `Curso livre ${n + 1}`,
        institution: 'Escola de exemplo',
        hours: '20',
        year: `${2010 + n}`,
      }))
      // Uma seção depois do bloco, como no currículo real (o bloco não termina o documento).
      const projects = [
        { id: 'p1', name: 'Projeto de exemplo', technologies: '', url: '', description: job(0, 2).description },
      ]
      async function measure(jobs, bullets) {
        const experience = [...Array.from({ length: jobs - 1 }, (_, n) => job(n, 3)), job(jobs - 1, bullets)]
        await openResume(page, templateId, { experience, education, courses, projects })
        const layout = await printLayout(page, () => {
          const sheet = document.querySelector('.print-only > div')
          const top = sheet.getBoundingClientRect().top
          const sections = [...sheet.querySelectorAll('section')]
          const titled = (title) => sections.find((section) => section.querySelector('h2')?.textContent === title)
          const items = [...sheet.querySelectorAll('section article')].filter((item) => !item.querySelector('ul'))
          // Começo de seção (respiro, título, fio) até o 1º item: vai junto com ele para a página seguinte.
          const heads = sections
            .filter((section) => section.querySelector('article'))
            .map((section) => section.querySelector('article').getBoundingClientRect().top - section.getBoundingClientRect().top)
          return {
            educationTop: titled('Formação').getBoundingClientRect().top - top,
            coursesBottom: titled('Cursos complementares').getBoundingClientRect().bottom - top,
            // O máximo que pode sobrar no pé sem desperdício: um começo de seção mais um item, que não cabem.
            allowance: Math.max(...heads) + Math.max(...items.map((item) => item.getBoundingClientRect().height)),
          }
        })
        return layout
      }
      const blankAtFirstPageFoot = async () => PAGE_BOTTOM - Math.max(...(await pdfLines(page))[0])
      /*
       * Quando o bloco salta depende do modelo e de quanto dele cabe. Para exercitar sempre o caso
       * do defeito, a busca recoloca a regra antiga (cabeçalho final com break-after: avoid) e
       * procura um currículo em que o bloco salta inteiro; o teste confere esse currículo sem ela.
       */
      const OLD_RULE = '@media print { [class*="entryHead"] { break-after: avoid !important; } }'
      let layout = null
      search: for (let jobs = 1; jobs <= 12; jobs++) {
        if ((await measure(jobs, 6)).coursesBottom <= PAGE_BOTTOM) continue
        for (let bullets = 1; bullets <= 6; bullets++) {
          const candidate = await measure(jobs, bullets)
          if (candidate.educationTop >= PAGE_BOTTOM) break search
          if (candidate.coursesBottom <= PAGE_BOTTOM) continue
          await page.addStyleTag({ content: OLD_RULE })
          if ((await blankAtFirstPageFoot()) > candidate.allowance) {
            layout = { ...candidate, jobs, bullets }
            break search
          }
        }
      }
      expect(layout, 'currículo em que, com a regra antiga, o bloco salta inteiro').not.toBeNull()
      await measure(layout.jobs, layout.bullets)

      const lines = await pdfLines(page)
      expect(lines.length).toBeGreaterThanOrEqual(2)
      // O pé da 1ª página fica ocupado: sobra no máximo um começo de seção com um item.
      const blank = PAGE_BOTTOM - Math.max(...lines[0])
      expect(blank).toBeLessThan(layout.allowance)
    })

    test(`${templateName}: lista curta no fim não deixa um tópico sozinho na página seguinte`, async ({ page }) => {
      const additionalInfo = ['CNH categoria B', 'Disponibilidade para viagens', 'Disponibilidade para início imediato'].join(
        '\n',
      )
      // Tópicos da lista com `jobs` experiências, a última com `bullets` tópicos.
      async function listItems(jobs, bullets) {
        const experience = [...Array.from({ length: jobs - 1 }, (_, n) => job(n, 3)), job(jobs - 1, bullets)]
        await openResume(page, templateId, { experience, additionalInfo })
        return printLayout(page, () => {
          const sheet = document.querySelector('.print-only > div')
          const top = sheet.getBoundingClientRect().top
          const section = [...sheet.querySelectorAll('section')].find(
            (candidate) => candidate.querySelector('h2')?.textContent === 'Informações adicionais',
          )
          return [...section.querySelectorAll('ul > li')].map((item) => {
            const box = item.getBoundingClientRect()
            return { top: box.top - top, bottom: box.bottom - top }
          })
        })
      }
      // Procura o currículo em que o 1º e o 2º tópicos cabem na 1ª página e o 3º não: acrescenta
      // experiências até a lista chegar ao pé e então ajusta os tópicos da última, um a um.
      let found = null
      search: for (let jobs = 1; jobs <= 14; jobs++) {
        if ((await listItems(jobs, 6))[2].bottom <= PAGE_BOTTOM) continue
        for (let bullets = 1; bullets <= 6; bullets++) {
          const items = await listItems(jobs, bullets)
          if (items[1].bottom <= PAGE_BOTTOM && items[2].bottom > PAGE_BOTTOM) {
            found = { jobs, bullets }
            break search
          }
          if (items[1].bottom > PAGE_BOTTOM) break
        }
      }
      expect(found, 'currículo com o 3º tópico cruzando o pé da 1ª página').not.toBeNull()

      const lines = await pdfLines(page)
      expect(lines).toHaveLength(2)
      for (const [index, pageLines] of lines.entries()) {
        expect(pageLines.length, `linhas na página ${index + 1}`).toBeGreaterThanOrEqual(2)
      }
      // A seção vai inteira: título e os três tópicos na página 2.
      expect(lines[1]).toHaveLength(4)
    })
  }
})

test.describe('estimativa de páginas ao abrir o editor', () => {
  // No celular a prévia fica na aba Visualizar, e abri-la já remede: basta o desktop.
  test.skip(({ isMobile }) => isMobile, 'Cenário da prévia sempre visível (desktop).')

  test('aparece mesmo quando a largura da prévia chega depois das fontes', async ({ page }) => {
    // A largura da folha chega por ResizeObserver. Atrasá-la reproduz a ordem que escondia a
    // estimativa: as medições (1º quadro e fontes prontas) aconteciam com a folha ainda em escala 0.
    await page.addInitScript(() => {
      const Native = window.ResizeObserver
      window.ResizeObserver = class extends Native {
        constructor(callback) {
          super((...args) => setTimeout(() => callback(...args), 800))
        }
      }
    })
    await page.goto('/')
    for (const [templateId, templateName] of TEMPLATES) {
      const record = {
        id: `estimativa-${templateId}`,
        title: '',
        templateId,
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        resume: { personal: { name: 'Ana Souza', email: 'ana@email.com' }, experience: [job(0, 3)] },
      }
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [RESUME_PREFIX + record.id, JSON.stringify(record)])
      await page.goto(`/editor/${record.id}`)
      await expect(page.getByText(/^Estimativa: /), templateName).toHaveText('Estimativa: 1 página')
    }
  })
})
