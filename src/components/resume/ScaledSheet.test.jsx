// @vitest-environment jsdom
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ScaledSheet } from './ScaledSheet'

// O jsdom não mede layout: a largura fica 0, como no primeiro quadro de um navegador real.
const frameOf = (container) => container.firstElementChild

describe('ScaledSheet antes de medir a largura', () => {
  it('com recorte, reserva a proporção da folha (sem altura 0 que empurra o conteúdo abaixo)', () => {
    const { container } = render(
      <ScaledSheet clip={0.66}>
        <p>Folha</p>
      </ScaledSheet>,
    )
    const frame = frameOf(container)
    const [width, height] = frame.style.aspectRatio.split('/').map(Number)
    expect(width).toBe(794)
    expect(height).toBeCloseTo(1123 * 0.66, 2)
    expect(frame.style.height).toBe('')
  })

  it('recorte de uma página inteira usa a proporção A4', () => {
    const { container } = render(
      <ScaledSheet clip>
        <p>Folha</p>
      </ScaledSheet>,
    )
    expect(frameOf(container).style.aspectRatio).toBe('794 / 1123')
  })

  it('sem recorte, reserva uma página até medir; em tamanho real, usa a largura A4 sem esperar', () => {
    const { container, rerender } = render(
      <ScaledSheet>
        <p>Folha</p>
      </ScaledSheet>,
    )
    expect(frameOf(container).style.aspectRatio).toBe('794 / 1123')

    rerender(
      <ScaledSheet actualSize>
        <p>Folha</p>
      </ScaledSheet>,
    )
    expect(frameOf(container).style.aspectRatio).toBe('')
    expect(frameOf(container)).toHaveStyle({ height: '1123px', width: '794px' })
  })
})
