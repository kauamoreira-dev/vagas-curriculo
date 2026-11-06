import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// O jsdom não mede layout nem tem ResizeObserver (usado pela folha em escala): basta não quebrar.
if (typeof window !== 'undefined' && !window.ResizeObserver) {
  window.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Sem `globals`, a Testing Library não desmonta sozinha entre testes. Só há o que limpar no jsdom.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
