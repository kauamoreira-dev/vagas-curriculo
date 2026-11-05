import { useEffect, useState } from 'react'

// Largura atual de um elemento, atualizada quando o layout muda.
export function useElementWidth(ref) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}
