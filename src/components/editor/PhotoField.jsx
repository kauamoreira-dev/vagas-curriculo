import { useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import {
  PHOTO_ACCEPTED_TYPES,
  PHOTO_MAX_ZOOM,
  PhotoError,
  computeCrop,
  preparePhoto,
  validatePhotoFile,
} from '@/utils/image'
import styles from './PhotoField.module.css'

// Lado da área de recorte na tela, em px. Cabe no formulário mesmo em celulares de 320px.
const VIEWPORT = 240

function loadDimensions(url) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () =>
      reject(new PhotoError('Não foi possível abrir a imagem. O arquivo pode estar corrompido.'))
    image.src = url
  })
}

/**
 * Foto de perfil: envio, recorte quadrado (arrastar + zoom), exibir/ocultar e remover.
 * A foto final é um JPEG pequeno em base64, salvo junto com o rascunho.
 */
export function PhotoField({ photo, visible, onPhotoChange, onVisibleChange }) {
  const id = useId()
  const inputRef = useRef(null)
  const dragRef = useRef(null)
  const [draft, setDraft] = useState(null) // imagem em recorte: { file, url, width, height, zoom, centerX, centerY }
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Libera a URL temporária da imagem quando o recorte termina ou o componente sai da tela.
  const draftUrl = draft?.url
  useEffect(() => () => draftUrl && URL.revokeObjectURL(draftUrl), [draftUrl])

  async function chooseFile(event) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    const invalid = validatePhotoFile(file)
    if (invalid) {
      setError(invalid)
      return
    }
    const url = URL.createObjectURL(file)
    try {
      const { width, height } = await loadDimensions(url)
      setError('')
      setDraft({ file, url, width, height, zoom: 1, centerX: width / 2, centerY: height / 2 })
    } catch (failure) {
      URL.revokeObjectURL(url)
      setError(failure.message)
    }
  }

  const crop = draft ? computeCrop(draft.width, draft.height, draft) : null
  const scale = crop ? VIEWPORT / crop.size : 1

  // Move o centro do recorte, em pixels da tela; o recorte é mantido dentro da imagem.
  function pan(dx, dy, from = draft) {
    const next = computeCrop(from.width, from.height, {
      ...from,
      centerX: from.centerX - dx / scale,
      centerY: from.centerY - dy / scale,
    })
    setDraft({ ...from, centerX: next.x + next.size / 2, centerY: next.y + next.size / 2 })
  }

  function setZoom(zoom) {
    const next = computeCrop(draft.width, draft.height, { ...draft, zoom })
    setDraft({ ...draft, zoom, centerX: next.x + next.size / 2, centerY: next.y + next.size / 2 })
  }

  function startDrag(event) {
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { x: event.clientX, y: event.clientY, start: draft }
  }

  function drag(event) {
    const start = dragRef.current
    if (!start) return
    pan(event.clientX - start.x, event.clientY - start.y, start.start)
  }

  function endDrag() {
    dragRef.current = null
  }

  function panWithKeys(event) {
    const step = event.shiftKey ? 40 : 10
    const moves = {
      ArrowLeft: [step, 0],
      ArrowRight: [-step, 0],
      ArrowUp: [0, step],
      ArrowDown: [0, -step],
    }
    const move = moves[event.key]
    if (!move) return
    event.preventDefault()
    pan(...move)
  }

  async function applyCrop() {
    setBusy(true)
    try {
      onPhotoChange(await preparePhoto(draft.file, { crop }))
      onVisibleChange(true)
      setDraft(null)
      setError('')
    } catch (failure) {
      setError(
        failure instanceof PhotoError ? failure.message : 'Não foi possível salvar a foto. Tente outra imagem.',
      )
    } finally {
      setBusy(false)
    }
  }

  function removePhoto() {
    if (!window.confirm('Remover a foto do currículo?')) return
    onPhotoChange('')
    setError('')
  }

  return (
    <div className={styles.field} role="group" aria-labelledby={`${id}-rotulo`}>
      <span id={`${id}-rotulo`} className={styles.label}>
        Foto (opcional)
      </span>

      <div className={styles.current}>
        <div className={styles.preview} data-hidden={Boolean(photo) && !visible}>
          {photo ? <img src={photo} alt="Sua foto de perfil" /> : <span aria-hidden="true">Sem foto</span>}
        </div>
        <div className={styles.controls}>
          <div className={styles.buttons}>
            <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()} disabled={busy}>
              {photo ? 'Trocar foto' : 'Enviar foto'}
            </Button>
            {photo ? (
              <Button variant="ghost" size="sm" className={styles.remove} onClick={removePhoto} disabled={busy}>
                Remover
              </Button>
            ) : null}
          </div>
          {photo ? (
            <label className={styles.toggle}>
              <input
                type="checkbox"
                checked={visible}
                onChange={(event) => onVisibleChange(event.target.checked)}
              />
              Mostrar foto no currículo
            </label>
          ) : (
            <p className={styles.hint}>JPG, PNG ou WebP, até 10 MB. Fica salva só neste navegador.</p>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={PHOTO_ACCEPTED_TYPES.join(',')}
        onChange={chooseFile}
        hidden
      />

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      {draft ? (
        <div className={styles.cropper}>
          <p id={`${id}-recorte`} className={styles.hint}>
            Arraste a imagem (ou use as setas) para enquadrar o rosto.
          </p>
          <div
            className={styles.viewport}
            style={{ width: VIEWPORT, height: VIEWPORT }}
            tabIndex={0}
            role="group"
            aria-label="Área de recorte da foto"
            aria-describedby={`${id}-recorte`}
            onPointerDown={startDrag}
            onPointerMove={drag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onKeyDown={panWithKeys}
          >
            <img
              src={draft.url}
              alt=""
              draggable={false}
              style={{
                width: draft.width * scale,
                height: draft.height * scale,
                transform: `translate(${-crop.x * scale}px, ${-crop.y * scale}px)`,
              }}
            />
          </div>
          <label className={styles.zoom}>
            Zoom
            <input
              type="range"
              min={1}
              max={PHOTO_MAX_ZOOM}
              step={0.01}
              value={draft.zoom}
              onChange={(event) => setZoom(Number(event.target.value))}
            />
          </label>
          <div className={styles.buttons}>
            <Button size="sm" onClick={applyCrop} disabled={busy}>
              {busy ? 'Salvando…' : 'Usar esta foto'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setDraft(null)} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
