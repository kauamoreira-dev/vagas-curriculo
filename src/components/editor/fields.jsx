import { useId, useLayoutEffect, useRef } from 'react'
import { normalizeLine, normalizeMultiline } from '@/utils/validation'
import styles from './fields.module.css'

const countDigits = (text) => text.replace(/\D/g, '').length

// Posição no texto formatado logo após o n-ésimo dígito (mantém o cursor no lugar ao aplicar a máscara).
function caretAfterDigits(text, digits) {
  if (digits === 0) return 0
  let seen = 0
  for (let index = 0; index < text.length; index++) {
    if (/\d/.test(text[index]) && ++seen === digits) return index + 1
  }
  return text.length
}

/**
 * Campo de texto do formulário.
 * - `error`: mensagem exibida abaixo do campo (quem chama decide quando mostrar).
 * - `mask`: função que formata o valor enquanto a pessoa digita (ex.: telefone).
 * - Ao sair do campo, espaços nas pontas e repetidos são removidos.
 */
export function TextField({
  label,
  value,
  onChange,
  onBlur,
  hint,
  error,
  required = false,
  mask,
  multiline = false,
  rows = 4,
  ...props
}) {
  const id = useId()
  const hintId = hint ? `${id}-dica` : undefined
  const errorId = error ? `${id}-erro` : undefined
  const Control = multiline ? 'textarea' : 'input'
  const controlRef = useRef(null)
  const pendingCaret = useRef(null)

  useLayoutEffect(() => {
    const control = controlRef.current
    if (pendingCaret.current === null || !control || document.activeElement !== control) return
    control.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  }, [value])

  function handleChange(event) {
    const raw = event.target.value
    if (!mask) {
      onChange(raw)
      return
    }
    const formatted = mask(raw)
    const control = event.target
    const caret = control.selectionStart ?? raw.length
    if (formatted === value) {
      // A máscara descartou o que foi digitado (ex.: dígito a mais): o valor não muda e não há
      // nova renderização, então o cursor volta para onde estava antes da tecla.
      const previous = Math.max(0, caret - (raw.length - value.length))
      requestAnimationFrame(() => control.setSelectionRange(previous, previous))
      return
    }
    pendingCaret.current = caretAfterDigits(formatted, countDigits(raw.slice(0, caret)))
    onChange(formatted)
  }

  function handleBlur(event) {
    const normalized = multiline ? normalizeMultiline(value) : normalizeLine(value)
    if (normalized !== value) onChange(normalized)
    onBlur?.(event)
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
        {required ? (
          <span className={styles.required} aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <Control
        ref={controlRef}
        id={id}
        className={styles.control}
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
        aria-invalid={error ? true : undefined}
        aria-required={required || undefined}
        rows={multiline ? rows : undefined}
        {...props}
      />
      {error ? (
        <p id={errorId} className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function FormSection({ id, title, description, children, action }) {
  return (
    <section className={styles.section} aria-labelledby={id}>
      <div className={styles.sectionHead}>
        <div>
          <h2 id={id} className={styles.sectionTitle}>
            {title}
          </h2>
          {description ? <p className={styles.sectionDescription}>{description}</p> : null}
        </div>
      </div>
      <div className={styles.sectionBody}>{children}</div>
      {action ? <div className={styles.sectionAction}>{action}</div> : null}
    </section>
  )
}

export function FieldRow({ children }) {
  return <div className={styles.row}>{children}</div>
}

export function RepeatableItem({ title, index, total, onMoveUp, onMoveDown, onRemove, children }) {
  return (
    <div className={styles.item}>
      <div className={styles.itemHead}>
        <h3 className={styles.itemTitle}>{title}</h3>
        <div className={styles.itemActions}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveUp}
            disabled={index === 0}
            aria-label={`Mover “${title}” para cima`}
            title="Mover para cima"
          >
            ↑
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label={`Mover “${title}” para baixo`}
            title="Mover para baixo"
          >
            ↓
          </button>
          <button
            type="button"
            className={`${styles.iconButton} ${styles.remove}`}
            onClick={onRemove}
            aria-label={`Remover “${title}”`}
          >
            Remover
          </button>
        </div>
      </div>
      <div className={styles.itemBody}>{children}</div>
    </div>
  )
}
