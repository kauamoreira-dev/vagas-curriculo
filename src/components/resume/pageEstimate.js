import { PAGE_HEIGHT, PAGE_WIDTH } from './constants'

/*
 * Estimativa de páginas do PDF a partir da prévia na tela.
 * Área útil de cada página impressa: a A4 (1123 px) menos as margens de 14 mm em cima e embaixo
 * (o padding de cada modelo na impressão). Calibrada contra o PDF real do Chromium nos três
 * modelos, com resumos longos e com muitas experiências.
 * Itens curtos (experiência, formação…) não se partem entre páginas: quando um não cabe no fim de
 * uma página, vai inteiro para a seguinte e deixa um vão. Por isso a estimativa considera o pior
 * caso — cada quebra desperdiçando o maior desses blocos — e, se ele pode somar uma página, mostra
 * uma faixa ("3 ou 4") em vez de um número que poderia ficar abaixo do real.
 */
const PRINT_MARGIN = (14 / 25.4) * 96
export const PRINTABLE_HEIGHT = PAGE_HEIGHT - 2 * PRINT_MARGIN
// Folga mínima (fração de página) antes do fim para afirmar um número só.
const UNCERTAIN_SLACK = 0.08
// O título de seção acompanha o primeiro item para a página seguinte (folga para o título).
const SECTION_TITLE_ALLOWANCE = 48

/**
 * { min, max } de páginas para um conteúdo com `height` px (sem as margens da folha).
 * `largestBlock`: altura do maior item que não se parte (ver `measureLayout`).
 */
export function estimatePages(height, largestBlock = 0) {
  if (!(height > 0)) return { min: 1, max: 1 }
  const ratio = height / PRINTABLE_HEIGHT
  const pages = Math.max(1, Math.ceil(ratio))
  let max = pages - ratio < UNCERTAIN_SLACK ? pages + 1 : pages
  // Pior caso: cada página aproveita só a área útil menos o maior bloco (que pode não ter cabido).
  const block = Math.min(Math.max(largestBlock, 0) + SECTION_TITLE_ALLOWANCE, PRINTABLE_HEIGHT * 0.9)
  if (largestBlock > 0) {
    const worst = Math.max(1, Math.ceil((height - block) / (PRINTABLE_HEIGHT - block)))
    max = Math.max(max, worst)
  }
  return { min: pages, max }
}

/**
 * Medidas de um modelo renderizado, em px da folha (funciona com a folha escalada):
 * - `height`: do topo do primeiro elemento ao pé do último, sem margens nem a altura mínima da folha;
 * - `largestBlock`: o maior item que não se parte entre páginas (<article> sem `data-long`).
 * Retorna null se o elemento não está visível (ex.: aba Editar no celular).
 */
export function measureLayout(root) {
  const box = root?.getBoundingClientRect()
  if (!box?.width) return null
  const scale = box.width / PAGE_WIDTH
  let top = Infinity
  let bottom = -Infinity
  for (const element of root.querySelectorAll('*')) {
    if (element.children.length) continue
    const rect = element.getBoundingClientRect()
    if (!rect.height) continue
    top = Math.min(top, rect.top)
    bottom = Math.max(bottom, rect.bottom)
  }
  let largestBlock = 0
  for (const entry of root.querySelectorAll('article:not([data-long])')) {
    largestBlock = Math.max(largestBlock, entry.getBoundingClientRect().height)
  }
  return {
    height: bottom > top ? (bottom - top) / scale : 0,
    largestBlock: largestBlock / scale,
  }
}

/** Texto curto da estimativa: "Estimativa: 1 página", "… 1 ou 2 páginas", "… de 3 a 5 páginas". */
export function formatPageEstimate({ min, max }) {
  if (min === max) return `Estimativa: ${min} ${min === 1 ? 'página' : 'páginas'}`
  if (max === min + 1) return `Estimativa: ${min} ou ${max} páginas`
  return `Estimativa: de ${min} a ${max} páginas`
}

/** Distância, em px da folha, da borda esquerda até o primeiro texto (a margem lateral do modelo). */
export function contentLeft(root) {
  const box = root?.getBoundingClientRect()
  if (!box?.width) return null
  const scale = box.width / PAGE_WIDTH
  let left = Infinity
  for (const element of root.querySelectorAll('*')) {
    if (element.children.length) continue
    const rect = element.getBoundingClientRect()
    if (rect.width && rect.height) left = Math.min(left, rect.left)
  }
  return Number.isFinite(left) ? (left - box.left) / scale : null
}
