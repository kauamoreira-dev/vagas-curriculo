import { describe, expect, it } from 'vitest'
import { PRINTABLE_HEIGHT, estimatePages, formatPageEstimate } from './pageEstimate'

const at = (fraction) => fraction * PRINTABLE_HEIGHT

describe('estimatePages', () => {
  it('área útil é a A4 menos as margens de 14 mm (≈ 1017 px)', () => {
    expect(PRINTABLE_HEIGHT).toBeCloseTo(1017.2, 1)
  })

  it.each([
    [0.5, { min: 1, max: 1 }],
    [0.91, { min: 1, max: 1 }],
    [1.3, { min: 2, max: 2 }],
    [2.6, { min: 3, max: 3 }],
  ])('com folga, um número só: %s página(s) de conteúdo', (fraction, expected) => {
    expect(estimatePages(at(fraction))).toEqual(expected)
  })

  it.each([
    [0.95, { min: 1, max: 2 }],
    [1.0, { min: 1, max: 2 }],
    [1.97, { min: 2, max: 3 }],
  ])('perto do fim de uma página, vira faixa: %s', (fraction, expected) => {
    expect(estimatePages(at(fraction))).toEqual(expected)
  })

  it('logo depois do fim de uma página, já conta a seguinte', () => {
    expect(estimatePages(at(1.01))).toEqual({ min: 2, max: 2 })
  })

  it('blocos que não se partem: se o pior caso (um vão por quebra) passa de página, vira faixa', () => {
    // 2,7 páginas de conteúdo: sem blocos grandes, 3; com blocos de ~0,3 página, pode chegar a 4.
    expect(estimatePages(at(2.7), 60)).toEqual({ min: 3, max: 3 })
    expect(estimatePages(at(2.7), 0.3 * PRINTABLE_HEIGHT)).toEqual({ min: 3, max: 4 })
    // O mínimo nunca muda: é o conteúdo sem nenhum vão.
    expect(estimatePages(at(1.5), PRINTABLE_HEIGHT).min).toBe(2)
  })

  it('conteúdo vazio ou inválido conta como 1 página', () => {
    expect(estimatePages(0)).toEqual({ min: 1, max: 1 })
    expect(estimatePages(Number.NaN)).toEqual({ min: 1, max: 1 })
  })
})

describe('formatPageEstimate', () => {
  it('singular, plural e faixas', () => {
    expect(formatPageEstimate({ min: 1, max: 1 })).toBe('Estimativa: 1 página')
    expect(formatPageEstimate({ min: 2, max: 2 })).toBe('Estimativa: 2 páginas')
    expect(formatPageEstimate({ min: 1, max: 2 })).toBe('Estimativa: 1 ou 2 páginas')
    expect(formatPageEstimate({ min: 3, max: 5 })).toBe('Estimativa: de 3 a 5 páginas')
  })
})
