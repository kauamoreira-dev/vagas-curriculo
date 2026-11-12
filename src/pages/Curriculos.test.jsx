// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SAMPLE_RESUME } from '@/data/resume'
import { createBackup } from '@/services/backup'
import { resumeStore } from '@/services/resumeStore'
import { Curriculos } from './Curriculos'

function renderList() {
  return render(
    <MemoryRouter initialEntries={['/curriculos']}>
      <Curriculos />
    </MemoryRouter>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

describe('Meus currículos', () => {
  it('lista vazia: um único botão de criar (no cartão), mais o caminho para os modelos', () => {
    renderList()
    expect(screen.getByRole('button', { name: 'Criar meu primeiro currículo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Novo currículo' })).toBeNull()
    expect(screen.getByRole('link', { name: 'Ver os modelos' })).toHaveAttribute('href', '/modelos')
  })

  it('com currículos, o botão "Novo currículo" fica no topo', () => {
    resumeStore.saveResume({ ...resumeStore.newRecord(), resume: SAMPLE_RESUME })
    renderList()
    expect(screen.getByRole('button', { name: 'Novo currículo' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Criar meu primeiro currículo' })).toBeNull()
  })
})

describe('cópia de segurança', () => {
  const panel = () => screen.getByRole('region', { name: 'Cópia de segurança' })
  const message = () => within(panel()).getByRole('status')
  const fileInput = () => within(panel()).getByLabelText('Arquivo da cópia de segurança')
  const choose = (text, name = 'curriculos.json') =>
    fireEvent.change(fileInput(), { target: { files: [new File([text], name, { type: 'application/json' })] } })
  const titles = () => screen.queryAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('baixar gera um arquivo .json com todos os currículos, sem enviar nada', () => {
    resumeStore.saveResume({ ...resumeStore.newRecord(), resume: SAMPLE_RESUME })
    let blob
    vi.spyOn(URL, 'createObjectURL').mockImplementation((value) => {
      blob = value
      return 'blob:teste'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    renderList()
    fireEvent.click(within(panel()).getByRole('button', { name: 'Baixar cópia de segurança' }))
    expect(click).toHaveBeenCalledTimes(1)
    expect(blob.type).toBe('application/json')
    expect(message()).toHaveTextContent('Cópia com 1 currículo gerada. Confira se o arquivo foi salvo')
    return blob.text().then((text) => {
      const backup = JSON.parse(text)
      expect(backup).toMatchObject({ app: 'curriculo-tapajos', version: 1 })
      expect(backup.resumes[0].resume.personal.name).toBe('Marina Albuquerque')
    })
  })

  it('sem currículos, baixar fica desabilitado, mas restaurar está disponível', () => {
    renderList()
    expect(within(panel()).getByRole('button', { name: 'Baixar cópia de segurança' })).toBeDisabled()
    expect(within(panel()).getByRole('button', { name: 'Restaurar de um arquivo' })).toBeEnabled()
  })

  it('arquivo inválido: mensagem clara e nada muda', async () => {
    renderList()
    choose('{ isso não é json')
    await waitFor(() => expect(message()).toHaveTextContent('Não foi possível ler o arquivo'))
    choose(JSON.stringify({ outra: 'coisa' }))
    await waitFor(() => expect(message()).toHaveTextContent('não é uma cópia de segurança do Currículo Tapajós'))
    expect(resumeStore.listResumes()).toHaveLength(0)
  })

  it('mostra a prévia antes, restaura ao confirmar, e repetir não duplica', async () => {
    const backup = JSON.stringify(createBackup([{ ...resumeStore.newRecord(), resume: SAMPLE_RESUME, title: 'Vaga X' }]))
    renderList()
    choose(backup)
    const preview = await screen.findByRole('region', { name: 'Prévia da restauração' })
    expect(preview).toHaveTextContent('1 currículo novo para restaurar')
    expect(resumeStore.listResumes()).toHaveLength(0)

    fireEvent.click(within(preview).getByRole('button', { name: 'Restaurar' }))
    expect(message()).toHaveTextContent('1 currículo restaurado')
    expect(titles()).toContain('Vaga X')

    choose(backup)
    const again = await screen.findByRole('region', { name: 'Prévia da restauração' })
    expect(again).toHaveTextContent('1 já está aqui igual (será ignorado)')
    expect(again).toHaveTextContent('Todos os currículos deste arquivo já estão aqui')
    expect(within(again).queryByRole('button', { name: 'Restaurar' })).toBeNull()
    expect(resumeStore.listResumes()).toHaveLength(1)
  })

  it('versão diferente de um currículo daqui entra como cópia, sem substituir', async () => {
    const mine = resumeStore.saveResume({ ...resumeStore.newRecord(), resume: SAMPLE_RESUME, title: 'Daqui' })
    renderList()
    choose(JSON.stringify(createBackup([{ ...mine, title: 'Do arquivo', resume: { ...SAMPLE_RESUME, summary: 'Outro' } }])))
    const preview = await screen.findByRole('region', { name: 'Prévia da restauração' })
    expect(preview).toHaveTextContent('1 currículo diferente de um que você já tem: entra como cópia, sem substituir')
    fireEvent.click(within(preview).getByRole('button', { name: 'Restaurar' }))
    expect(resumeStore.getResume(mine.id).title).toBe('Daqui')
    expect(titles()).toEqual(expect.arrayContaining(['Daqui', 'Do arquivo (restaurado)']))
  })

  it('cancelar a prévia não grava nada', async () => {
    renderList()
    choose(JSON.stringify(createBackup([{ ...resumeStore.newRecord(), resume: SAMPLE_RESUME }])))
    const preview = await screen.findByRole('region', { name: 'Prévia da restauração' })
    fireEvent.click(within(preview).getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('region', { name: 'Prévia da restauração' })).toBeNull()
    expect(resumeStore.listResumes()).toHaveLength(0)
  })
})
