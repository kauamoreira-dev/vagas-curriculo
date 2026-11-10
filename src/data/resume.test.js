import { describe, expect, it } from 'vitest'
import {
  ITEM_FACTORIES,
  LIST_SECTIONS,
  SAMPLE_RESUME,
  createEmptyCertification,
  createEmptyCourse,
  createEmptyEducation,
  createEmptyExperience,
  createEmptyLanguage,
  createEmptyProject,
  createEmptyResume,
  hasResumeContent,
  normalizeResume,
  resumeTitle,
  splitLocation,
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
    expect(resume.skills).toEqual([])
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

  it('preferências de exibição sozinhas não contam', () => {
    const resume = createEmptyResume()
    resume.personal.photoVisible = false
    resume.personal.addressDisplay = 'full'
    expect(hasResumeContent(resume)).toBe(false)
  })

  it.each([
    ['nome', (resume) => (resume.personal.name = 'Ana')],
    ['foto', (resume) => (resume.personal.photo = 'data:image/jpeg;base64,AAAA')],
    ['resumo', (resume) => (resume.summary = 'Resumo')],
    ['habilidades técnicas', (resume) => (resume.skills = ['SQL'])],
    ['habilidades comportamentais', (resume) => (resume.softSkills = ['Empatia'])],
    ['objetivo', (resume) => (resume.objective = 'Vaga de analista')],
    ['informações adicionais', (resume) => (resume.additionalInfo = 'CNH B')],
    ['cidade', (resume) => (resume.personal.city = 'Belém')],
    ['idioma', (resume) => resume.languages.push({ ...createEmptyLanguage(), language: 'Inglês' })],
    ['certificação', (resume) => resume.certifications.push({ ...createEmptyCertification(), name: 'AWS' })],
    ['curso', (resume) => resume.courses.push({ ...createEmptyCourse(), name: 'Excel' })],
    ['projeto', (resume) => resume.projects.push({ ...createEmptyProject(), name: 'App' })],
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

describe('seções novas', () => {
  it('começam vazias e opcionais, com endereço exibido só como cidade/UF', () => {
    const resume = createEmptyResume()
    expect(resume).toMatchObject({
      objective: '',
      additionalInfo: '',
      certifications: [],
      courses: [],
      projects: [],
      languages: [],
      skills: [],
      softSkills: [],
    })
    expect(resume.personal).toMatchObject({ city: '', state: '', street: '', zip: '', addressDisplay: 'city' })
  })

  it.each(LIST_SECTIONS)('normaliza os itens de %s, mantendo só os campos conhecidos', (section) => {
    const fields = Object.keys(ITEM_FACTORIES[section]()).filter((field) => field !== 'id')
    const raw = Object.fromEntries(fields.map((field) => [field, `valor ${field}`]))
    const [item] = normalizeResume({ [section]: [{ id: 'x1', ...raw, desconhecido: 1, [fields[0]]: 7 }] })[section]
    expect(item).toEqual({ id: 'x1', ...raw, [fields[0]]: '' })
  })

  it('preserva um currículo com todas as seções preenchidas', () => {
    const full = {
      ...SAMPLE_RESUME,
      personal: { ...SAMPLE_RESUME.personal, street: 'Rua A', number: '10', zip: '66010-000', addressDisplay: 'full' },
      objective: 'Objetivo',
      projects: [{ id: 'p1', name: 'App', description: 'Desc', technologies: 'React', url: 'github.com/x' }],
      additionalInfo: 'CNH B',
    }
    expect(normalizeResume(full)).toEqual(full)
  })

  it('aceita só "city" ou "full" na exibição do endereço e só UFs válidas', () => {
    const personal = (value) => normalizeResume({ personal: value }).personal
    expect(personal({ addressDisplay: 'full' }).addressDisplay).toBe('full')
    expect(personal({ addressDisplay: 'tudo' }).addressDisplay).toBe('city')
    expect(personal({ state: 'XX' }).state).toBe('')
    expect(personal({ state: 'SP' }).state).toBe('SP')
  })
})

describe('compatibilidade com currículos antigos', () => {
  // Formato salvo antes das seções novas: `location` livre e `skills` como texto.
  const OLD_RESUME = {
    personal: { name: 'Ana', email: 'ana@email.com', location: 'Santarém, PA', photo: '', photoVisible: true },
    summary: 'Resumo',
    experience: [{ id: 'e1', role: 'Analista', company: 'Empresa', start: '2020', end: 'Atual', description: '' }],
    education: [],
    skills: 'Excel, Atendimento ao cliente\nInglês intermediário',
  }

  it('mantém todo o conteúdo e completa as seções novas vazias', () => {
    const resume = normalizeResume(OLD_RESUME)
    expect(resume.personal).toMatchObject({ name: 'Ana', email: 'ana@email.com', city: 'Santarém', state: 'PA' })
    expect(resume.personal).not.toHaveProperty('location')
    expect(resume.summary).toBe('Resumo')
    expect(resume.experience).toEqual(OLD_RESUME.experience)
    expect(resume.skills).toEqual(['Excel', 'Atendimento ao cliente', 'Inglês intermediário'])
    expect(resume).toMatchObject({ softSkills: [], certifications: [], courses: [], languages: [], projects: [] })
  })

  it('normalizar duas vezes dá o mesmo resultado', () => {
    const once = normalizeResume(OLD_RESUME)
    expect(normalizeResume(once)).toEqual(once)
  })

  it('não usa `location` quando cidade ou estado já existem', () => {
    const resume = normalizeResume({ personal: { location: 'Belém, PA', city: '', state: 'AM' } })
    expect(resume.personal).toMatchObject({ city: '', state: 'AM' })
  })

  it('descarta itens vazios das habilidades e o que não é texto', () => {
    expect(normalizeResume({ skills: [' SQL ', '', 3, null, 'Excel'] }).skills).toEqual(['SQL', 'Excel'])
    expect(normalizeResume({ softSkills: 'Empatia,, Liderança' }).softSkills).toEqual(['Empatia', 'Liderança'])
  })
})

describe('splitLocation', () => {
  it.each([
    ['Belém, PA', { city: 'Belém', state: 'PA' }],
    ['Santarém - pa', { city: 'Santarém', state: 'PA' }],
    ['São Paulo/SP', { city: 'São Paulo', state: 'SP' }],
    ['Rio de Janeiro (RJ)', { city: 'Rio de Janeiro', state: 'RJ' }],
    ['Manaus', { city: 'Manaus', state: '' }],
    // Sigla que não é UF: nada se perde, o texto todo fica como cidade.
    ['Lisboa, PT', { city: 'Lisboa, PT', state: '' }],
    ['  ', { city: '', state: '' }],
  ])('%j', (location, expected) => {
    expect(splitLocation(location)).toEqual(expected)
  })
})

describe('data de nascimento e idade', () => {
  it('currículo antigo ganha data vazia e idade visível', () => {
    const { personal } = normalizeResume({ personal: { name: 'Ana', location: 'Belém, PA' } })
    expect(personal).toMatchObject({ birthDate: '', ageVisible: true })
  })

  it('preserva a data e só oculta a idade quando ageVisible é exatamente false', () => {
    const personal = (value) => normalizeResume({ personal: value }).personal
    expect(personal({ birthDate: '1996-03-12', ageVisible: false })).toMatchObject({
      birthDate: '1996-03-12',
      ageVisible: false,
    })
    expect(personal({ ageVisible: 'false' }).ageVisible).toBe(true)
  })

  it('ocultar a idade sozinho não conta como conteúdo; a data conta', () => {
    const resume = createEmptyResume()
    resume.personal.ageVisible = false
    expect(hasResumeContent(resume)).toBe(false)
    resume.personal.birthDate = '1996-03-12'
    expect(hasResumeContent(resume)).toBe(true)
  })
})
