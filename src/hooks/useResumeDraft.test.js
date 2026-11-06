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

  it('replaceResume copia o conteúdo com ids novos', () => {
    const { result } = renderDraft()
    act(() => result.current.replaceResume(SAMPLE_RESUME))
    const { experience, education, personal } = result.current.resume
    expect(personal.name).toBe('Marina Albuquerque')
    expect(experience.map((item) => item.role)).toEqual(SAMPLE_RESUME.experience.map((item) => item.role))
    for (const item of [...experience, ...education]) expect(item.id).not.toMatch(/^exemplo-/)
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
