// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Header } from './Header'

function renderHeader() {
  return render(
    <MemoryRouter>
      <Header />
    </MemoryRouter>,
  )
}

// O fundo escurecido é decorativo (aria-hidden): fica atrás do menu aberto.
const scrimOf = (container) => container.querySelector('[aria-hidden="true"][class*="scrim"]')

describe('menu do celular', () => {
  it('Esc fecha o menu aberto e devolve o foco ao botão', () => {
    renderHeader()
    const button = screen.getByRole('button', { name: 'Menu' })
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Fechar' })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(button).toHaveAttribute('aria-expanded', 'false')
    expect(button).toHaveTextContent('Menu')
    expect(button).toHaveFocus()
  })

  it('o fundo escurecido só existe com o menu aberto e o fecha ao toque', () => {
    const { container } = renderHeader()
    expect(scrimOf(container)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
    fireEvent.click(scrimOf(container))
    expect(screen.getByRole('button', { name: 'Menu' })).toHaveAttribute('aria-expanded', 'false')
    expect(scrimOf(container)).toBeNull()
  })
})
