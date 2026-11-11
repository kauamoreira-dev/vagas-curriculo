// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

const summary = () => screen.queryByRole('region', { name: /para gerar o PDF|incompleto|Tudo certo/ })

describe('Salvar PDF', () => {
  it('fica desabilitado enquanto o currículo está vazio', () => {
    renderEditor('/editor')
    expect(savePdfButton()).toBeDisabled()
  })

  it('sem pendências, imprime direto, sem janela de confirmação', () => {
    openSeeded()
    fireEvent.click(savePdfButton())
    expect(confirm).not.toHaveBeenCalled()
    expect(print).toHaveBeenCalledTimes(1)
    expect(summary()).toBeNull()
  })

  it('com erro (dado inválido), não imprime: mostra o resumo e foca o campo', async () => {
    openSeeded({ email: 'marina@' })
    fireEvent.click(screen.getByRole('tab', { name: 'Visualizar' }))

    fireEvent.click(savePdfButton())
    expect(print).not.toHaveBeenCalled()
    expect(confirm).not.toHaveBeenCalled()
    expect(screen.getByRole('tab', { name: 'Editar' })).toHaveAttribute('aria-selected', 'true')
    expect(summary()).toHaveTextContent('Corrija 1 campo para gerar o PDF')
    // Erro não pode ser ignorado: não há "gerar mesmo assim".
    expect(within(summary()).queryByRole('button', { name: /Gerar PDF/ })).toBeNull()
    // As mensagens passam a aparecer mesmo nos campos ainda não visitados.
    expect(screen.getByRole('alert')).toHaveTextContent(/e-mail/i)
    await waitFor(() => expect(screen.getByLabelText('E-mail')).toHaveFocus())
  })

  it('usa o plural e lista cada erro com a seção; cada item leva ao campo', async () => {
    openSeeded({ name: '', email: 'marina@' })
    fireEvent.click(savePdfButton())
    expect(summary()).toHaveTextContent('Corrija 2 campos para gerar o PDF')
    const issues = within(summary()).getAllByRole('button', { name: /Dados pessoais/ })
    expect(issues.map((issue) => issue.textContent)).toEqual([
      'Dados pessoaisInforme seu nome completo.',
      expect.stringMatching(/^Dados pessoaisE-mail inválido/),
    ])
    fireEvent.click(issues[1])
    await waitFor(() => expect(screen.getByLabelText('E-mail')).toHaveFocus())
  })

  it('o resumo acompanha as correções e, sem pendências, oferece gerar o PDF', () => {
    openSeeded({ email: 'marina@' })
    fireEvent.click(savePdfButton())
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'marina@email.com' } })
    expect(summary()).toHaveTextContent('Tudo certo para gerar o PDF')
    fireEvent.click(within(summary()).getByRole('button', { name: 'Gerar PDF' }))
    expect(print).toHaveBeenCalledTimes(1)
    expect(summary()).toBeNull()
  })

  it('só com avisos (item opcional incompleto), permite gerar mesmo assim', async () => {
    const [job] = SAMPLE_RESUME.experience
    renderEditor(`/editor/${seed({ ...SAMPLE_RESUME, experience: [{ ...job, company: '' }] }).id}`)
    fireEvent.click(savePdfButton())
    expect(print).not.toHaveBeenCalled()
    expect(summary()).toHaveTextContent('1 item opcional está incompleto')
    expect(within(summary()).getByRole('button', { name: /Experiência · Analista de Dados Pleno/ })).toHaveTextContent(
      'Informe a empresa.',
    )
    // Aviso não marca o campo como inválido nem usa o tom de erro.
    const company = screen.getByLabelText(/^Empresa/)
    expect(company).not.toHaveAttribute('aria-invalid')
    expect(company).toHaveAttribute('data-tone', 'warning')
    await waitFor(() => expect(screen.getByRole('heading', { name: /incompleto/ })).toHaveFocus())

    fireEvent.click(within(summary()).getByRole('button', { name: 'Gerar PDF mesmo assim' }))
    expect(print).toHaveBeenCalledTimes(1)
  })

  it('com erro e aviso juntos, o erro bloqueia e o aviso aparece separado', () => {
    const [job] = SAMPLE_RESUME.experience
    const resume = { ...SAMPLE_RESUME, experience: [{ ...job, company: '' }] }
    renderEditor(`/editor/${seed({ ...resume, personal: { ...resume.personal, phone: '(91) 1234' } }).id}`)
    fireEvent.click(savePdfButton())
    expect(summary()).toHaveTextContent('Corrija 1 campo para gerar o PDF')
    expect(summary()).toHaveTextContent('Também há itens opcionais incompletos')
    expect(within(summary()).queryByRole('button', { name: /Gerar PDF/ })).toBeNull()
  })

  it('o resumo pode ser fechado', () => {
    openSeeded({ email: 'marina@' })
    fireEvent.click(savePdfButton())
    fireEvent.click(screen.getByRole('button', { name: 'Fechar resumo de pendências' }))
    expect(summary()).toBeNull()
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

describe('zoom da prévia', () => {
  it('alterna entre página inteira e tamanho real, com rolagem lateral só na folha', () => {
    const { container } = renderEditor(`/editor/${seed().id}`)
    const option = (name) => within(screen.getByRole('radiogroup', { name: 'Zoom da prévia' })).getByRole('radio', { name })
    const scroller = container.querySelector('[data-actual-size]')
    const sheet = () => scroller.querySelector('[style*="scale"]')

    expect(option('Página inteira')).toHaveAttribute('aria-checked', 'true')
    expect(scroller).toHaveAttribute('data-actual-size', 'false')

    fireEvent.click(option('Tamanho real'))
    expect(option('Tamanho real')).toHaveAttribute('aria-checked', 'true')
    expect(option('Página inteira')).toHaveAttribute('aria-checked', 'false')
    expect(scroller).toHaveAttribute('data-actual-size', 'true')
    expect(sheet()).toHaveStyle({ transform: 'scale(1)', visibility: 'visible' })
    expect(sheet().parentElement).toHaveStyle({ width: '794px' })

    // Setas do teclado também trocam o modo.
    fireEvent.keyDown(option('Tamanho real'), { key: 'ArrowLeft' })
    expect(option('Página inteira')).toHaveAttribute('aria-checked', 'true')
    expect(option('Página inteira')).toHaveFocus()
  })

  it('o modo escolhido continua ao voltar da aba Editar, e os dados e o modelo se mantêm', () => {
    openSeeded()
    fireEvent.click(screen.getByRole('tab', { name: 'Visualizar' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Tamanho real' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Moderno' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Editar' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Visualizar' }))
    expect(screen.getByRole('radio', { name: 'Tamanho real' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Moderno' })).toHaveAttribute('aria-checked', 'true')
    expect(within(printArea()).getByRole('heading', { level: 1 })).toHaveTextContent('Marina Albuquerque')
  })
})

describe('orientação para salvar o PDF', () => {
  const userAgent = (value) => vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(value)

  it.each([
    ['Android', 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0 Mobile Safari/537.36', '“Salvar como PDF”'],
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1', '“Salvar em Arquivos”'],
    ['computador', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0 Safari/537.36', 'como destino'],
  ])('%s: explica em uma linha onde salvar, sem prometer download direto', (_, ua, expected) => {
    userAgent(ua)
    openSeeded()
    const note = screen.getByText(/Para salvar:/)
    expect(note).toHaveTextContent(expected)
    expect(note.textContent).not.toMatch(/baixar|download/i)
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
  // O nome do grupo inclui o selo de nível (ex.: "Certificações Opcional").
  const toggle = (name) =>
    screen.getByRole('button', { name: new RegExp(`^${name} (Obrigatório|Recomendado|Opcional)$`) })

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
    const resume = {
      ...SAMPLE_RESUME,
      courses: [{ id: 'k1', name: 'Excel', institution: '', hours: 'muitas', year: '' }],
    }
    renderEditor(`/editor/${seed(resume).id}`)
    fireEvent.click(toggle('Cursos complementares'))
    expect(toggle('Cursos complementares')).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(savePdfButton())
    expect(toggle('Cursos complementares')).toHaveAttribute('aria-expanded', 'true')
    expect(toggle('Cursos complementares').closest('section')).toHaveTextContent('Corrigir')
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

describe('indicador de salvamento', () => {
  const status = () => screen.getByText(/^(Salvo|Salvando) neste navegador|^Ainda não salvo/)

  it('currículo novo: avisa que ainda não salvou; depois de editar, "Salvando…" e então o horário', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    try {
      renderEditor('/editor')
      expect(status()).toHaveTextContent('Ainda não salvo')
      fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana' } })
      expect(status()).toHaveTextContent('Salvando neste navegador…')
      act(() => vi.advanceTimersByTime(400))
      expect(status()).toHaveTextContent(/^Salvo neste navegador às \d{2}:\d{2}$/)
    } finally {
      vi.useRealTimers()
    }
  })

  it('não fala em nuvem nem em sincronização', () => {
    openSeeded()
    expect(status()).toHaveTextContent(/^Salvo neste navegador/)
    expect(document.body.textContent).not.toMatch(/nuvem|sincroniz/i)
  })

  it('falha ao gravar: alerta com "Tentar de novo", que grava quando o armazenamento volta', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const original = Storage.prototype.setItem
    const record = openSeeded()
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Sem espaço', 'QuotaExceededError')
    })
    try {
      fireEvent.change(screen.getByLabelText(/Nome completo/), { target: { value: 'Ana' } })
      act(() => vi.advanceTimersByTime(400))
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar neste navegador')

      setItem.mockImplementation(function (key, value) {
        return original.call(this, key, value)
      })
      fireEvent.click(screen.getByRole('button', { name: 'Tentar de novo' }))
      expect(screen.queryByRole('alert')).toBeNull()
      expect(status()).toHaveTextContent(/^Salvo neste navegador/)
      expect(resumeStore.getResume(record.id).resume.personal.name).toBe('Ana')
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('índice de seções', () => {
  const index = () => screen.getByRole('navigation', { name: 'Seções do currículo' })

  it('mostra quantas seções têm conteúdo e o estado de cada uma', () => {
    openSeeded()
    expect(screen.getByText('8 de 11 preenchidas')).toBeInTheDocument()
    expect(within(index()).getByRole('button', { name: /^Projetos/ })).toHaveTextContent('Vazia')
    expect(within(index()).getByRole('button', { name: /^Experiência/ })).toHaveTextContent('Preenchida')
  })

  it('o estado de cada seção faz parte do nome acessível; a barra acompanha a contagem', () => {
    openSeeded()
    expect(within(index()).getByRole('button', { name: 'Projetos Vazia' })).toBeInTheDocument()
    expect(within(index()).getByRole('button', { name: 'Resumo Preenchida' })).toBeInTheDocument()
    const fill = document.querySelector('summary [aria-hidden="true"] > span')
    expect(parseFloat(fill.style.width)).toBeCloseTo((8 / 11) * 100, 2)
  })

  it('seção vazia com erro não conta como preenchida e aparece como "Corrigir" após tentar o PDF', () => {
    const empty = { ...SAMPLE_RESUME.personal, name: '', title: '', email: '', phone: '', city: '', state: '', link: '' }
    renderEditor(`/editor/${seed({ ...SAMPLE_RESUME, personal: empty }).id}`)
    expect(screen.getByText('7 de 11 preenchidas')).toBeInTheDocument()
    fireEvent.click(savePdfButton())
    expect(within(index()).getByRole('button', { name: /^Dados pessoais/ })).toHaveTextContent('Corrigir')
    expect(screen.getByText('7 de 11 preenchidas')).toBeInTheDocument()
  })

  it('leva até uma seção fechada, abrindo-a e focando o título', async () => {
    renderEditor('/editor')
    const groupToggle = () => screen.getByRole('button', { name: 'Idiomas Opcional' })
    expect(groupToggle()).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(within(index()).getByRole('button', { name: /^Idiomas/ }))
    expect(groupToggle()).toHaveAttribute('aria-expanded', 'true')
    await waitFor(() => expect(groupToggle()).toHaveFocus())
  })
})

describe('remover e desfazer', () => {
  it('mostra "Desfazer" com o foco nele; desfazer devolve o item à posição e com os dados', async () => {
    openSeeded()
    const roles = () => screen.getAllByRole('textbox', { name: 'Cargo' }).map((field) => field.value)
    expect(roles()).toEqual(['Analista de Dados Pleno', 'Assistente de Planejamento'])

    fireEvent.click(screen.getByRole('button', { name: 'Remover “Analista de Dados Pleno”' }))
    expect(roles()).toEqual(['Assistente de Planejamento'])
    expect(screen.getByRole('status')).toHaveTextContent('Removido: Analista de Dados Pleno')
    await waitFor(() => expect(screen.getByRole('button', { name: 'Desfazer' })).toHaveFocus())

    // Outra edição antes de desfazer continua valendo.
    fireEvent.change(screen.getByRole('textbox', { name: 'Resumo profissional' }), { target: { value: 'Novo' } })
    fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }))
    expect(roles()).toEqual(['Analista de Dados Pleno', 'Assistente de Planejamento'])
    expect(screen.getAllByRole('textbox', { name: 'Empresa' })[0]).toHaveValue('Cooperativa Rio Claro')
    expect(screen.getByRole('textbox', { name: 'Resumo profissional' })).toHaveValue('Novo')
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
    await waitFor(() => expect(screen.getAllByRole('textbox', { name: 'Cargo' })[0]).toHaveFocus())
  })

  it('o aviso pode ser fechado sem desfazer', () => {
    openSeeded()
    fireEvent.click(screen.getByRole('button', { name: 'Remover “Assistente de Planejamento”' }))
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso de remoção' }))
    expect(screen.queryByRole('button', { name: 'Desfazer' })).toBeNull()
    expect(screen.getAllByRole('textbox', { name: 'Cargo' })).toHaveLength(1)
  })
})

describe('teclado', () => {
  it('setas alternam as abas Editar e Visualizar, ligadas aos seus painéis', () => {
    openSeeded()
    const editTab = screen.getByRole('tab', { name: 'Editar' })
    expect(editTab).toHaveAttribute('aria-controls', 'painel-editar')
    expect(document.getElementById('painel-editar')).toHaveAttribute('role', 'tabpanel')
    editTab.focus()
    fireEvent.keyDown(editTab, { key: 'ArrowRight' })
    const previewTab = screen.getByRole('tab', { name: 'Visualizar' })
    expect(previewTab).toHaveAttribute('aria-selected', 'true')
    expect(previewTab).toHaveFocus()
    expect(previewTab).toHaveAttribute('tabindex', '0')
    expect(editTab).toHaveAttribute('tabindex', '-1')
  })

  it('setas trocam o modelo, mantendo os dados na prévia', () => {
    openSeeded()
    const classic = screen.getByRole('radio', { name: 'Clássico' })
    classic.focus()
    fireEvent.keyDown(classic, { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Moderno' })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('radio', { name: 'Moderno' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Moderno' }), { key: 'End' })
    expect(screen.getByRole('radio', { name: 'Essencial' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.keyDown(screen.getByRole('radio', { name: 'Essencial' }), { key: 'ArrowRight' })
    expect(screen.getByRole('radio', { name: 'Clássico' })).toHaveAttribute('aria-checked', 'true')
    expect(within(printArea()).getByRole('heading', { level: 1 })).toHaveTextContent('Marina Albuquerque')
  })
})

describe('ajustes deste currículo', () => {
  it('o nome na lista fica no fim do formulário e continua sendo salvo', () => {
    const record = openSeeded()
    const settings = screen.getByRole('region', { name: 'Ajustes deste currículo' })
    fireEvent.change(within(settings).getByLabelText('Nome deste currículo'), { target: { value: 'Vaga X' } })
    expect(within(settings).getByLabelText('Nome deste currículo')).toHaveValue('Vaga X')
    return waitFor(() => expect(resumeStore.getResume(record.id).title).toBe('Vaga X'))
  })
})

describe('data de nascimento', () => {
  it('mostra a idade na prévia; a caixa "Mostrar idade" aparece com a data e a oculta', () => {
    openSeeded()
    expect(screen.queryByRole('checkbox', { name: 'Mostrar idade no currículo' })).toBeNull()
    fireEvent.change(screen.getByLabelText('Data de nascimento'), { target: { value: '1990-01-15' } })
    const age = `${new Date().getFullYear() - 1990 - (new Date() < new Date(new Date().getFullYear(), 0, 15) ? 1 : 0)} anos`
    expect(within(printArea()).getByText(age)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('checkbox', { name: 'Mostrar idade no currículo' }))
    expect(within(printArea()).queryByText(age)).toBeNull()
    expect(screen.getByLabelText('Data de nascimento')).toHaveValue('1990-01-15')
  })

  it('data no futuro mostra erro ao sair do campo e impede o PDF', () => {
    openSeeded()
    const field = screen.getByLabelText('Data de nascimento')
    fireEvent.change(field, { target: { value: '2999-01-01' } })
    fireEvent.blur(field)
    expect(screen.getByRole('alert')).toHaveTextContent('não pode estar no futuro')
    fireEvent.click(savePdfButton())
    expect(print).not.toHaveBeenCalled()
    expect(screen.getByRole('region', { name: /Corrija 1 campo/ })).toBeInTheDocument()
  })
})

describe('teclado dos campos', () => {
  it('LinkedIn ou site abre o teclado de endereço web; Número aceita letras (ex.: S/N)', () => {
    openSeeded()
    const link = screen.getByLabelText('LinkedIn ou site')
    expect(link).toHaveAttribute('type', 'url')
    expect(link).toHaveAttribute('inputmode', 'url')
    expect(link).toHaveAttribute('autocomplete', 'url')

    fireEvent.click(screen.getByRole('radio', { name: 'Endereço completo' }))
    const number = screen.getByLabelText('Número')
    expect(number).not.toHaveAttribute('inputmode')
    fireEvent.change(number, { target: { value: 'S/N' } })
    expect(number).toHaveValue('S/N')
  })
})
