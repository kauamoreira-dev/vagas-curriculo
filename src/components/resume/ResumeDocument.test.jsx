// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_RESUME, createEmptyResume, normalizeResume } from '@/data/resume'
import { TEMPLATES } from '@/data/templates'
import { ResumeDocument } from './ResumeDocument'
import { ClassicTemplate } from './templates/ClassicTemplate'

const PHOTO = 'data:image/jpeg;base64,AAAA'
const TEMPLATE_IDS = TEMPLATES.map((template) => template.id)

function withPersonal(personal, resume = SAMPLE_RESUME) {
  return { ...resume, personal: { ...resume.personal, ...personal } }
}

function renderResume(resume, templateId = 'classico') {
  return render(<ResumeDocument templateId={templateId} resume={resume} />)
}

const sectionTitles = () => screen.queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
const listTexts = (list) => within(list).getAllByRole('listitem').map((item) => item.textContent)

// O título de cada seção fica no <section>, junto da lista que ela mostra.
function sectionList(title) {
  const section = screen.getByRole('heading', { level: 2, name: title }).closest('section')
  return within(section).getByRole('list')
}

afterEach(() => {
  vi.restoreAllMocks()
})

// Exemplo com todas as seções preenchidas, inclusive as opcionais.
const FULL_RESUME = {
  ...SAMPLE_RESUME,
  objective: 'Atuar com análise de dados no varejo.',
  certifications: [
    {
      id: 'c1',
      name: 'Power BI Data Analyst',
      issuer: 'Microsoft',
      issued: 'jun/2024',
      expires: 'jun/2026',
      url: 'learn.microsoft.com/cred/123',
    },
  ],
  courses: [{ id: 'k1', name: 'Excel Avançado', institution: 'Senac', hours: '40h', year: '2022' }],
  projects: [
    {
      id: 'p1',
      name: 'Painel de vendas',
      description: 'Painel aberto\nAtualização diária',
      technologies: 'Power BI, SQL',
      url: 'https://github.com/exemplo/painel',
    },
  ],
  languages: [
    { id: 'l1', language: 'Inglês', level: 'Avançado' },
    { id: 'l2', language: 'Espanhol', level: '' },
  ],
  additionalInfo: 'CNH categoria B\nDisponibilidade para viagens',
}

const SINGLE_COLUMN_ORDER = [
  'Objetivo',
  'Resumo',
  'Experiência',
  'Formação',
  'Cursos complementares',
  'Certificações',
  'Projetos',
  'Habilidades',
  'Idiomas',
  'Informações adicionais',
]

const sectionOf = (title) => screen.getByRole('heading', { level: 2, name: title }).closest('section')

