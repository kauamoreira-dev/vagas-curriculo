import { describe, expect, it } from 'vitest'
import {
  SAMPLE_RESUME,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyResume,
  hasResumeContent,
  normalizeResume,
  resumeTitle,
} from './resume'

describe('createEmptyResume', () => {
  it('começa com um item vazio de experiência e de formação, e foto visível', () => {
    const resume = createEmptyResume()
    expect(resume.personal).toMatchObject({ name: '', photo: '', photoVisible: true })
    expect(resume.experience).toEqual([{ ...createEmptyExperience(), id: expect.any(String) }])
    expect(resume.education).toEqual([{ ...createEmptyEducation(), id: expect.any(String) }])
  })

  it('gera ids novos a cada chamada', () => {
    const [a, b] = [createEmptyResume(), createEmptyResume()]
    expect(a.experience[0].id).not.toBe(b.experience[0].id)
    expect(a.education[0].id).not.toBe(b.education[0].id)
  })
})

describe('normalizeResume', () => {
  it.each([undefined, null, 'texto', 42, true])('devolve um currículo vazio para %j', (raw) => {
    const resume = normalizeResume(raw)
    expect(hasResumeContent(resume)).toBe(false)
    expect(Object.keys(resume)).toEqual(Object.keys(createEmptyResume()))
  })

  it('preserva um currículo já no formato atual', () => {
    expect(normalizeResume(SAMPLE_RESUME)).toEqual(SAMPLE_RESUME)
  })

  it('completa campos ausentes e descarta os desconhecidos', () => {
    const resume = normalizeResume({
      personal: { name: 'Ana', cpf: '000' },
      summary: 'Resumo',
      extra: true,
      experience: [{ id: 'e1', role: 'Analista', salario: 1000 }],
    })
    expect(resume.personal).toEqual({ ...createEmptyResume().personal, name: 'Ana' })
    expect(resume).not.toHaveProperty('extra')
    expect(resume.experience).toEqual([
      { id: 'e1', role: 'Analista', company: '', start: '', end: '', description: '' },
    ])
    expect(resume.education).toHaveLength(1)
  })

  it('converte valores que não são texto em texto vazio', () => {
    const resume = normalizeResume({
      personal: { name: 42, email: null },
      summary: ['a'],
      skills: { sql: true },
      education: [{ id: 'f1', course: 7, start: 2020 }],
    })
    expect(resume.personal).toMatchObject({ name: '', email: '' })
    expect(resume.summary).toBe('')
    expect(resume.skills).toBe('')
    expect(resume.education[0]).toMatchObject({ id: 'f1', course: '', start: '' })
  })

  it('só oculta a foto quando photoVisible é exatamente false', () => {
    const visible = (value) => normalizeResume({ personal: { photoVisible: value } }).personal.photoVisible
    expect(visible(false)).toBe(false)
    expect(visible(undefined)).toBe(true)
    expect(visible('false')).toBe(true)
    expect(visible(0)).toBe(true)
  })

  it('mantém listas vazias, mas usa o padrão quando a lista não é um array', () => {
    expect(normalizeResume({ experience: [], education: [] })).toMatchObject({ experience: [], education: [] })
    const resume = normalizeResume({ experience: 'texto', education: null })
    expect(resume.experience).toHaveLength(1)
    expect(resume.education).toHaveLength(1)
  })

  it('cria id para itens sem id ou inválidos', () => {
    const resume = normalizeResume({ experience: [{ role: 'A' }, { id: '', role: 'B' }, null] })
    const ids = resume.experience.map((item) => item.id)
    expect(ids.every((id) => typeof id === 'string' && id)).toBe(true)
    expect(new Set(ids).size).toBe(3)
    expect(resume.experience.map((item) => item.role)).toEqual(['A', 'B', ''])
  })
})

describe('hasResumeContent', () => {
  it('currículo vazio ou só com espaços não tem conteúdo', () => {
    const resume = createEmptyResume()
    expect(hasResumeContent(resume)).toBe(false)
    resume.personal.name = '   '
    resume.summary = '\n'
    resume.experience[0].role = '  '
    expect(hasResumeContent(resume)).toBe(false)
  })

  it('photoVisible desligado sozinho não conta', () => {
    const resume = createEmptyResume()
    resume.personal.photoVisible = false
    expect(hasResumeContent(resume)).toBe(false)
  })

  it.each([
    ['nome', (resume) => (resume.personal.name = 'Ana')],
    ['foto', (resume) => (resume.personal.photo = 'data:image/jpeg;base64,AAAA')],
    ['resumo', (resume) => (resume.summary = 'Resumo')],
    ['habilidades', (resume) => (resume.skills = 'SQL')],
    ['cargo', (resume) => (resume.experience[0].role = 'Analista')],
    ['curso', (resume) => (resume.education[0].course = 'ADS')],
    // Diferente da pré-visualização (hasEducationContent), aqui datas contam: algo foi digitado.
    ['só a data de uma formação', (resume) => (resume.education[0].start = '2020')],
  ])('conta %s', (_, fill) => {
    const resume = createEmptyResume()
    fill(resume)
    expect(hasResumeContent(resume)).toBe(true)
  })

  it('conta conteúdo em qualquer item, não só no primeiro', () => {
    const resume = createEmptyResume()
    resume.experience.push({ ...createEmptyExperience(), company: 'Empresa' })
    expect(hasResumeContent(resume)).toBe(true)
  })
})

describe('resumeTitle', () => {
  const withPersonal = (personal) => ({ personal })

  it('une nome e cargo', () => {
    expect(resumeTitle(SAMPLE_RESUME)).toBe('Marina Albuquerque · Analista de Dados')
  })

  it('usa o que estiver preenchido, sem espaços nas pontas', () => {
    expect(resumeTitle(withPersonal({ name: '  Ana  ', title: ' ' }))).toBe('Ana')
    expect(resumeTitle(withPersonal({ name: '', title: ' Designer ' }))).toBe('Designer')
  })

  it.each([undefined, null, {}, withPersonal({ name: 42 }), createEmptyResume()])(
    'cai no título padrão para %j',
    (resume) => {
      expect(resumeTitle(resume)).toBe('Currículo sem título')
    },
  )
})
