import { describe, expect, it } from 'vitest'
import {
  formatPeriod,
  hasEducationContent,
  hasExperienceContent,
  splitLines,
  splitSkills,
} from './resumeText'

describe('splitLines', () => {
  it('tira marcadores de lista digitados e espaços nas pontas', () => {
    expect(splitLines('- Primeiro\n• Segundo\n* Terceiro\n   Quarto  ')).toEqual([
      'Primeiro',
      'Segundo',
      'Terceiro',
      'Quarto',
    ])
  })

  it('descarta linhas vazias, só com espaços ou só com o marcador', () => {
    expect(splitLines('Um\n\n   \n-\nDois\n')).toEqual(['Um', 'Dois'])
  })

  it('mantém marcadores no meio da linha', () => {
    expect(splitLines('Vendas B2B - região Norte')).toEqual(['Vendas B2B - região Norte'])
  })

  it.each([undefined, null, ''])('retorna lista vazia para %j', (text) => {
    expect(splitLines(text)).toEqual([])
  })
})

describe('splitSkills', () => {
  it('separa por vírgula e por quebra de linha', () => {
    expect(splitSkills('SQL, Power BI\nExcel,Python')).toEqual(['SQL', 'Power BI', 'Excel', 'Python'])
  })

  it('descarta itens vazios de vírgulas repetidas ou no fim', () => {
    expect(splitSkills('SQL,, ,Excel,\n')).toEqual(['SQL', 'Excel'])
  })

  it.each([undefined, null, ''])('retorna lista vazia para %j', (text) => {
    expect(splitSkills(text)).toEqual([])
  })
})

describe('formatPeriod', () => {
  it('une início e fim com travessão', () => {
    expect(formatPeriod('mar/2022', 'Atual')).toBe('mar/2022 – Atual')
  })

  it('mostra só a data preenchida', () => {
    expect(formatPeriod('2020', '')).toBe('2020')
    expect(formatPeriod('', '2024')).toBe('2024')
  })

  it('ignora espaços e valores ausentes', () => {
    expect(formatPeriod('  2020 ', '   ')).toBe('2020')
    expect(formatPeriod(undefined, null)).toBe('')
  })

  it('aceita números (dados antigos)', () => {
    expect(formatPeriod(2016, 2020)).toBe('2016 – 2020')
  })
})

describe('hasExperienceContent', () => {
  const empty = { role: '', company: '', start: '', end: '', description: '' }

  it.each(['role', 'company', 'description'])('conta %s preenchido', (field) => {
    expect(hasExperienceContent({ ...empty, [field]: 'texto' })).toBe(true)
  })

  it('não conta item só com datas ou só com espaços', () => {
    expect(hasExperienceContent({ ...empty, start: '2020', end: 'Atual' })).toBe(false)
    expect(hasExperienceContent({ ...empty, role: '   ', description: '\n' })).toBe(false)
  })
})

describe('hasEducationContent', () => {
  const empty = { course: '', institution: '', start: '', end: '' }

  it.each(['course', 'institution'])('conta %s preenchido', (field) => {
    expect(hasEducationContent({ ...empty, [field]: 'texto' })).toBe(true)
  })

  it('não conta item só com datas ou só com espaços', () => {
    expect(hasEducationContent({ ...empty, start: '2016', end: '2020' })).toBe(false)
    expect(hasEducationContent({ ...empty, course: '  ' })).toBe(false)
  })
})
