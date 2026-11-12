// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_RESUME } from '@/data/resume'
import { LEGACY_KEY, RESUME_PREFIX, resumeStore } from '@/services/resumeStore'
import { useResumeDraft } from './useResumeDraft'

// Mesmo valor de SAVE_DELAY no hook.
const SAVE_DELAY = 400

const originalSetItem = Storage.prototype.setItem
let setItem

// Grava currículos de verdade no localStorage, um segundo mais novo que o anterior.
function seed(overrides = {}) {
  vi.advanceTimersByTime(1000)
  return resumeStore.saveResume({ ...resumeStore.newRecord(), resume: SAMPLE_RESUME, ...overrides })
}

const resumeWrites = () => setItem.mock.calls.filter(([key]) => key.startsWith(RESUME_PREFIX))
const storedResumeKeys = () => Object.keys(localStorage).filter((key) => key.startsWith(RESUME_PREFIX))

function renderDraft(id, options) {
  return renderHook(({ id: current }) => useResumeDraft(current), { initialProps: { id }, ...options })
}

function wait(ms = SAVE_DELAY) {
  act(() => vi.advanceTimersByTime(ms))
}

function failWrites(fail = true) {
  setItem.mockImplementation(function (key, value) {
    if (fail) throw new DOMException('Sem espaço', 'QuotaExceededError')
    return originalSetItem.call(this, key, value)
  })
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(Date.UTC(2026, 10, 6, 12)))
  localStorage.clear()
  setItem = vi.spyOn(Storage.prototype, 'setItem')
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('abertura (B1–B3)', () => {
  it('sem id e sem currículos, abre um novo que só é gravado na primeira alteração', () => {
    const { result } = renderDraft()
    expect(result.current).toMatchObject({ notFound: false, persisted: false, resumeId: expect.any(String) })
    expect(result.current.resume.personal.name).toBe('')

    wait(5000)
    expect(storedResumeKeys()).toEqual([])

    act(() => result.current.setPersonalField('name', 'Ana'))
    wait()
    expect(result.current.persisted).toBe(true)
    expect(resumeStore.getResume(result.current.resumeId).resume.personal.name).toBe('Ana')
    expect(resumeStore.listResumes().map((item) => item.title)).toEqual(['Ana'])
  })

  it('sem id, abre o currículo alterado mais recentemente', () => {
    seed({ title: 'Antigo' })
    const recent = seed({ title: 'Recente' })
    const { result } = renderDraft()
    expect(result.current).toMatchObject({ resumeId: recent.id, title: 'Recente', persisted: true })
  })

  it('sem id e com rascunho v1 não migrado, mostra os dados dele e os grava ao editar', () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({ templateId: 'moderno', resume: SAMPLE_RESUME }))
    const { result } = renderDraft()
    expect(result.current).toMatchObject({ persisted: false, templateId: 'moderno' })
    expect(result.current.resume.personal.name).toBe('Marina Albuquerque')

    act(() => result.current.setField('summary', 'Novo resumo'))
    wait()
    const saved = resumeStore.getResume(result.current.resumeId)
    expect(saved).toMatchObject({ templateId: 'moderno', resume: { summary: 'Novo resumo' } })
  })

  it('com id existente, abre aquele currículo', () => {
    const target = seed({ title: 'Alvo', templateId: 'essencial' })
    seed({ title: 'Mais novo' })
    const { result } = renderDraft(target.id)
    expect(result.current).toMatchObject({ resumeId: target.id, title: 'Alvo', templateId: 'essencial' })
  })

  it('com id desconhecido, indica "não encontrado" e as ações não fazem nada', () => {
    const { result } = renderDraft('nao-existe')
    expect(result.current).toMatchObject({ notFound: true, resumeId: undefined, resume: undefined, title: '' })

    act(() => {
      result.current.setTitle('Título')
      result.current.setPersonalField('name', 'Ana')
      result.current.addItem('experience')
      result.current.resetDraft()
    })
    wait(5000)
    expect(result.current.notFound).toBe(true)
    expect(setItem).not.toHaveBeenCalled()
  })
})

