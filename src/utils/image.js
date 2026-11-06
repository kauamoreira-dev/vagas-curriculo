// Preparo da foto de perfil: valida o arquivo, recorta um quadrado e reduz para caber no localStorage.

export const PHOTO_SIZE = 400
export const PHOTO_QUALITY = 0.8
export const PHOTO_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const PHOTO_MAX_FILE_BYTES = 10 * 1024 * 1024

// Mensagens já prontas para exibir à pessoa.
export class PhotoError extends Error {
  constructor(message) {
    super(message)
    this.name = 'PhotoError'
  }
}

export function validatePhotoFile(file) {
  if (!file) return 'Escolha uma imagem.'
  if (!PHOTO_ACCEPTED_TYPES.includes(file.type)) return 'Use uma imagem JPG, PNG ou WebP.'
  if (file.size > PHOTO_MAX_FILE_BYTES) return 'A imagem deve ter no máximo 10 MB.'
  return null
}

// Maior quadrado possível, centralizado na imagem.
export function getCenteredSquare(width, height) {
  const size = Math.min(width, height)
  return { x: (width - size) / 2, y: (height - size) / 2, size }
}

function readAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new PhotoError('Não foi possível ler o arquivo. Tente outra imagem.'))
    reader.readAsDataURL(file)
  })
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () =>
      reject(new PhotoError('Não foi possível abrir a imagem. O arquivo pode estar corrompido.'))
    image.src = src
  })
}

/**
 * Converte o arquivo enviado em uma foto quadrada JPEG (data URL), com até PHOTO_SIZE px de lado.
 * `crop` ({ x, y, size }, em pixels da imagem original) define o recorte; por padrão, o centro.
 * Imagens menores que PHOTO_SIZE não são ampliadas. Falhas viram `PhotoError`.
 */
export async function preparePhoto(file, { crop } = {}) {
  const invalid = validatePhotoFile(file)
  if (invalid) throw new PhotoError(invalid)

  const image = await loadImage(await readAsDataURL(file))
  const { naturalWidth: width, naturalHeight: height } = image
  if (!width || !height) throw new PhotoError('A imagem está vazia ou corrompida.')

  const area = crop ?? getCenteredSquare(width, height)
  const output = Math.round(Math.min(PHOTO_SIZE, area.size))
  const canvas = document.createElement('canvas')
  canvas.width = output
  canvas.height = output

  const context = canvas.getContext('2d')
  if (!context) throw new PhotoError('Seu navegador não conseguiu processar a imagem.')
  // JPEG não tem transparência: sem fundo branco, áreas transparentes de PNG ficariam pretas.
  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, output, output)
  context.imageSmoothingQuality = 'high'
  context.drawImage(image, area.x, area.y, area.size, area.size, 0, 0, output, output)

  return canvas.toDataURL('image/jpeg', PHOTO_QUALITY)
}
