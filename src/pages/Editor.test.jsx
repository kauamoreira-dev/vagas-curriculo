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

describe('pré-visualização em tamanho real', () => {
  it('alterna entre ajustada à tela e tamanho real, com rolagem lateral só na folha', () => {
    const { container } = renderEditor(`/editor/${seed().id}`)
    const toggle = screen.getByRole('button', { name: 'Ver em tamanho real' })
    const scroller = container.querySelector('[data-actual-size]')
    const sheet = () => scroller.querySelector('[style*="scale"]')

    expect(toggle).toHaveAttribute('aria-pressed', 'false')
    expect(scroller).toHaveAttribute('data-actual-size', 'false')

    fireEvent.click(toggle)
    expect(toggle).toHaveAttribute('aria-pressed', 'true')
    expect(toggle).toHaveTextContent('Ajustar à tela')
    expect(scroller).toHaveAttribute('data-actual-size', 'true')
    expect(sheet()).toHaveStyle({ transform: 'scale(1)', visibility: 'visible' })
    expect(sheet().parentElement).toHaveStyle({ width: '794px' })

    fireEvent.click(toggle)
    expect(screen.getByRole('button', { name: 'Ver em tamanho real' })).toHaveAttribute('aria-pressed', 'false')
  })
})

describe('navegador de aplicativo', () => {
  const instagram =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 337.0.3.23.54'

  it('avisa para abrir no Chrome ou no Safari', () => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(instagram)
    openSeeded()
    expect(screen.getByRole('note')).toHaveTextContent('Abra no Chrome ou no Safari')
  })

  it('não mostra o aviso em navegador comum', () => {
    openSeeded()
    expect(screen.queryByRole('note')).toBeNull()
  })
})