describe('salvamento automático (B4–B5)', () => {
  it('agrupa alterações seguidas numa única gravação, 400 ms depois da última', () => {
    const { result } = renderDraft()
    for (const name of ['A', 'An', 'Ana', 'Ana ', 'Ana S']) {
      act(() => result.current.setPersonalField('name', name))
      wait(SAVE_DELAY - 100)
    }
    expect(resumeWrites()).toHaveLength(0)

    wait(100)
    expect(resumeWrites()).toHaveLength(1)
    expect(resumeStore.getResume(result.current.resumeId).resume.personal.name).toBe('Ana S')

    wait(5000)
    expect(resumeWrites()).toHaveLength(1)
  })

  it('grava na hora quando a página é fechada (pagehide)', () => {
    const { result } = renderDraft()
    act(() => result.current.setPersonalField('name', 'Ana'))
    act(() => window.dispatchEvent(new Event('pagehide')))
    expect(resumeWrites()).toHaveLength(1)

    wait() // o timer pendente não grava de novo
    expect(resumeWrites()).toHaveLength(1)
  })

  it('grava na hora quando a aba fica oculta, mas não quando volta a ficar visível', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible')
    const { result } = renderDraft()
    act(() => result.current.setPersonalField('name', 'Ana'))

    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(resumeWrites()).toHaveLength(0)

    visibility.mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    expect(resumeWrites()).toHaveLength(1)
  })

  it('grava a alteração pendente ao desmontar', () => {
    const { result, unmount } = renderDraft()
    const id = result.current.resumeId
    act(() => result.current.setTitle('Vaga no banco'))
    unmount()
    expect(resumeStore.getResume(id).title).toBe('Vaga no banco')
  })

  it('para de ouvir pagehide e visibilitychange depois de desmontar', () => {
    const { result, unmount } = renderDraft()
    act(() => result.current.setTitle('Vaga'))
    unmount()
    setItem.mockClear()
    window.dispatchEvent(new Event('pagehide'))
    document.dispatchEvent(new Event('visibilitychange'))
    expect(setItem).not.toHaveBeenCalled()
  })
})

describe('troca de currículo (B6, B9)', () => {
  it('grava a alteração pendente do anterior antes de abrir o próximo', () => {
    const first = seed({ title: 'Primeiro' })
    const second = seed({ title: 'Segundo' })
    setItem.mockClear()
    const { result, rerender } = renderDraft(first.id)

    act(() => result.current.setTitle('Primeiro editado'))
    rerender({ id: second.id })

    expect(result.current).toMatchObject({ resumeId: second.id, title: 'Segundo' })
    expect(resumeStore.getResume(first.id).title).toBe('Primeiro editado')
    expect(resumeWrites().map(([key]) => key)).toEqual([RESUME_PREFIX + first.id])

    wait(5000) // o currículo recém-aberto, sem alterações, não é regravado
    expect(resumeWrites()).toHaveLength(1)
    expect(resumeStore.getResume(second.id).updatedAt).toBe(second.updatedAt)
  })

  it('/editor → /editor/:id do mesmo currículo não recarrega nem perde a alteração pendente', () => {
    const { result, rerender } = renderDraft(undefined)
    const id = result.current.resumeId
    act(() => result.current.setPersonalField('name', 'Ana'))
    wait()
    expect(result.current.persisted).toBe(true)

    act(() => result.current.setPersonalField('name', 'Ana Souza')) // ainda não gravado
    rerender({ id })

    expect(result.current).toMatchObject({ resumeId: id, persisted: true })
    expect(result.current.resume.personal.name).toBe('Ana Souza')
    wait()
    expect(resumeStore.getResume(id).resume.personal.name).toBe('Ana Souza')
  })
})

