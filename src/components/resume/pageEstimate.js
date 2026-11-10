import { PAGE_HEIGHT, PAGE_WIDTH } from './constants'

/*
 * Estimativa de páginas do PDF a partir da prévia na tela.
 * Área útil de cada página impressa: a A4 (1123 px) menos as margens de 14 mm em cima e embaixo
 * (o padding de cada modelo na impressão). Calibrada contra o PDF real do Chromium nos três
 * modelos, com resumos longos e com muitas experiências: acertou todos os casos medidos.
 * Perto do fim de uma página, um bloco que não se parte (experiência, título com o 1º item)
 * pode empurrar o resto para a seguinte; ali a estimativa vira uma faixa ("1 ou 2").
 */
const PRINT_MARGIN = (14 / 25.4) * 96
export const PRINTABLE_HEIGHT = PAGE_HEIGHT - 2 * PRINT_MARGIN
// Folga mínima (fração de página) antes do fim para afirmar um número só.
const UNCERTAIN_SLACK = 0.08

/** { min, max } de páginas para um conteúdo com `height` px (sem as margens da folha). */
export function estimatePages(height) {
  if (!(height > 0)) return { min: 1, max: 1 }
  const ratio = height / PRINTABLE_HEIGHT
  const pages = Math.max(1, Math.ceil(ratio))
  return pages - ratio < UNCERTAIN_SLACK ? { min: pages, max: pages + 1 } : { min: pages, max: pages }
}

/**
 * Altura do conteúdo de um modelo renderizado (do topo do primeiro elemento ao pé do último),
 * em px da folha, sem margens nem a altura mínima de uma página. Funciona com a folha escalada.
 * Retorna null se o elemento não está visível (ex.: aba Editar no celular).
 */
export function measureContentHeight(root) {
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
  return bottom > top ? (bottom - top) / scale : 0
}

/** Texto curto da estimativa: "Estimativa: 1 página", "Estimativa: 1 ou 2 páginas". */
export function formatPageEstimate({ min, max }) {
  if (min === max) return `Estimativa: ${min} ${min === 1 ? 'página' : 'páginas'}`
  return `Estimativa: ${min} ou ${max} páginas`
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
