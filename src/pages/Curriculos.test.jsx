// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { SAMPLE_RESUME } from '@/data/resume'
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
