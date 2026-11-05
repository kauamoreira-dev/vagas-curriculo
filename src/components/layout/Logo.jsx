import { Link } from 'react-router-dom'
import styles from './Logo.module.css'

// Arquivo oficial da marca (não editar). Fica em public/brand/.
export const LOGO_SRC = '/brand/logo-vagas-curriculo.png'

/**
 * Marca do Vagas Currículo: símbolo oficial + nome.
 * size: tamanho do símbolo em px. showName: exibe o nome ao lado do símbolo.
 */
export function Logo({ size = 36, showName = true, className = '' }) {
  return (
    <Link
      to="/"
      className={`${styles.logo} ${className}`}
      style={{ '--logo-size': `${size}px` }}
      aria-label="Vagas Currículo — página inicial"
    >
      <span className={styles.mark} aria-hidden="true">
        <img src={LOGO_SRC} alt="" width="1254" height="1254" className={styles.image} />
      </span>
      {showName ? (
        <span className={styles.name} aria-hidden="true">
          <span className={styles.primary}>Vagas</span>{' '}
          <span className={styles.secondary}>Currículo</span>
        </span>
      ) : null}
    </Link>
  )
}
