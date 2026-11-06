/**
 * localStorage em memória para testes.
 * - `quota` (em caracteres de chave + valor) simula espaço esgotado.
 * - `unavailable` simula armazenamento bloqueado (modo privado, políticas): todo acesso lança erro.
 * `data` expõe o Map interno para inspeção.
 */
export function createMemoryStorage({ quota = Infinity, unavailable = false } = {}) {
  const data = new Map()
  const used = () => [...data].reduce((total, [key, value]) => total + key.length + value.length, 0)
  const guard = () => {
    if (unavailable) throw new DOMException('Acesso negado', 'SecurityError')
  }
  return {
    data,
    get length() {
      guard()
      return data.size
    },
    key(index) {
      guard()
      return [...data.keys()][index] ?? null
    },
    getItem(key) {
      guard()
      return data.has(key) ? data.get(key) : null
    },
    setItem(key, value) {
      guard()
      const previous = data.get(key)
      const next = used() - (previous ? key.length + previous.length : 0) + key.length + String(value).length
      if (next > quota) throw new DOMException('Sem espaço', 'QuotaExceededError')
      data.set(key, String(value))
    },
    removeItem(key) {
      guard()
      data.delete(key)
    },
    clear() {
      guard()
      data.clear()
    },
  }
}

// Faz `setItem` falhar (como se faltasse espaço) só para as chaves aceitas por `shouldFail`.
export function failWritesTo(storage, shouldFail) {
  const original = storage.setItem
  storage.setItem = (key, value) => {
    if (shouldFail(key)) throw new DOMException('Sem espaço', 'QuotaExceededError')
    original(key, value)
  }
}
