import { Link } from 'react-router-dom'
import { Logo } from './Logo'
import styles from './Footer.module.css'

const CURRENT_YEAR = new Date().getFullYear()

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <div className={styles.brand}>
          <Logo size={40} />
          <p className={styles.tagline}>
            Editor de currículos com modelos prontos e pré-visualização em tempo real.
          </p>
        </div>

        <nav aria-label="Rodapé" className={styles.columns}>
          <div>
            <h2 className={styles.heading}>Produto</h2>
            <ul className={styles.list}>
              <li>
                <Link to="/modelos">Modelos</Link>
              </li>
              <li>
                <Link to="/editor">Editor</Link>
              </li>
              <li>
                <Link to="/#como-funciona">Como funciona</Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>

      <div className={`container ${styles.legal}`}>
        <p>© {CURRENT_YEAR} Vagas Currículo</p>
        <p>Seu rascunho fica salvo apenas neste navegador.</p>
      </div>
    </footer>
  )
}