describe.each(TEMPLATE_IDS)('modelo %s', (templateId) => {
  it('mostra nome, cargo, contatos e todas as seções do currículo', () => {
    renderResume(SAMPLE_RESUME, templateId)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Marina Albuquerque')
    expect(screen.getByText('Analista de Dados')).toBeInTheDocument()
    expect(listTexts(screen.getAllByRole('list')[0])).toEqual([
      'marina.exemplo@email.com',
      '(91) 90000-0000',
      'Belém, PA',
      'linkedin.com/in/exemplo',
    ])
    expect(sectionTitles().sort()).toEqual([
      'Certificações',
      'Cursos complementares',
      'Experiência',
      'Formação',
      'Habilidades',
      'Idiomas',
      'Resumo',
    ])
    expect(screen.getByText(SAMPLE_RESUME.summary)).toBeInTheDocument()
  })

  it('mostra cada experiência com cargo, empresa, período e tópicos', () => {
    renderResume(SAMPLE_RESUME, templateId)
    const [first, second] = screen.getAllByRole('article')

    expect(within(first).getByRole('heading', { level: 3 })).toHaveTextContent(
      'Analista de Dados Pleno · Cooperativa Rio Claro',
    )
    expect(within(first).getByText('mar/2023 – Atual')).toBeInTheDocument()
    expect(listTexts(within(first).getByRole('list'))).toHaveLength(3)
    expect(within(second).getByText('fev/2021 – fev/2023')).toBeInTheDocument()
  })

  it('com currículo vazio, mostra só os textos de exemplo do cabeçalho', () => {
    renderResume(createEmptyResume(), templateId)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Seu nome')
    expect(screen.getByText('Cargo ou área de atuação')).toBeInTheDocument()
    expect(sectionTitles()).toEqual([])
    expect(screen.queryByRole('list')).toBeNull()
    expect(screen.queryByRole('img')).toBeNull()
  })

  it('mostra a foto com texto alternativo e a esconde quando está oculta', () => {
    const { rerender } = renderResume(withPersonal({ photo: PHOTO }), templateId)
    expect(screen.getByRole('img', { name: 'Foto de Marina Albuquerque' })).toHaveAttribute('src', PHOTO)

    rerender(<ResumeDocument templateId={templateId} resume={withPersonal({ photo: PHOTO, photoVisible: false })} />)
    expect(screen.queryByRole('img')).toBeNull()

    rerender(<ResumeDocument templateId={templateId} resume={withPersonal({ photo: PHOTO, name: ' ' })} />)
    expect(screen.getByRole('img', { name: 'Foto de perfil' })).toBeInTheDocument()
  })

  it('mostra as habilidades de um currículo antigo (texto separado por vírgula e linha)', () => {
    renderResume(normalizeResume({ ...SAMPLE_RESUME, skills: 'SQL,  Excel\nPython,', softSkills: [] }), templateId)
    expect(listTexts(sectionList('Habilidades'))).toEqual(['SQL', 'Excel', 'Python'])
  })

  it('mostra habilidades repetidas sem chaves duplicadas e atualiza a lista corretamente', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const only = { ...SAMPLE_RESUME, softSkills: [] }
    const { rerender } = renderResume({ ...only, skills: ['SQL', 'SQL', 'Excel'] }, templateId)
    expect(listTexts(sectionList('Habilidades'))).toEqual(['SQL', 'SQL', 'Excel'])

    rerender(<ResumeDocument templateId={templateId} resume={{ ...only, skills: ['SQL', 'Excel'] }} />)
    expect(listTexts(sectionList('Habilidades'))).toEqual(['SQL', 'Excel'])
    expect(consoleError).not.toHaveBeenCalled()
  })
})

