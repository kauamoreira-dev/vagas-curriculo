import { useEffect, useRef, useState } from 'react'
import { useElementWidth } from '@/hooks/useElementWidth'
import { PAGE_HEIGHT, PAGE_WIDTH } from './constants'
import styles from './ScaledSheet.module.css'

/**
 * Exibe uma folha A4 em escala para caber na largura disponível.
 * `clip` fixa a altura em uma página (true) ou numa fração dela (ex.: 0.7);
 * sem ele, a moldura acompanha a altura do conteúdo.
 */
export function ScaledSheet({ children, clip = false, className = '' }) {
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

  const scale = width / PAGE_WIDTH
  const clipRatio = clip === true ? 1 : clip
  const height =
    (clipRatio ? PAGE_HEIGHT * clipRatio : Math.max(contentHeight, PAGE_HEIGHT)) * scale

  return (
    <div ref={frameRef} className={`${styles.frame} ${className}`} style={{ height }}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        style={{
          width: PAGE_WIDTH,
          transform: `scale(${scale})`,
          visibility: width ? 'visible' : 'hidden',
        }}
      >
        {children}
      </div>
    </div>
  )
}
