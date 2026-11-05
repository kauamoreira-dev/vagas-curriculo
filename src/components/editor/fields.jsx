import { useId } from 'react'
import styles from './fields.module.css'

export function TextField({ label, value, onChange, hint, multiline = false, rows = 4, ...props }) {
  const id = useId()
  const hintId = hint ? `${id}-dica` : undefined
  const Control = multiline ? 'textarea' : 'input'

  return (
    <div className={styles.field}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <Control
        id={id}
        className={styles.control}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-describedby={hintId}
        rows={multiline ? rows : undefined}
        {...props}
      />
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