describe('StrictMode (B7)', () => {
  it.each([
    ['um currículo existente', () => seed().id],
    ['um currículo novo', () => undefined],
  ])('abrir %s não grava nada', (_, getId) => {
    const id = getId()
    setItem.mockClear()
    const { result, unmount } = renderDraft(id, { wrapper: StrictMode })
    expect(result.current.notFound).toBe(false)
    wait(5000)
    unmount()
    expect(setItem).not.toHaveBeenCalled()
  })

  it('a primeira alteração é gravada uma única vez', () => {
    const { result } = renderDraft(undefined, { wrapper: StrictMode })
    act(() => result.current.setPersonalField('name', 'Ana'))
    wait()
    expect(resumeWrites()).toHaveLength(1)
    expect(result.current.persisted).toBe(true)
  })
})

describe('falha de armazenamento (B8)', () => {
  it('indica storageAvailable=false e volta a true quando uma gravação seguinte funciona', () => {
    const { result } = renderDraft()
    expect(result.current.storageAvailable).toBe(true)

    failWrites()
    act(() => result.current.setPersonalField('name', 'Ana'))
    wait()
    expect(result.current).toMatchObject({ storageAvailable: false, persisted: false })
    expect(result.current.resume.personal.name).toBe('Ana') // o conteúdo continua na tela

    failWrites(false)
    act(() => result.current.setPersonalField('name', 'Ana Souza'))
    wait()
    expect(result.current).toMatchObject({ storageAvailable: true, persisted: true })
    expect(resumeStore.getResume(result.current.resumeId).resume.personal.name).toBe('Ana Souza')
  })

  it('com localStorage bloqueado, o editor abre um currículo novo em memória', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Acesso negado', 'SecurityError')
    })
    failWrites()
    const { result } = renderDraft()
    expect(result.current).toMatchObject({ notFound: false, persisted: false })

    act(() => result.current.setTitle('Rascunho'))
    wait()
    expect(result.current).toMatchObject({ storageAvailable: false, title: 'Rascunho' })
  })
})

describe('estado do salvamento', () => {
  it('currículo novo: "unsaved"; alteração: "pending"; após gravar: "saved" com o horário', () => {
    const { result } = renderDraft()
    expect(result.current).toMatchObject({ saveStatus: 'unsaved', savedAt: null })

    act(() => result.current.setPersonalField('name', 'Ana'))
    expect(result.current.saveStatus).toBe('pending')
    wait(SAVE_DELAY - 1)
    expect(result.current.saveStatus).toBe('pending')
    wait(1)
    expect(result.current.saveStatus).toBe('saved')
    // O horário é o da gravação confirmada no localStorage.
    expect(result.current.savedAt).toBe(resumeStore.getResume(result.current.resumeId).updatedAt)
  })

  it('currículo já salvo abre como "saved", com o horário da última gravação', () => {
    const record = seed()
    const { result } = renderDraft(record.id)
    expect(result.current).toMatchObject({ saveStatus: 'saved', savedAt: record.updatedAt })
  })

  it('falha: "error" até uma gravação dar certo; a alteração não se perde e "retrySave" tenta de novo', () => {
    const record = seed()
    const { result } = renderDraft(record.id)
    failWrites()
    act(() => result.current.setPersonalField('name', 'Ana'))
    wait()
    expect(result.current).toMatchObject({ saveStatus: 'error', storageAvailable: false })

    // Outra edição com o armazenamento ainda falhando: o aviso continua (não volta a "salvando").
    act(() => result.current.setPersonalField('title', 'Designer'))
    expect(result.current.saveStatus).toBe('error')
    wait()
    expect(result.current.saveStatus).toBe('error')
    expect(resumeStore.getResume(record.id).resume.personal.name).toBe('Marina Albuquerque')

    failWrites(false)
    act(() => result.current.retrySave())
    expect(result.current).toMatchObject({ saveStatus: 'saved', storageAvailable: true })
    expect(resumeStore.getResume(record.id).resume.personal).toMatchObject({ name: 'Ana', title: 'Designer' })
  })

  it('"retrySave" sem nada pendente não grava', () => {
    const record = seed()
    const { result } = renderDraft(record.id)
    setItem.mockClear()
    act(() => result.current.retrySave())
    expect(resumeWrites()).toHaveLength(0)
    expect(result.current.saveStatus).toBe('saved')
  })
})

