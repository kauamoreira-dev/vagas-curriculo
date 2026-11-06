// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

// Confere a infraestrutura: jsdom, Testing Library e os matchers do jest-dom.
describe('ambiente jsdom', () => {
  it('renderiza componentes e oferece localStorage', () => {
    render(<button type="button">Salvar PDF</button>)
    expect(screen.getByRole('button', { name: 'Salvar PDF' })).toBeInTheDocument()
    window.localStorage.setItem('chave', 'valor')
    expect(window.localStorage.getItem('chave')).toBe('valor')
  })
})
