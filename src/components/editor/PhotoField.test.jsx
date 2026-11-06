// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PHOTO_MAX_ZOOM } from '@/utils/image'
import { PhotoField } from './PhotoField'

// preparePhoto usa canvas, que o jsdom não tem; o resto de image.js é usado de verdade.
vi.mock('@/utils/image', async (importOriginal) => ({
  ...(await importOriginal()),
  preparePhoto: vi.fn(async () => 'data:image/jpeg;base64,RECORTADA'),
}))
const { preparePhoto } = await import('@/utils/image')

// O jsdom não decodifica imagens: esta Image "carrega" com as dimensões pedidas.
let imageSize
class FakeImage {
  set src(value) {
    this._src = value
    queueMicrotask(() => {
      if (!imageSize) return this.onerror?.()
      this.naturalWidth = imageSize.width
      this.naturalHeight = imageSize.height
      this.onload?.()
    })
  }
}

let onPhotoChange
let onVisibleChange

function renderField(props = {}) {
  return render(
    <PhotoField
      photo=""
      visible
      onPhotoChange={onPhotoChange}
      onVisibleChange={onVisibleChange}
      {...props}
    />,
  )
}

async function chooseFile(container, file = new File(['x'], 'foto.jpg', { type: 'image/jpeg' })) {
  const input = container.querySelector('input[type="file"]')
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } })
  })
}

const zoomSlider = () => screen.getByRole('slider', { name: 'Zoom' })

beforeEach(() => {
  imageSize = { width: 800, height: 600 }
  onPhotoChange = vi.fn()
  onVisibleChange = vi.fn()
  vi.stubGlobal('Image', FakeImage)
  URL.createObjectURL = vi.fn(() => 'blob:foto')
  URL.revokeObjectURL = vi.fn()
  preparePhoto.mockClear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PhotoField', () => {
  it('ao escolher a imagem, mostra o recorte, rola até ele e foca a área de recorte', async () => {
    const scrollIntoView = vi.spyOn(Element.prototype, 'scrollIntoView')
    const { container } = renderField()
    await chooseFile(container)

    const viewport = screen.getByRole('group', { name: 'Área de recorte da foto' })
    expect(viewport).toHaveFocus()
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', behavior: 'smooth' })
    // Sem medição de layout (jsdom), usa o tamanho máximo.
    expect(viewport).toHaveStyle({ width: '240px', height: '240px' })
  })

  it('recusa arquivo de tipo não aceito sem abrir o recorte', async () => {
    const { container } = renderField()
    await chooseFile(container, new File(['x'], 'foto.gif', { type: 'image/gif' }))
    expect(screen.getByRole('alert')).toHaveTextContent('JPG, PNG ou WebP')
    expect(screen.queryByRole('group', { name: 'Área de recorte da foto' })).toBeNull()
  })

  it('avisa quando a imagem não abre', async () => {
    imageSize = null
    const { container } = renderField()
    await chooseFile(container)
    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível abrir a imagem')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto')
  })

  it('os botões − e + mudam o zoom em passos e param nos limites', async () => {
    const { container } = renderField()
    await chooseFile(container)
    const minus = screen.getByRole('button', { name: 'Diminuir zoom' })
    const plus = screen.getByRole('button', { name: 'Aumentar zoom' })

    expect(zoomSlider()).toHaveValue('1')
    expect(minus).toBeDisabled()

    fireEvent.click(plus)
    expect(zoomSlider()).toHaveValue('1.25')
    expect(minus).toBeEnabled()

    for (let step = 0; step < 20; step++) fireEvent.click(plus)
    expect(zoomSlider()).toHaveValue(String(PHOTO_MAX_ZOOM))
    expect(plus).toBeDisabled()

    fireEvent.click(minus)
    expect(zoomSlider()).toHaveValue(String(PHOTO_MAX_ZOOM - 0.25))
  })

  it('o zoom amplia a imagem dentro da área de recorte', async () => {
    const { container } = renderField()
    await chooseFile(container)
    const image = () => screen.getByRole('group', { name: 'Área de recorte da foto' }).querySelector('img')

    // 800×600: o recorte é o quadrado de 600 px, mostrado em 240 px (escala 0,4).
    expect(image()).toHaveStyle({ width: '320px', height: '240px' })
    fireEvent.click(screen.getByRole('button', { name: 'Aumentar zoom' })) // zoom 1,25
    expect(image()).toHaveStyle({ width: '400px', height: '300px' })
  })

  it('as setas do teclado movem o recorte', async () => {
    const { container } = renderField()
    await chooseFile(container)
    const viewport = screen.getByRole('group', { name: 'Área de recorte da foto' })
    // Deslocamento horizontal da imagem (o jsdom abrevia "translate(x, 0px)" para "translate(x)").
    const offsetX = () => parseFloat(viewport.querySelector('img').style.transform.match(/-?[\d.]+/)[0])

    expect(offsetX()).toBe(-40) // centralizado: x = 100 px × 0,4
    fireEvent.keyDown(viewport, { key: 'ArrowRight' })
    expect(offsetX()).toBe(-50)
    fireEvent.keyDown(viewport, { key: 'ArrowRight', shiftKey: true })
    expect(offsetX()).toBe(-80) // limite: a imagem não sai da área
  })

  it('"Usar esta foto" envia o recorte escolhido e torna a foto visível', async () => {
    const { container } = renderField()
    await chooseFile(container)
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Usar esta foto' }))
    })

    expect(preparePhoto).toHaveBeenCalledWith(expect.any(File), { crop: { x: 100, y: 0, size: 600 } })
    expect(onPhotoChange).toHaveBeenCalledWith('data:image/jpeg;base64,RECORTADA')
    expect(onVisibleChange).toHaveBeenCalledWith(true)
    expect(screen.queryByRole('group', { name: 'Área de recorte da foto' })).toBeNull()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto')
  })

  it('Cancelar fecha o recorte sem mudar a foto', async () => {
    const { container } = renderField()
    await chooseFile(container)
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(screen.queryByRole('group', { name: 'Área de recorte da foto' })).toBeNull()
    expect(onPhotoChange).not.toHaveBeenCalled()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:foto')
  })
})