describe('desfazer remoção (restoreItem)', () => {
  function openWithThreeJobs() {
    const [job] = SAMPLE_RESUME.experience
    const experience = ['a', 'b', 'c'].map((id) => ({ ...job, id, role: `Cargo ${id}` }))
    const record = seed({ resume: { ...SAMPLE_RESUME, experience } })
    return renderDraft(record.id)
  }
  const ids = (result) => result.current.resume.experience.map((item) => item.id)

  it('devolve o item à posição original, com todos os dados', () => {
    const { result } = openWithThreeJobs()
    const removed = result.current.resume.experience[1]
    act(() => result.current.removeItem('experience', 'b'))
    expect(ids(result)).toEqual(['a', 'c'])

    act(() => result.current.restoreItem('experience', removed, 1))
    expect(ids(result)).toEqual(['a', 'b', 'c'])
    expect(result.current.resume.experience[1]).toEqual(removed)
    wait()
    expect(resumeStore.getResume(result.current.resumeId).resume.experience[1]).toEqual(removed)
  })

  it('mantém as edições feitas depois da remoção', () => {
    const { result } = openWithThreeJobs()
    const removed = result.current.resume.experience[0]
    act(() => result.current.removeItem('experience', 'a'))
    act(() => result.current.updateItem('experience', 'c', 'company', 'Nova empresa'))
    act(() => result.current.setField('summary', 'Resumo novo'))

    act(() => result.current.restoreItem('experience', removed, 0))
    expect(ids(result)).toEqual(['a', 'b', 'c'])
    expect(result.current.resume.experience[2].company).toBe('Nova empresa')
    expect(result.current.resume.summary).toBe('Resumo novo')
  })

  it('se a lista encolheu, devolve ao fim; não duplica se o item já voltou', () => {
    const { result } = openWithThreeJobs()
    const removed = result.current.resume.experience[2]
    act(() => result.current.removeItem('experience', 'c'))
    act(() => result.current.removeItem('experience', 'b'))
    act(() => result.current.restoreItem('experience', removed, 2))
    expect(ids(result)).toEqual(['a', 'c'])

    act(() => result.current.restoreItem('experience', removed, 0))
    expect(ids(result)).toEqual(['a', 'c'])
  })
})

