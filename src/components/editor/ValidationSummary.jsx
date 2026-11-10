import styles from './ValidationSummary.module.css'

export const SUMMARY_HEADING_ID = 'resumo-pendencias-titulo'

const plural = (count, singular, many) => (count === 1 ? `1 ${singular}` : `${count} ${many}`)

function IssueList({ keys, describe, onGo, tone }) {
  return (
    <ul className={styles.list}>
      {keys.map((key) => {
        const { where, message } = describe(key)
        return (
          <li key={key}>
            <button type="button" className={styles.issue} data-tone={tone} onClick={() => onGo(key)}>
              <span className={styles.where}>{where}</span>
              <span className={styles.message}>{message}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * Resumo das pendências ao tentar gerar o PDF, no topo do formulário (sem janela modal).
 * - `blocking`: erros (obrigatórios ou dados inválidos). Enquanto houver, o PDF não é gerado.
 * - `warnings`: avisos de itens opcionais incompletos; o PDF pode ser gerado mesmo assim.
 * Cada pendência leva ao campo. A lista acompanha as correções; sem pendências, oferece o PDF.
 */
export function ValidationSummary({ blocking, warnings, describe, onGo, onPrint, onClose }) {
  const clean = blocking.length === 0 && warnings.length === 0
  const heading = blocking.length
    ? `Corrija ${plural(blocking.length, 'campo', 'campos')} para gerar o PDF`
    : warnings.length
      ? `${plural(warnings.length, 'item opcional está incompleto', 'itens opcionais estão incompletos')}`
      : 'Tudo certo para gerar o PDF'

  return (
    <section
      className={styles.summary}
      data-tone={blocking.length ? 'error' : warnings.length ? 'warning' : 'ok'}
      aria-labelledby={SUMMARY_HEADING_ID}
    >
      <div className={styles.head}>
        <h2 id={SUMMARY_HEADING_ID} className={styles.heading} tabIndex={-1}>
          {heading}
        </h2>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Fechar resumo de pendências">
          ×
        </button>
      </div>

      {blocking.length ? (
        <>
          <p className={styles.text}>Campos obrigatórios ou com formato inválido. Toque em cada um para corrigir.</p>
          <IssueList keys={blocking} describe={describe} onGo={onGo} tone="error" />
        </>
      ) : null}

      {warnings.length ? (
        <>
          <p className={styles.text}>
            {blocking.length
              ? 'Também há itens opcionais incompletos (não impedem o PDF):'
              : 'Eles não impedem o PDF: revise se quiser ou gere assim mesmo.'}
          </p>
          <IssueList keys={warnings} describe={describe} onGo={onGo} tone="warning" />
        </>
      ) : null}

      {blocking.length === 0 ? (
        <div className={styles.actions}>
          <button type="button" className={styles.print} onClick={onPrint}>
            {clean ? 'Gerar PDF' : 'Gerar PDF mesmo assim'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
