import { useId, useLayoutEffect, useRef, useState } from 'react'
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
 * - `tone`: 'error' (padrão; o campo fica inválido) ou 'warning' (aviso que pode ser ignorado).
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
  tone = 'error',
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
        aria-invalid={error && tone === 'error' ? true : undefined}
        data-tone={error ? tone : undefined}
        aria-required={required || undefined}
        rows={multiline ? rows : undefined}
        {...props}
      />
      {error ? (
        <p
          id={errorId}
          className={tone === 'warning' ? styles.warning : styles.error}
          role={tone === 'warning' ? undefined : 'alert'}
        >
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

/**
 * Seção do formulário. Com `onToggle`, vira um grupo expansível: o título é o botão que abre e
 * fecha, e `status` (ex.: "2 itens", "Corrigir") aparece ao lado dele mesmo com o grupo fechado.
 * `statusTone`: 'error' ou 'warning' destaca o status. `badge`: nível da seção (ex.: "Opcional").
 */
export function FormSection({
  id,
  title,
  description,
  children,
  action,
  open = true,
  onToggle,
  status,
  statusTone,
  badge,
  notice,
}) {
  const bodyId = `${id}-conteudo`
  const collapsible = Boolean(onToggle)
  return (
    <section className={styles.section} aria-labelledby={id} data-open={open}>
      <div className={styles.sectionHead}>
        <div className={styles.sectionHeading}>
          <h2 id={id} className={styles.sectionTitle}>
            {collapsible ? (
              <button
                type="button"
                className={styles.sectionToggle}
                aria-expanded={open}
                aria-controls={bodyId}
                onClick={onToggle}
              >
                <span>{title}</span>
                {/* Espaço entre título e selo: o nome do botão fica "Idiomas Opcional", não "IdiomasOpcional" */}
                {badge ? <> <span className={styles.badge}>{badge}</span></> : null}
                <span className={styles.chevron} aria-hidden="true" />
              </button>
            ) : (
              title
            )}
          </h2>
          {status ? (
            <span className={styles.sectionStatus} data-tone={statusTone}>
              {status}
            </span>
          ) : null}
        </div>
        {description && open ? <p className={styles.sectionDescription}>{description}</p> : null}
      </div>
      <div id={bodyId} className={styles.sectionContent} hidden={!open}>
        {notice}
        <div className={styles.sectionBody}>{children}</div>
        {action ? <div className={styles.sectionAction}>{action}</div> : null}
      </div>
    </section>
  )
}

export function SelectField({ label, value, onChange, options, placeholder = 'Selecione', hint, ...props }) {
  const id = useId()
  const hintId = hint ? `${id}-dica` : undefined
  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <select
        id={id}
        className={`${styles.control} ${styles.select}`}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hintId}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

// Grupo de opções exclusivas (radio), como botões lado a lado.
export function ChoiceField({ legend, value, onChange, options }) {
  const name = useId()
  return (
    <fieldset className={styles.choices}>
      <legend className={styles.label}>{legend}</legend>
      <div className={styles.choiceList}>
        {options.map((option) => (
          <label key={option.value} className={styles.choice}>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

/**
 * Lista de itens curtos (habilidades) editada um a um: digita e confirma com Enter, vírgula,
 * o botão Adicionar ou saindo do campo. Cada item vira um chip com botão para remover.
 */
export function TagField({ label, items, onAdd, onRemove, placeholder, hint }) {
  const id = useId()
  const hintId = `${id}-dica`
  const [draft, setDraft] = useState('')
  const inputRef = useRef(null)

  function commit() {
    if (!draft.trim()) return
    onAdd(draft)
    setDraft('')
  }

  function handleKeyDown(event) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    }
  }

  function remove(index) {
    onRemove(index)
    inputRef.current?.focus()
  }

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {items.length ? (
        <ul className={styles.tags} aria-label={label}>
          {items.map((item, index) => (
            // Pela posição: a pessoa pode repetir um item, e o texto não serve de chave
            <li key={index} className={styles.tag}>
              <span>{item}</span>
              <button
                type="button"
                className={styles.tagRemove}
                onClick={() => remove(index)}
                aria-label={`Remover “${item}”`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <div className={styles.tagInput}>
        <input
          ref={inputRef}
          id={id}
          className={styles.control}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commit}
          placeholder={placeholder}
          aria-describedby={hintId}
          enterKeyHint="done"
        />
        <button type="button" className={styles.tagAdd} onClick={commit} disabled={!draft.trim()}>
          Adicionar
        </button>
      </div>
      <p id={hintId} className={styles.hint}>
        {hint}
      </p>
    </div>
  )
}

export function SubGroup({ title, children }) {
  return (
    <div className={styles.subGroup}>
      <h3 className={styles.subGroupTitle}>{title}</h3>
      {children}
    </div>
  )
}

export function FieldRow({ children }) {
  return <div className={styles.row}>{children}</div>
}

function Chevron({ direction }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      <path
        d={direction === 'up' ? 'M3.5 10 8 5.5l4.5 4.5' : 'M3.5 6 8 10.5 12.5 6'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
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
            <Chevron direction="up" />
          </button>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onMoveDown}
            disabled={index === total - 1}
            aria-label={`Mover “${title}” para baixo`}
            title="Mover para baixo"
          >
            <Chevron direction="down" />
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
