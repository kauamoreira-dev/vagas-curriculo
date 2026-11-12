import { useEffect, useState } from 'react'

const matches = (query) => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches)

/**
 * Se a media query vale agora, atualizado quando a janela muda de tamanho.
 * Sem `matchMedia` (jsdom nos testes), responde false: o layout de telas menores.
 */
export function useMediaQuery(query) {
  const [value, setValue] = useState(() => matches(query))

  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return undefined
    const update = () => setValue(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [query])

  return value
}