describe.each(TEMPLATE_IDS)('seções novas no modelo %s', (templateId) => {
  it('mostra objetivo e informações adicionais', () => {
    renderResume(FULL_RESUME, templateId)
    expect(within(sectionOf('Objetivo')).getByText(FULL_RESUME.objective)).toBeInTheDocument()
    expect(listTexts(sectionList('Informações adicionais'))).toEqual(['CNH categoria B', 'Disponibilidade para viagens'])
  })

  it('mostra certificação com emissor, datas e link de verificação clicável', () => {
    renderResume(FULL_RESUME, templateId)
    const section = sectionOf('Certificações')
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent('Power BI Data Analyst · Microsoft')
    expect(within(section).getByText('Emitida em jun/2024 · válida até jun/2026')).toBeInTheDocument()
    expect(within(section).getByRole('link', { name: 'learn.microsoft.com/cred/123' })).toHaveAttribute(
      'href',
      'https://learn.microsoft.com/cred/123',
    )
  })

  it('mostra curso com instituição, carga horária e ano', () => {
    renderResume(FULL_RESUME, templateId)
    const section = sectionOf('Cursos complementares')
    expect(within(section).getByRole('heading', { level: 3 })).toHaveTextContent('Excel Avançado · Senac')
    expect(within(section).getByText('40 h · 2022')).toBeInTheDocument()
  })

  it('mostra projeto com tecnologias, tópicos e link', () => {
    renderResume(FULL_RESUME, templateId)
    const section = sectionOf('Projetos')
    expect(within(section).getByText('Power BI, SQL')).toBeInTheDocument()
    expect(listTexts(within(section).getByRole('list'))).toEqual(['Painel aberto', 'Atualização diária'])
    expect(within(section).getByRole('link')).toHaveAttribute('href', 'https://github.com/exemplo/painel')
  })

  it('mostra idiomas com nível, quando informado', () => {
    renderResume(FULL_RESUME, templateId)
    expect(listTexts(sectionList('Idiomas'))).toEqual(['InglêsAvançado', 'Espanhol'])
  })

  it('separa habilidades técnicas e comportamentais com subtítulos só quando há as duas', () => {
    const { rerender } = renderResume(FULL_RESUME, templateId)
    const section = sectionOf('Habilidades')
    expect(within(section).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual([
      'Técnicas',
      'Comportamentais',
    ])
    expect(within(section).getAllByRole('list').map(listTexts)).toEqual([SAMPLE_RESUME.skills, SAMPLE_RESUME.softSkills])

    rerender(<ResumeDocument templateId={templateId} resume={{ ...FULL_RESUME, skills: [] }} />)
    expect(within(sectionOf('Habilidades')).queryByRole('heading', { level: 3 })).toBeNull()
    expect(listTexts(sectionList('Habilidades'))).toEqual(SAMPLE_RESUME.softSkills)
  })

  it('não mostra título de seção opcional sem conteúdo (itens vazios ou só com espaços)', () => {
    renderResume(
      {
        ...SAMPLE_RESUME,
        objective: '  ',
        certifications: [{ id: 'c', name: ' ', issuer: '', issued: 'jun/2024', expires: '', url: 'x.com' }],
        courses: [{ id: 'k', name: '', institution: '', hours: '40', year: '2022' }],
        projects: [{ id: 'p', name: '', description: '', technologies: 'React', url: '' }],
        languages: [{ id: 'l', language: ' ', level: 'Básico' }],
        skills: [],
        softSkills: [],
        additionalInfo: '\n',
      },
      templateId,
    )
    expect(sectionTitles().sort()).toEqual(['Experiência', 'Formação', 'Resumo'])
  })

  it('mostra só cidade/UF por padrão e o endereço completo quando escolhido', () => {
    const address = { street: 'Rua das Flores', number: '120', complement: 'apto 3', district: 'Centro', zip: '66010-000' }
    const { rerender } = renderResume(withPersonal(address), templateId)
    expect(screen.getByText('Belém, PA')).toBeInTheDocument()
    expect(screen.queryByText(/Rua das Flores/)).toBeNull()

    rerender(<ResumeDocument templateId={templateId} resume={withPersonal({ ...address, addressDisplay: 'full' })} />)
    expect(screen.getByText('Rua das Flores, 120, apto 3 – Centro – Belém, PA – CEP 66010-000')).toBeInTheDocument()
  })
})

describe('paginação', () => {
  it.each(TEMPLATE_IDS)('%s: só entradas com mais de 6 tópicos podem se partir entre páginas', (templateId) => {
    const [item] = SAMPLE_RESUME.experience
    const lines = (count) => Array.from({ length: count }, (_, index) => `Tópico ${index + 1}`).join('\n')
    renderResume(
      {
        ...SAMPLE_RESUME,
        experience: [
          { ...item, id: 'curta', description: lines(6) },
          { ...item, id: 'longa', description: lines(7) },
        ],
        projects: [{ id: 'p', name: 'Projeto', description: lines(8), technologies: '', url: '' }],
      },
      templateId,
    )
    const [short, long] = within(sectionOf('Experiência')).getAllByRole('article')
    expect(short).not.toHaveAttribute('data-long')
    expect(long).toHaveAttribute('data-long', 'true')
    expect(within(sectionOf('Projetos')).getByRole('article')).toHaveAttribute('data-long', 'true')
  })
})

describe.each(TEMPLATE_IDS)('idade no modelo %s', (templateId) => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 10))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('mostra a idade calculada junto dos contatos, depois do telefone', () => {
    renderResume(withPersonal({ birthDate: '1996-03-12' }), templateId)
    expect(listTexts(screen.getAllByRole('list')[0])).toEqual([
      'marina.exemplo@email.com',
      '(91) 90000-0000',
      '30 anos',
      'Belém, PA',
      'linkedin.com/in/exemplo',
    ])
  })

  it('não mostra a idade quando a pessoa a oculta ou a data é inválida', () => {
    const { rerender } = renderResume(withPersonal({ birthDate: '1996-03-12', ageVisible: false }), templateId)
    expect(screen.queryByText(/anos$/)).toBeNull()
    rerender(<ResumeDocument templateId={templateId} resume={withPersonal({ birthDate: '2030-01-01' })} />)
    expect(screen.queryByText(/anos$/)).toBeNull()
  })
})