describe('ações (B10)', () => {
  function openSaved() {
    const record = seed({ templateId: 'classico' })
    setItem.mockClear()
    return { record, ...renderDraft(record.id) }
  }

  it('setTemplateId ignora modelo inválido ou igual ao atual, sem gravar', () => {
    const { result } = openSaved()
    act(() => result.current.setTemplateId('inexistente'))
    act(() => result.current.setTemplateId('classico'))
    wait()
    expect(result.current.templateId).toBe('classico')
    expect(resumeWrites()).toHaveLength(0)

    act(() => result.current.setTemplateId('moderno'))
    wait()
    expect(result.current.templateId).toBe('moderno')
    expect(resumeStore.listResumes()[0].templateId).toBe('moderno')
  })

  it('setTitle grava o nome dado pela pessoa; autoTitle acompanha nome e cargo', () => {
    const { result, record } = openSaved()
    expect(result.current.autoTitle).toBe('Marina Albuquerque · Analista de Dados')
    act(() => result.current.setTitle('Vaga no banco'))
    act(() => result.current.setPersonalField('title', 'Cientista de Dados'))
    wait()
    expect(result.current.autoTitle).toBe('Marina Albuquerque · Cientista de Dados')
    expect(resumeStore.getResume(record.id).title).toBe('Vaga no banco')
  })

  it('addItem, updateItem e removeItem editam a seção pedida', () => {
    const { result } = openSaved()
    act(() => result.current.addItem('education'))
    const added = result.current.resume.education.at(-1)
    expect(result.current.resume.education).toHaveLength(2)
    expect(added).toMatchObject({ course: '', institution: '' })

    act(() => result.current.updateItem('education', added.id, 'course', 'MBA'))
    expect(result.current.resume.education.at(-1).course).toBe('MBA')
    expect(result.current.resume.education[0].course).toBe('Bacharelado em Estatística')

    act(() => result.current.removeItem('experience', 'exemplo-exp-1'))
    expect(result.current.resume.experience.map((item) => item.id)).toEqual(['exemplo-exp-2'])
  })

  it('moveItem troca de posição e respeita o início e o fim da lista', () => {
    const { result } = openSaved()
    const order = () => result.current.resume.experience.map((item) => item.id)

    act(() => result.current.moveItem('experience', 'exemplo-exp-1', -1))
    act(() => result.current.moveItem('experience', 'exemplo-exp-2', 1))
    act(() => result.current.moveItem('experience', 'nao-existe', 1))
    expect(order()).toEqual(['exemplo-exp-1', 'exemplo-exp-2'])

    act(() => result.current.moveItem('experience', 'exemplo-exp-1', 1))
    expect(order()).toEqual(['exemplo-exp-2', 'exemplo-exp-1'])
  })

  it('replaceResume copia o conteúdo com ids novos em todas as listas', () => {
    const { result } = renderDraft()
    act(() => result.current.replaceResume(SAMPLE_RESUME))
    const { experience, education, certifications, courses, languages, personal } = result.current.resume
    expect(personal.name).toBe('Marina Albuquerque')
    expect(experience.map((item) => item.role)).toEqual(SAMPLE_RESUME.experience.map((item) => item.role))
    expect(courses.map((item) => item.name)).toEqual(SAMPLE_RESUME.courses.map((item) => item.name))
    for (const item of [...experience, ...education, ...certifications, ...courses, ...languages]) {
      expect(item.id).not.toMatch(/^exemplo-/)
    }
  })

  it.each(['certifications', 'courses', 'languages', 'projects'])(
    'addItem, updateItem, moveItem e removeItem funcionam em %s e são gravados',
    (section) => {
      const { result, record } = openSaved()
      const before = result.current.resume[section].length
      act(() => result.current.addItem(section))
      act(() => result.current.addItem(section))
      const [first, second] = result.current.resume[section].slice(before)
      const field = Object.keys(first).find((key) => key !== 'id')

      act(() => result.current.updateItem(section, second.id, field, 'Segundo'))
      act(() => result.current.moveItem(section, second.id, -1))
      wait()
      const saved = resumeStore.getResume(record.id).resume[section].slice(before)
      expect(saved.map((item) => item.id)).toEqual([second.id, first.id])
      expect(saved[0][field]).toBe('Segundo')

      act(() => result.current.removeItem(section, second.id))
      wait()
      expect(resumeStore.getResume(record.id).resume[section].slice(before).map((item) => item.id)).toEqual([
        first.id,
      ])
    },
  )

  it('addItem ignora seção desconhecida', () => {
    const { result } = openSaved()
    const before = result.current.resume
    act(() => result.current.addItem('inexistente'))
    expect(result.current.resume).toBe(before)
  })

  it('addSkills separa por vírgula, ignora vazios; removeSkill tira só a posição pedida', () => {
    const { result, record } = openSaved()
    act(() => result.current.addSkills('softSkills', ' Empatia, , Liderança '))
    act(() => result.current.addSkills('softSkills', '   '))
    act(() => result.current.addSkills('skills', 'SQL'))
    expect(result.current.resume.softSkills).toEqual([...SAMPLE_RESUME.softSkills, 'Empatia', 'Liderança'])

    act(() => result.current.removeSkill('skills', 0))
    wait()
    const saved = resumeStore.getResume(record.id).resume
    expect(saved.skills).toEqual([...SAMPLE_RESUME.skills.slice(1), 'SQL'])
    expect(saved.softSkills).toEqual([...SAMPLE_RESUME.softSkills, 'Empatia', 'Liderança'])
  })

  it('abre um currículo salvo no formato antigo sem perder dados e só o reescreve ao editar', () => {
    const old = {
      id: 'antigo',
      title: '',
      templateId: 'essencial',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      resume: {
        personal: { name: 'Ana', email: 'ana@email.com', location: 'Santarém, PA', photo: '', photoVisible: true },
        summary: 'Resumo antigo',
        experience: [{ id: 'e1', role: 'Analista', company: 'Empresa', start: '2020', end: 'Atual', description: '' }],
        education: [],
        skills: 'Excel, Atendimento',
      },
    }
    const raw = JSON.stringify(old)
    localStorage.setItem(`${RESUME_PREFIX}antigo`, raw)
    setItem.mockClear()

    const { result } = renderDraft('antigo')
    expect(result.current.resume.personal).toMatchObject({ name: 'Ana', city: 'Santarém', state: 'PA' })
    expect(result.current.resume.skills).toEqual(['Excel', 'Atendimento'])
    expect(result.current.resume.experience).toEqual(old.resume.experience)
    wait(5000)
    expect(localStorage.getItem(`${RESUME_PREFIX}antigo`)).toBe(raw)

    act(() => result.current.setField('objective', 'Novo objetivo'))
    wait()
    const saved = JSON.parse(localStorage.getItem(`${RESUME_PREFIX}antigo`))
    expect(saved.resume).toMatchObject({
      objective: 'Novo objetivo',
      summary: 'Resumo antigo',
      skills: ['Excel', 'Atendimento'],
      personal: { name: 'Ana', city: 'Santarém', state: 'PA' },
    })
  })

  it('resetDraft esvazia o conteúdo mas mantém o mesmo currículo e o título', () => {
    const { result, record } = openSaved()
    act(() => result.current.setTitle('Vaga no banco'))
    act(() => result.current.resetDraft())
    wait()
    expect(result.current).toMatchObject({ resumeId: record.id, title: 'Vaga no banco' })
    expect(result.current.resume.personal.name).toBe('')
    const saved = resumeStore.getResume(record.id)
    expect(saved.resume.experience).toHaveLength(1)
    expect(saved.resume.summary).toBe('')
    expect(resumeStore.listResumes()).toHaveLength(1)
  })
})

