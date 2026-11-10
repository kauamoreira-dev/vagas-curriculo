import { useEffect, useRef, useState } from 'react'
import { useElementWidth } from '@/hooks/useElementWidth'
import { PAGE_HEIGHT, PAGE_WIDTH } from './constants'
import styles from './ScaledSheet.module.css'

/**
 * Exibe uma folha A4 em escala para caber na largura disponível.
 * `clip` fixa a altura em uma página (true) ou numa fração dela (ex.: 0.7);
 * sem ele, a moldura acompanha a altura do conteúdo.
 * `actualSize` mostra a folha sem reduzir (largura A4); quem chama cuida da rolagem horizontal.
 */
export function ScaledSheet({ children, clip = false, actualSize = false, className = '' }) {
  const frameRef = useRef(null)
  const sheetRef = useRef(null)
  const width = useElementWidth(frameRef)
  const [contentHeight, setContentHeight] = useState(PAGE_HEIGHT)

  useEffect(() => {
    const sheet = sheetRef.current
    if (!sheet || clip) return undefined
    const observer = new ResizeObserver(() => setContentHeight(sheet.offsetHeight))
    observer.observe(sheet)
    return () => observer.disconnect()
  }, [clip])

  const scale = actualSize ? 1 : width / PAGE_WIDTH
  const clipRatio = clip === true ? 1 : clip
  const height =
    (clipRatio ? PAGE_HEIGHT * clipRatio : Math.max(contentHeight, PAGE_HEIGHT)) * scale
  /*
   * Com recorte, a altura é só a proporção da folha: o CSS a reserva desde o primeiro quadro.
   * Sem recorte, até a largura ser medida, reserva uma página; depois acompanha o conteúdo.
   * Sem isso a moldura nascia com altura 0 e empurrava o que vem abaixo (layout shift).
   */
  const reserveRatio = Boolean(clipRatio) || (!width && !actualSize)
  const sizeStyle = reserveRatio ? { aspectRatio: `${PAGE_WIDTH} / ${PAGE_HEIGHT * (clipRatio || 1)}` } : { height }

  return (
    <div
      ref={frameRef}
      className={`${styles.frame} ${className}`}
      style={{ ...sizeStyle, ...(actualSize && { width: PAGE_WIDTH, minWidth: PAGE_WIDTH }) }}
    >
      <div
        ref={sheetRef}
        className={styles.sheet}
        style={{
          width: PAGE_WIDTH,
          transform: `scale(${scale})`,
          // Antes da primeira medição a escala seria 0; em tamanho real não há o que esperar.
          visibility: actualSize || width ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
