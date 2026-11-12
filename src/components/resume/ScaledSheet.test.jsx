// @vitest-environment jsdom
import { act, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
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

describe('onScaleChange', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  // ResizeObserver que entrega a largura quando o teste quiser, como o navegador depois do 1º quadro.
  function stubResizeObserver() {
    const observers = []
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback) {
          this.callback = callback
          observers.push(this)
        }
        observe(element) {
          this.element = element
        }
        disconnect() {}
      },
    )
    return (width) => {
      for (const observer of observers) observer.callback([{ contentRect: { width }, target: observer.element }])
    }
  }

  it('avisa a escala 0 antes da medida e a escala real quando a largura chega', () => {
    const deliverWidth = stubResizeObserver()
    const onScaleChange = vi.fn()
    render(
      <ScaledSheet onScaleChange={onScaleChange}>
        <p>Folha</p>
      </ScaledSheet>,
    )
    expect(onScaleChange).toHaveBeenLastCalledWith(0)

    // Quem mede a folha (a estimativa de páginas) precisa saber que agora há o que medir.
    act(() => deliverWidth(397))
    expect(onScaleChange).toHaveBeenLastCalledWith(0.5)
  })

  it('em tamanho real, a escala é 1 desde o início', () => {
    stubResizeObserver()
    const onScaleChange = vi.fn()
    render(
      <ScaledSheet actualSize onScaleChange={onScaleChange}>
        <p>Folha</p>
      </ScaledSheet>,
    )
    expect(onScaleChange).toHaveBeenLastCalledWith(1)
  })
})
