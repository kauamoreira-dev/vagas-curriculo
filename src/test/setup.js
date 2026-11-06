import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'

// Sem `globals`, a Testing Library não desmonta sozinha entre testes. Só há o que limpar no jsdom.
afterEach(async () => {
  if (typeof document === 'undefined') return
  const { cleanup } = await import('@testing-library/react')
  cleanup()
})
