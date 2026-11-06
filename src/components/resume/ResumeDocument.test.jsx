// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_RESUME, createEmptyResume } from '@/data/resume'
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
    expect(sectionTitles().sort()).toEqual(['Experiência', 'Formação', 'Habilidades', 'Resumo'])
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

  it('separa as habilidades por vírgula e quebra de linha', () => {
    renderResume({ ...SAMPLE_RESUME, skills: 'SQL,  Excel\nPython,' }, templateId)
    expect(listTexts(sectionList('Habilidades'))).toEqual(['SQL', 'Excel', 'Python'])
  })

  it('mostra habilidades repetidas sem chaves duplicadas e atualiza a lista corretamente', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { rerender } = renderResume({ ...SAMPLE_RESUME, skills: 'SQL, SQL, Excel' }, templateId)
    expect(listTexts(sectionList('Habilidades'))).toEqual(['SQL', 'SQL', 'Excel'])

    rerender(<ResumeDocument templateId={templateId} resume={{ ...SAMPLE_RESUME, skills: 'SQL, Excel' }} />)
    expect(listTexts(sectionList('Habilidades'))).toEqual(['SQL', 'Excel'])
    expect(consoleError).not.toHaveBeenCalled()
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
})

describe('ordem das seções', () => {
  it.each([
    ['classico', ['Resumo', 'Experiência', 'Formação', 'Habilidades']],
    // No Moderno, as habilidades ficam na coluna lateral, antes da área principal.
    ['moderno', ['Habilidades', 'Resumo', 'Experiência', 'Formação']],
    ['essencial', ['Resumo', 'Experiência', 'Formação', 'Habilidades']],
  ])('%s', (templateId, expected) => {
    renderResume(SAMPLE_RESUME, templateId)
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
