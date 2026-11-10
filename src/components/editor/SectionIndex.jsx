import styles from './SectionIndex.module.css'

const STATE_LABEL = {
  error: 'Corrigir',
  warning: 'Revisar',
  filled: 'Preenchida',
  empty: 'Vazia',
}

/**
 * Índice das seções do formulário, recolhido numa linha até a pessoa abrir (<details> nativo:
 * teclado e leitor de tela sem código extra). Mostra quantas estão preenchidas e leva até cada uma
 * (abrindo-a, se estiver fechada). `sections`: [{ name, title, main, filled, state }], onde
 * `main` separa as principais das complementares, `filled` conta para o progresso e `state` é
 * 'error' | 'warning' | 'filled' | 'empty'.
 */
export function SectionIndex({ sections, onJump }) {
  const filled = sections.filter((section) => section.filled).length
  const groups = [
    { label: 'Principais', items: sections.filter((section) => section.main) },
    { label: 'Complementares', items: sections.filter((section) => !section.main) },
  ]

  return (
    <details className={styles.index}>
      <summary className={styles.summary}>
        <span className={styles.summaryTitle}>Seções</span>
        <span className={styles.progress}>
          {filled} de {sections.length} preenchidas
        </span>
        <span className={styles.chevron} aria-hidden="true" />
      </summary>
      <nav aria-label="Seções do currículo" className={styles.nav}>
        {groups.map((group) => (
          <div key={group.label} className={styles.group}>
            <p className={styles.groupLabel}>{group.label}</p>
            <ul className={styles.list}>
              {group.items.map((section) => (
                <li key={section.name}>
                  <button type="button" className={styles.link} onClick={() => onJump(section.name)}>
                    <span className={styles.dot} data-state={section.state} aria-hidden="true" />
                    <span className={styles.linkTitle}>{section.title}</span>
                    <span className={styles.state} data-state={section.state}>
                      {STATE_LABEL[section.state]}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </details>
  )
}