describe('várias abas: conflito entre versões', () => {
  // "Outra aba" grava o currículo direto no armazenamento, um instante depois (como o navegador faz).
  function otherTabSaves(id, change) {
    vi.advanceTimersByTime(5)
    const stored = resumeStore.getResume(id)
    const saved = resumeStore.saveResume({ ...stored, resume: change(stored.resume) })
    return saved
  }
  function otherTabDeletes(id) {
    vi.advanceTimersByTime(5)
    resumeStore.deleteResume(id)
  }
  // O evento que o navegador dispara nas outras abas quando o localStorage muda.
  function storageEvent(id) {
    act(() => window.dispatchEvent(new StorageEvent('storage', { key: RESUME_PREFIX + id })))
  }
  const named = (name) => (resume) => ({ ...resume, personal: { ...resume.personal, name } })
  const stored = (id) => resumeStore.getResume(id).resume

  function openTab() {
    const record = seed()
    return { record, ...renderDraft(record.id) }
  }

  it('sem nada pendente, adota a versão da outra aba; a edição seguinte soma, sem perder a de lá', () => {
    const { record, result } = openTab()
    otherTabSaves(record.id, named('Ana Souza Lima'))
    storageEvent(record.id)
    expect(result.current.resume.personal.name).toBe('Ana Souza Lima')
    expect(result.current).toMatchObject({ syncedFromOtherTab: true, conflict: null, saveStatus: 'saved' })

    act(() => result.current.setField('summary', 'Resumo desta aba'))
    wait()
    expect(stored(record.id)).toMatchObject({ summary: 'Resumo desta aba', personal: { name: 'Ana Souza Lima' } })
  })

  it('com alteração pendente, não sobrescreve: abre um conflito e para de gravar', () => {
    const { record, result } = openTab()
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    otherTabSaves(record.id, named('Ana Souza Lima'))
    storageEvent(record.id)
    expect(result.current.conflict).toEqual({ deleted: false, otherSavedAt: expect.any(String), recoverySaved: false })
    expect(result.current.saveStatus).toBe('conflict')

    wait(5000)
    expect(stored(record.id)).toMatchObject({ personal: { name: 'Ana Souza Lima' }, summary: SAMPLE_RESUME.summary })
  })

  it('confere antes de gravar mesmo sem o evento (aba congelada): não sobrescreve', () => {
    const { record, result } = openTab()
    otherTabSaves(record.id, named('Ana Souza Lima'))
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    wait()
    expect(result.current.conflict).not.toBeNull()
    expect(stored(record.id).personal.name).toBe('Ana Souza Lima')
    expect(stored(record.id).summary).toBe(SAMPLE_RESUME.summary)
  })

  it('"Manter as minhas" grava esta versão por cima e encerra o conflito', () => {
    const { record, result } = openTab()
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    otherTabSaves(record.id, named('Ana Souza Lima'))
    storageEvent(record.id)
    let ok
    act(() => {
      ok = result.current.keepMine()
    })
    expect(ok).toBe(true)
    expect(result.current).toMatchObject({ conflict: null, saveStatus: 'saved' })
    expect(stored(record.id)).toMatchObject({ summary: 'Resumo desta aba', personal: { name: 'Marina Albuquerque' } })
    // Depois disso, a gravação automática volta a funcionar normalmente.
    act(() => result.current.setField('objective', 'Objetivo'))
    wait()
    expect(stored(record.id).objective).toBe('Objetivo')
  })

  it('"Usar a outra versão" descarta as alterações daqui e mostra a de lá', () => {
    const { record, result } = openTab()
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    otherTabSaves(record.id, named('Ana Souza Lima'))
    storageEvent(record.id)
    act(() => result.current.acceptOther())
    expect(result.current.conflict).toBeNull()
    expect(result.current.resume).toMatchObject({ summary: SAMPLE_RESUME.summary, personal: { name: 'Ana Souza Lima' } })
    wait(5000)
    expect(stored(record.id).personal.name).toBe('Ana Souza Lima')
  })

  it('"Salvar as minhas como cópia" preserva as duas versões', () => {
    const { record, result } = openTab()
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    otherTabSaves(record.id, named('Ana Souza Lima'))
    storageEvent(record.id)
    let copyId
    act(() => {
      copyId = result.current.saveMineAsCopy()
    })
    expect(copyId).toEqual(expect.any(String))
    expect(copyId).not.toBe(record.id)
    expect(resumeStore.getResume(copyId)).toMatchObject({
      title: 'Marina Albuquerque · Analista de Dados (minha versão)',
      resume: { summary: 'Resumo desta aba' },
    })
    expect(stored(record.id).personal.name).toBe('Ana Souza Lima')
    expect(result.current.conflict).toBeNull()
  })

  it('excluído em outra aba com alterações aqui: "Salvar de novo" recria; descartar não recria', () => {
    const first = openTab()
    act(() => first.result.current.setField('summary', 'Resumo desta aba'))
    otherTabDeletes(first.record.id)
    storageEvent(first.record.id)
    expect(first.result.current.conflict).toEqual({ deleted: true, otherSavedAt: null, recoverySaved: false })
    act(() => {
      first.result.current.keepMine()
    })
    expect(stored(first.record.id).summary).toBe('Resumo desta aba')

    const second = openTab()
    act(() => second.result.current.setField('summary', 'Outro resumo'))
    otherTabDeletes(second.record.id)
    storageEvent(second.record.id)
    act(() => second.result.current.acceptOther())
    second.unmount()
    expect(resumeStore.getResume(second.record.id)).toBeNull()
  })

  it('sair sem escolher guarda as alterações daqui numa cópia (uma só), sem tocar na outra versão', () => {
    const { record, result, unmount } = openTab()
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    otherTabSaves(record.id, named('Ana Souza Lima'))
    storageEvent(record.id)
    act(() => window.dispatchEvent(new Event('pagehide')))
    unmount()
    const copies = resumeStore.listResumes().filter((item) => item.id !== record.id)
    expect(copies).toHaveLength(1)
    expect(copies[0].title).toMatch(/\(alterações não salvas\)$/)
    expect(resumeStore.getResume(copies[0].id).resume.summary).toBe('Resumo desta aba')
    expect(stored(record.id)).toMatchObject({ personal: { name: 'Ana Souza Lima' }, summary: SAMPLE_RESUME.summary })
  })

  it('"Manter as minhas" sem espaço: avisa a falha e o conflito continua (nada se perde)', () => {
    const { record, result } = openTab()
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    otherTabSaves(record.id, named('Ana Souza Lima'))
    storageEvent(record.id)
    failWrites()
    let ok
    act(() => {
      ok = result.current.keepMine()
    })
    expect(ok).toBe(false)
    expect(result.current.conflict).not.toBeNull()
    expect(result.current.storageAvailable).toBe(false)
    expect(result.current.resume.summary).toBe('Resumo desta aba')
  })

  it('evento de outro currículo é ignorado', () => {
    const { record, result } = openTab()
    const other = seed({ title: 'Outro' })
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    storageEvent(other.id)
    wait()
    expect(result.current.conflict).toBeNull()
    expect(stored(record.id).summary).toBe('Resumo desta aba')
  })

  it('aba oculta em conflito (o celular pode encerrá-la sem pagehide) já guarda a cópia de recuperação', () => {
    const { record, result } = openTab()
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    otherTabSaves(record.id, named('Ana Souza Lima'))
    storageEvent(record.id)
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden')
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    act(() => document.dispatchEvent(new Event('visibilitychange')))
    visibility.mockRestore()

    const copies = resumeStore.listResumes().filter((item) => item.id !== record.id)
    expect(copies).toHaveLength(1)
    expect(resumeStore.getResume(copies[0].id).resume.summary).toBe('Resumo desta aba')
    expect(result.current.conflict.recoverySaved).toBe(true)
    // Ao voltar, escolher resolve o conflito e a cópia de recuperação deixa de ser necessária.
    act(() => {
      result.current.keepMine()
    })
    expect(resumeStore.listResumes().map((item) => item.id)).toEqual([record.id])
  })

  it('"Usar a outra versão" mostra a versão gravada agora, mesmo que tenha chegado sem evento', () => {
    const { record, result } = openTab()
    act(() => result.current.setField('summary', 'Resumo desta aba'))
    otherTabSaves(record.id, named('Primeira da outra aba'))
    storageEvent(record.id)
    otherTabSaves(record.id, named('Segunda da outra aba'))
    act(() => result.current.acceptOther())
    expect(result.current.resume.personal.name).toBe('Segunda da outra aba')
    act(() => result.current.setField('objective', 'Objetivo'))
    wait()
    expect(result.current.conflict).toBeNull()
    expect(stored(record.id)).toMatchObject({ objective: 'Objetivo', personal: { name: 'Segunda da outra aba' } })
  })
})
