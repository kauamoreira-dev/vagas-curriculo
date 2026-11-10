import styles from './SectionIndex.module.css'

const STATE_LABEL = {
  error: 'Corrigir',
  warning: 'Revisar',
  filled: 'Preenchida',
  empty: 'Vazia',
}

// Pendências também aparecem por escrito; preenchida/vazia ficam só no ícone (e no leitor de tela).
const VISIBLE_STATES = new Set(['error', 'warning'])

/*
 * Ícone do estado, com formas diferentes para não depender só da cor:
 * preenchida (círculo com ✓), vazia (círculo vazado), revisar (triângulo com !), corrigir (círculo com !).
 */
function StateIcon({ state }) {
  return (
    <svg className={styles.icon} data-state={state} viewBox="0 0 16 16" aria-hidden="true" focusable="false">
      {state === 'filled' ? (
        <>
          <circle cx="8" cy="8" r="7" />
          <path d="m4.8 8.2 2.1 2.1 4.3-4.6" className={styles.mark} />
        </>
      ) : null}
      {state === 'empty' ? <circle cx="8" cy="8" r="6.25" /> : null}
      {state === 'warning' ? (
        <>
          <path d="M8 1.5 15 14H1z" />
          <path d="M8 6v3.6M8 11.6v.1" className={styles.mark} />
        </>
      ) : null}
      {state === 'error' ? (
        <>
          <circle cx="8" cy="8" r="7" />
          <path d="M8 4.4v4.4M8 11.2v.1" className={styles.mark} />
        </>
      ) : null}
    </svg>
  )
}

/**
 * Índice das seções do formulário, recolhido numa linha até a pessoa abrir (<details> nativo:
 * teclado e leitor de tela sem código extra). Mostra quantas estão preenchidas, numa contagem e
 * numa barra fina, e leva até cada uma (abrindo-a, se estiver fechada).
 * `sections`: [{ name, title, main, filled, state }], onde `main` separa as principais das
 * complementares, `filled` conta para o progresso e `state` é 'error' | 'warning' | 'filled' | 'empty'.
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
        {/* A contagem acima já é o texto acessível; a barra é só visual. */}
        <span className={styles.bar} aria-hidden="true">
          <span className={styles.barFill} style={{ width: `${(filled / sections.length) * 100}%` }} />
        </span>
      </summary>
      <nav aria-label="Seções do currículo" className={styles.nav}>
        {groups.map((group) => (
          <div key={group.label} className={styles.group}>
            <p className={styles.groupLabel}>{group.label}</p>
            <ul className={styles.grid}>
              {group.items.map((section) => (
                <li key={section.name}>
                  <button
                    type="button"
                    className={styles.link}
                    data-state={section.state}
                    onClick={() => onJump(section.name)}
                  >
                    <StateIcon state={section.state} />
                    <span className={styles.text}>
                      <span className={styles.linkTitle}>{section.title}</span>{' '}
                      <span
                        className={VISIBLE_STATES.has(section.state) ? styles.state : styles.srOnly}
                        data-state={section.state}
                      >
                        {STATE_LABEL[section.state]}
                      </span>
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
