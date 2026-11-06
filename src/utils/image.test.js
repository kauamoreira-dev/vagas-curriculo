import { describe, expect, it } from 'vitest'
import { PHOTO_MAX_FILE_BYTES, computeCrop, validatePhotoFile } from './image'

describe('validatePhotoFile', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('aceita %s', (type) => {
    expect(validatePhotoFile({ type, size: 1024 })).toBeNull()
  })

  it('exige um arquivo', () => {
    expect(validatePhotoFile(undefined)).toMatch('Escolha')
  })

  it.each(['image/gif', 'image/heic', 'application/pdf', ''])('rejeita o tipo %j', (type) => {
    expect(validatePhotoFile({ type, size: 1024 })).toMatch('JPG, PNG ou WebP')
  })

  it('rejeita arquivos acima do limite', () => {
    expect(validatePhotoFile({ type: 'image/jpeg', size: PHOTO_MAX_FILE_BYTES + 1 })).toMatch('10 MB')
    expect(validatePhotoFile({ type: 'image/jpeg', size: PHOTO_MAX_FILE_BYTES })).toBeNull()
  })
})

describe('computeCrop', () => {
  it('sem opções, usa o maior quadrado centralizado', () => {
    expect(computeCrop(3000, 2000)).toEqual({ x: 500, y: 0, size: 2000 })
    expect(computeCrop(800, 1200)).toEqual({ x: 0, y: 200, size: 800 })
  })

  it('o zoom reduz o quadrado mantendo o centro', () => {
    expect(computeCrop(1000, 1000, { zoom: 2 })).toEqual({ x: 250, y: 250, size: 500 })
  })

  it('mantém o recorte dentro da imagem', () => {
    expect(computeCrop(1000, 1000, { zoom: 2, centerX: 0, centerY: 2000 })).toEqual({
      x: 0,
      y: 500,
      size: 500,
    })
  })

  it('limita o zoom entre 1 e o máximo', () => {
    expect(computeCrop(900, 900, { zoom: 0.5 }).size).toBe(900)
    expect(computeCrop(900, 900, { zoom: 10 }).size).toBe(300)
  })
})
