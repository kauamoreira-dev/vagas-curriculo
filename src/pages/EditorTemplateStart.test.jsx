// @vitest-environment jsdom
import { StrictMode } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_RESUME } from '@/data/resume'
import { RESUME_PREFIX, resumeStore } from '@/services/resumeStore'
import { Curriculos } from './Curriculos'
import { Editor } from './Editor'

// Mostra a URL atual, para conferir para onde a criação levou.
function CurrentPath() {
  const location = useLocation()
  return <span data-testid="path">{location.pathname + location.search}</span>
}

function renderAt(path, { strict = false } = {}) {
  const tree = (
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="editor/:id?" element={<Editor />} />
        <Route path="curriculos" element={<Curriculos />} />
      </Routes>
      <CurrentPath />
    </MemoryRouter>
  )
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree)
}

const stored = () =>
  Object.keys(localStorage)
    .filter((key) => key.startsWith(RESUME_PREFIX))
    .map((key) => JSON.parse(localStorage.getItem(key)))
const currentPath = () => screen.getByTestId('path').textContent
const checked = (name) => screen.getByRole('radio', { name }).getAttribute('aria-checked')

// Currículo já salvo, com conteúdo e no modelo Clássico.
function seedExisting() {
  return resumeStore.saveResume({ ...resumeStore.newRecord({ templateId: 'classico' }), resume: SAMPLE_RESUME })
}

beforeEach(() => {
  localStorage.clear()
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('escolher um modelo fora do editor (/editor?modelo=…)', () => {
  it('cria um currículo novo, vazio, com o modelo escolhido, e abre o editor nele', async () => {
    renderAt('/editor?modelo=moderno')
    await waitFor(() => expect(currentPath()).toMatch(/^\/editor\/[^/?]+$/))
    const [created] = stored()
    expect(stored()).toHaveLength(1)
    expect(created.templateId).toBe('moderno')
    expect(currentPath()).toBe(`/editor/${created.id}`)
    expect(checked('Moderno')).toBe('true')
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue('')
  })

  it('nunca altera um currículo existente: ele continua igual, byte a byte', async () => {
    const existing = seedExisting()
    const before = localStorage.getItem(RESUME_PREFIX + existing.id)

    renderAt('/editor?modelo=essencial')
    await waitFor(() => expect(currentPath()).not.toBe('/editor?modelo=essencial'))
    expect(localStorage.getItem(RESUME_PREFIX + existing.id)).toBe(before)
    const created = stored().find((record) => record.id !== existing.id)
    expect(created).toMatchObject({ templateId: 'essencial' })
    expect(currentPath()).toBe(`/editor/${created.id}`)
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue('')
  })

  it('no StrictMode (efeitos duplicados) cria um currículo só', async () => {
    renderAt('/editor?modelo=moderno', { strict: true })
    await waitFor(() => expect(currentPath()).toMatch(/^\/editor\/[^/?]+$/))
    expect(stored()).toHaveLength(1)
  })

  it('modelo desconhecido: nada é criado e o editor abre como antes (o mais recente)', () => {
    const existing = seedExisting()
    renderAt('/editor?modelo=inexistente')
    expect(stored()).toHaveLength(1)
    expect(screen.getByLabelText(/Nome completo/)).toHaveValue(existing.resume.personal.name)
    expect(resumeStore.getResume(existing.id).templateId).toBe('classico')
  })

  it('sem poder salvar, volta para "Meus currículos" com o aviso, sem abrir outro currículo', async () => {
    const existing = seedExisting()
    const before = localStorage.getItem(RESUME_PREFIX + existing.id)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Sem espaço', 'QuotaExceededError')
    })
    renderAt('/editor?modelo=moderno')
    await waitFor(() => expect(currentPath()).toBe('/curriculos'))
    expect(screen.getByText(/^Não foi possível salvar neste navegador/)).toHaveAttribute('role', 'status')
    expect(localStorage.getItem(RESUME_PREFIX + existing.id)).toBe(before)
  })
})

describe('trocar o modelo dentro do editor continua como antes', () => {
  it('num currículo aberto, a troca vale para ele e a URL mostra o modelo', () => {
    const existing = seedExisting()
    renderAt(`/editor/${existing.id}`)
    fireEvent.click(screen.getByRole('radio', { name: 'Essencial' }))
    expect(checked('Essencial')).toBe('true')
    expect(currentPath()).toBe(`/editor/${existing.id}?modelo=essencial`)
    expect(stored()).toHaveLength(1)
  })

  it('/editor/:id?modelo=… aplica o modelo àquele currículo (link do próprio editor)', () => {
    const existing = seedExisting()
    renderAt(`/editor/${existing.id}?modelo=moderno`)
    expect(checked('Moderno')).toBe('true')
    expect(stored()).toHaveLength(1)
  })

  it('num currículo novo ainda não salvo (/editor), trocar o modelo não cria outro currículo', async () => {
    renderAt('/editor')
    fireEvent.click(screen.getByRole('radio', { name: 'Moderno' }))
    // A troca é a primeira alteração: o currículo é gravado e a URL passa a ter o id dele.
    await waitFor(() => expect(stored()).toHaveLength(1))
    expect(stored()[0].templateId).toBe('moderno')
    await waitFor(() => expect(currentPath()).toBe(`/editor/${stored()[0].id}`))
  })
})