describe('conteúdo parcial', () => {
  it('omite experiências e formações só com datas ou só com espaços', () => {
    const empty = createEmptyResume()
    renderResume({
      ...empty,
      personal: { ...empty.personal, name: 'Ana' },
      experience: [{ ...empty.experience[0], start: '2020', end: 'Atual', role: '  ' }],
      education: [{ ...empty.education[0], start: '2016', end: '2020' }],
    })
    expect(sectionTitles()).toEqual([])
  })

  it('sem empresa, não mostra o separador; sem datas, não mostra período', () => {
    const empty = createEmptyResume()
    renderResume({
      ...empty,
      experience: [{ ...empty.experience[0], role: 'Freelancer' }],
      education: [{ ...empty.education[0], institution: 'Senai', end: '2019' }],
    })
    const [job, course] = screen.getAllByRole('article')
    expect(within(job).getByRole('heading', { level: 3 }).textContent).toBe('Freelancer')
    expect(job.textContent).toBe('Freelancer')
    expect(within(course).getByRole('heading', { level: 3 }).textContent).toBe('Senai')
    expect(within(course).getByText('2019')).toBeInTheDocument()
  })

  it('tira marcadores digitados dos tópicos e ignora linhas vazias', () => {
    const [item] = SAMPLE_RESUME.experience
    renderResume({ ...SAMPLE_RESUME, experience: [{ ...item, description: '- Um\n\n• Dois\n  ' }] })
    expect(listTexts(within(screen.getAllByRole('article')[0]).getByRole('list'))).toEqual(['Um', 'Dois'])
  })

  it('só lista os contatos preenchidos', () => {
    renderResume(withPersonal({ email: ' ', phone: '', link: '' }))
    expect(listTexts(screen.getAllByRole('list')[0])).toEqual(['Belém, PA'])
  })

  it('endereço completo com parte dos campos não deixa separadores sobrando', () => {
    renderResume(
      withPersonal({ email: '', phone: '', link: '', city: '', street: 'Rua A', zip: '66010-000', addressDisplay: 'full' }),
    )
    expect(listTexts(screen.getAllByRole('list')[0])).toEqual(['Rua A – PA – CEP 66010-000'])
  })

  it('sem cidade nem estado, o endereço fica fora dos contatos', () => {
    renderResume(withPersonal({ city: '', state: '', street: 'Rua A' }))
    expect(listTexts(screen.getAllByRole('list')[0])).toEqual([
      'marina.exemplo@email.com',
      '(91) 90000-0000',
      'linkedin.com/in/exemplo',
    ])
  })
})

describe('ordem das seções', () => {
  it.each([
    ['classico', SINGLE_COLUMN_ORDER],
    // No Moderno, habilidades e idiomas ficam na coluna lateral, antes da área principal.
    [
      'moderno',
      [
        'Habilidades',
        'Idiomas',
        'Objetivo',
        'Resumo',
        'Experiência',
        'Formação',
        'Cursos complementares',
        'Certificações',
        'Projetos',
        'Informações adicionais',
      ],
    ],
    ['essencial', SINGLE_COLUMN_ORDER],
  ])('%s', (templateId, expected) => {
    renderResume(FULL_RESUME, templateId)
    expect(sectionTitles()).toEqual(expected)
  })
})

describe('ResumeDocument', () => {
  it.each([undefined, 'inexistente'])('usa o Clássico para o modelo %j', (templateId) => {
    const expected = render(<ClassicTemplate resume={SAMPLE_RESUME} />).container.innerHTML
    const { container } = renderResume(SAMPLE_RESUME, templateId)
    expect(container.innerHTML).toBe(expected)
  })

  it('os três modelos produzem marcações diferentes', () => {
    const html = TEMPLATE_IDS.map((templateId) => {
      const { container, unmount } = renderResume(SAMPLE_RESUME, templateId)
      const markup = container.innerHTML
      unmount()
      return markup
    })
    expect(new Set(html).size).toBe(TEMPLATE_IDS.length)
  })
})