describe('título da aba', () => {
  it('usa o nome do site e o restaura ao sair do editor', () => {
    const { unmount } = renderEditor(`/editor/${seed().id}`)
    expect(document.title).toBe('Editor · Currículo Tapajós')
    unmount()
    expect(document.title).toBe('Currículo Tapajós')
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

describe('grupos expansíveis', () => {
  const toggle = (name) => screen.getByRole('button', { name })

  it('seções de sempre começam abertas; as opcionais vazias, fechadas', () => {
    renderEditor('/editor')
    for (const name of ['Dados pessoais', 'Resumo', 'Experiência', 'Formação', 'Habilidades']) {
      expect(toggle(name)).toHaveAttribute('aria-expanded', 'true')
    }
    for (const name of ['Objetivo profissional', 'Cursos complementares', 'Certificações', 'Projetos', 'Idiomas']) {
      expect(toggle(name)).toHaveAttribute('aria-expanded', 'false')
    }
    expect(screen.queryByRole('button', { name: 'Adicionar certificação' })).toBeNull()
  })

  it('seção opcional com conteúdo já abre aberta; fechada, mostra quantos itens tem', () => {
    openSeeded()
    expect(toggle('Certificações')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(toggle('Certificações'))
    expect(toggle('Certificações')).toHaveAttribute('aria-expanded', 'false')
    expect(toggle('Certificações').closest('section')).toHaveTextContent('1 item')
    expect(screen.queryByRole('textbox', { name: /Nome da certificação/ })).toBeNull()
  })

  it('abrir, adicionar e preencher um item atualiza a prévia na hora', () => {
    renderEditor('/editor')
    fireEvent.click(toggle('Projetos'))
    expect(screen.getByText('Nenhum projeto adicionado.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Adicionar projeto' }))
    fireEvent.change(screen.getByLabelText(/Nome do projeto/), { target: { value: 'Horta comunitária' } })
    expect(within(printArea()).getByRole('heading', { level: 2, name: 'Projetos' })).toBeInTheDocument()
    expect(within(printArea()).getByText('Horta comunitária')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Remover “Horta comunitária”' }))
    expect(within(printArea()).queryByRole('heading', { level: 2, name: 'Projetos' })).toBeNull()
  })

  it('ao gerar o PDF com pendência num grupo fechado, abre o grupo e foca o campo', async () => {
    confirm.mockReturnValue(false)
    const resume = {
      ...SAMPLE_RESUME,
      courses: [{ id: 'k1', name: 'Excel', institution: '', hours: 'muitas', year: '' }],
    }
    renderEditor(`/editor/${seed(resume).id}`)
    fireEvent.click(toggle('Cursos complementares'))
    expect(toggle('Cursos complementares')).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(savePdfButton())
    expect(toggle('Cursos complementares')).toHaveAttribute('aria-expanded', 'true')
    expect(toggle('Cursos complementares').closest('section')).toHaveTextContent('Revisar')
    expect(screen.getByRole('alert')).toHaveTextContent('Informe só o número de horas')
    await waitFor(() => expect(screen.getByLabelText('Carga horária (horas)')).toHaveFocus())

    // Fechado de novo, uma nova tentativa volta a abri-lo.
    fireEvent.click(toggle('Cursos complementares'))
    fireEvent.click(savePdfButton())
    expect(toggle('Cursos complementares')).toHaveAttribute('aria-expanded', 'true')
  })
})

describe('habilidades', () => {
  it('adiciona com Enter ou botão, separa o que foi colado com vírgulas e remove uma a uma', () => {
    renderEditor('/editor')
    const input = screen.getByLabelText('Competências técnicas')
    fireEvent.change(input, { target: { value: 'Excel' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(input).toHaveValue('')

    fireEvent.change(input, { target: { value: 'SQL, Power BI' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Adicionar' })[0])
    const chips = () => within(screen.getByRole('list', { name: 'Competências técnicas' })).getAllByRole('listitem')
    expect(chips().map((chip) => chip.firstChild.textContent)).toEqual(['Excel', 'SQL', 'Power BI'])

    fireEvent.click(screen.getByRole('button', { name: 'Remover “SQL”' }))
    expect(chips().map((chip) => chip.firstChild.textContent)).toEqual(['Excel', 'Power BI'])
    expect(input).toHaveFocus()
    expect(within(printArea()).getByText('Power BI')).toBeInTheDocument()
  })

  it('o que ficou digitado não se perde ao sair do campo', () => {
    renderEditor('/editor')
    const input = screen.getByLabelText('Competências comportamentais')
    fireEvent.change(input, { target: { value: 'Empatia' } })
    fireEvent.blur(input)
    expect(within(screen.getByRole('list', { name: 'Competências comportamentais' })).getByText('Empatia')).toBeVisible()
  })
})

describe('endereço', () => {
  it('pede só cidade e estado; o endereço completo aparece quando escolhido', () => {
    openSeeded()
    expect(screen.getByLabelText('Cidade')).toHaveValue('Belém')
    expect(screen.getByLabelText('Estado')).toHaveValue('PA')
    expect(screen.queryByLabelText('Rua')).toBeNull()

    fireEvent.click(screen.getByRole('radio', { name: 'Endereço completo' }))
    fireEvent.change(screen.getByLabelText('Rua'), { target: { value: 'Rua das Flores' } })
    fireEvent.change(screen.getByLabelText('CEP'), { target: { value: '66010000' } })
    expect(screen.getByLabelText('CEP')).toHaveValue('66010-000')
    expect(within(printArea()).getByText('Rua das Flores – Belém, PA – CEP 66010-000')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Só cidade e estado' }))
    expect(within(printArea()).getByText('Belém, PA')).toBeInTheDocument()
  })

  it('CEP incompleto mostra mensagem ao sair do campo, mas não é obrigatório', () => {
    openSeeded()
    fireEvent.click(screen.getByRole('radio', { name: 'Endereço completo' }))
    const zip = screen.getByLabelText('CEP')
    fireEvent.change(zip, { target: { value: '6601' } })
    fireEvent.blur(zip)
    expect(screen.getByRole('alert')).toHaveTextContent('CEP incompleto')
    fireEvent.change(zip, { target: { value: '' } })
    expect(screen.queryByRole('alert')).toBeNull()
  })
})

describe('nome do arquivo PDF', () => {
  it('durante a impressão o título da página usa o nome da pessoa e depois volta', () => {
    print.mockImplementation(() => expect(document.title).toBe('Currículo - Marina Albuquerque'))
    openSeeded()
    fireEvent.click(savePdfButton())
    expect(print).toHaveBeenCalledTimes(1)
    window.dispatchEvent(new Event('afterprint'))
    expect(document.title).toBe('Editor · Currículo Tapajós')
  })
})
