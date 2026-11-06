// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_RESUME } from '@/data/resume'
import { resumeStore } from '@/services/resumeStore'
import { Editor } from './Editor'

let confirm
let print
let scrollTo

function seed(resume = SAMPLE_RESUME, templateId = 'classico') {
  return resumeStore.saveResume({ ...resumeStore.newRecord({ templateId }), resume })
}

function renderEditor(path) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="editor/:id?" element={<Editor />} />
      </Routes>
    </MemoryRouter>,
  )
}

function openSeeded(personal = {}) {
  const record = seed({ ...SAMPLE_RESUME, personal: { ...SAMPLE_RESUME.personal, ...personal } })
  renderEditor(`/editor/${record.id}`)
  return record
}

const savePdfButton = () => screen.getByRole('button', { name: 'Salvar PDF' })
const printArea = () => document.body.querySelector('.print-only')

beforeEach(() => {
  localStorage.clear()
  confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
  print = vi.spyOn(window, 'print').mockImplementation(() => {})
  scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

// O jsdom não rola: simula a posição atual da página.
function scrolledTo(y) {
  vi.spyOn(window, 'scrollY', 'get').mockReturnValue(y)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Salvar PDF', () => {
  it('fica desabilitado enquanto o currículo está vazio', () => {
    renderEditor('/editor')
    expect(savePdfButton()).toBeDisabled()
  })

  it('sem pendências, imprime direto', () => {
    openSeeded()
    fireEvent.click(savePdfButton())
    expect(confirm).not.toHaveBeenCalled()
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('com pendências, avisa quantas são e imprime se a pessoa confirmar', () => {
    openSeeded({ email: 'marina@' })
    fireEvent.click(savePdfButton())
    expect(confirm).toHaveBeenCalledWith('Há 1 campo para revisar no currículo. Gerar o PDF mesmo assim?')
    expect(print).toHaveBeenCalledTimes(1)
    // As mensagens passam a aparecer mesmo nos campos ainda não visitados.
    expect(screen.getByRole('alert')).toHaveTextContent(/e-mail/i)
  })

  it('usa o plural quando há mais de uma pendência', () => {
    openSeeded({ name: '', email: 'marina@' })
    fireEvent.click(savePdfButton())
    expect(confirm).toHaveBeenCalledWith('Há 2 campos para revisar no currículo. Gerar o PDF mesmo assim?')
  })

  it('se a pessoa desistir, não imprime, volta ao formulário e foca o primeiro campo inválido', async () => {
    confirm.mockReturnValue(false)
    openSeeded({ email: 'marina@' })
    fireEvent.click(screen.getByRole('tab', { name: 'Visualizar' }))
    expect(screen.getByRole('tab', { name: 'Visualizar' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(savePdfButton())
    expect(print).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: 'Editar' })).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(screen.getByLabelText('E-mail')).toHaveFocus())
  })
})

describe('abas Editar e Visualizar', () => {
  it('cada aba volta para a posição em que a pessoa a deixou', () => {
    openSeeded()
    const tab = (name) => screen.getByRole('tab', { name })

    scrolledTo(900) // fundo do formulário
    fireEvent.click(tab('Visualizar'))
    expect(scrollTo).toHaveBeenLastCalledWith(0, 0) // a folha começa do topo

    scrolledTo(300)
    fireEvent.click(tab('Editar'))
    expect(scrollTo).toHaveBeenLastCalledWith(0, 900)

    fireEvent.click(tab('Visualizar'))
    expect(scrollTo).toHaveBeenLastCalledWith(0, 300)
  })

  it('tocar na aba já aberta não mexe na rolagem', () => {
    openSeeded()
    scrollTo.mockClear()
    scrolledTo(500)
    fireEvent.click(screen.getByRole('tab', { name: 'Editar' }))
    expect(scrollTo).not.toHaveBeenCalled()
  })

  it('marca a aba ativa no contêiner, para o CSS esconder o modelo na aba Editar', () => {
    const { container } = renderEditor(`/editor/${seed().id}`)
    const app = container.querySelector('[data-view]')
    expect(app).toHaveAttribute('data-view', 'form')
    fireEvent.click(screen.getByRole('tab', { name: 'Visualizar' }))
    expect(app).toHaveAttribute('data-view', 'preview')
  })
})

describe('área de impressão', () => {
  it('fica no body, fora do app, com o currículo no modelo escolhido', () => {
    const { container } = renderEditor(`/editor/${seed(SAMPLE_RESUME, 'moderno').id}`)
    const area = printArea()
    expect(area.parentElement).toBe(document.body)
    expect(container.contains(area)).toBe(false)
    expect(within(area).getByRole('heading', { level: 1 })).toHaveTextContent('Marina Albuquerque')
    // Ordem das seções do Moderno (habilidades na coluna lateral)
    const titles = within(area).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
    expect(titles[0]).toBe('Habilidades')
  })

  it('acompanha a troca de modelo e as edições', () => {
    openSeeded()
    fireEvent.click(screen.getByRole('radio', { name: 'Moderno' }))
    expect(screen.getByRole('radio', { name: 'Moderno' })).toHaveAttribute('aria-checked', 'true')
    expect(within(printArea()).getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Habilidades')

    fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Marina A. Souza' } })
    expect(within(printArea()).getByRole('heading', { level: 1 })).toHaveTextContent('Marina A. Souza')
  })

  it('é removida ao sair do editor', () => {
    const { unmount } = renderEditor(`/editor/${seed().id}`)
    expect(printArea()).not.toBeNull()
    unmount()
    expect(printArea()).toBeNull()
  })
})
