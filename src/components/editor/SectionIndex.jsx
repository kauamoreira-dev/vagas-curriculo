import { useMediaQuery } from '@/hooks/useMediaQuery'
import styles from './SectionIndex.module.css'

// A partir desta largura, o índice vira um trilho sempre aberto ao lado do formulário.
export const RAIL_QUERY = '(min-width: 1360px)'

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
 * Índice das seções do formulário. Mostra quantas estão preenchidas, numa contagem e numa barra
 * fina, e leva até cada uma (abrindo-a, se estiver fechada).
 * - Telas largas (RAIL_QUERY): trilho sempre aberto ao lado do formulário, com a estrutura e o
 *   progresso à vista o tempo todo.
 * - Demais: recolhido numa linha até a pessoa abrir (<details> nativo: teclado e leitor de tela
 *   sem código extra).
 * `sections`: [{ name, title, main, filled, state }], onde `main` separa as principais das
 * complementares, `filled` conta para o progresso e `state` é 'error' | 'warning' | 'filled' | 'empty'.
 */
export function SectionIndex({ sections, onJump }) {
  const rail = useMediaQuery(RAIL_QUERY)
  const filled = sections.filter((section) => section.filled).length
  const groups = [
    { label: 'Principais', items: sections.filter((section) => section.main) },
    { label: 'Complementares', items: sections.filter((section) => !section.main) },
  ]
  const progress = (
    <>
      <span className={styles.summaryTitle}>Seções</span>
      <span className={styles.progress}>
        {filled} de {sections.length} preenchidas
      </span>
    </>
  )
  // A contagem já é o texto acessível; a barra é só visual.
  const bar = (
    <span className={styles.bar} aria-hidden="true">
      <span className={styles.barFill} style={{ width: `${(filled / sections.length) * 100}%` }} />
    </span>
  )
  const nav = (
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
  )

  if (rail) {
    return (
      <aside className={styles.rail} data-section-index="rail">
        <div className={styles.railHead}>
          {progress}
          {bar}
        </div>
        {nav}
      </aside>
    )
  }

  return (
    <details className={styles.index} data-section-index="compact">
      <summary className={styles.summary}>
        {progress}
        <span className={styles.chevron} aria-hidden="true" />
        {bar}
      </summary>
      {nav}
    </details>
  )
}
