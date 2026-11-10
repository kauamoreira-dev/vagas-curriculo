import { Link } from 'react-router-dom'
import styles from './Logo.module.css'

// Arquivo oficial da marca (não editar). Fica em public/brand/.
export const LOGO_SRC = '/brand/logo-vagas-curriculo.png'

/*
 * Cópias reduzidas do arquivo oficial, só para exibição (o oficial tem ~1 MB e 1254 px).
 * O símbolo aparece com ~49–54 px (1,35 × --logo-size, ver Logo.module.css): 72 px para telas
 * comuns e 144 px para telas de alta densidade.
 */
export const LOGO_SRC_72 = '/brand/logo-vagas-curriculo-72.png'
export const LOGO_SRC_144 = '/brand/logo-vagas-curriculo-144.png'

/**
 * Marca do Currículo Tapajós: símbolo oficial + nome.
 * size: tamanho do símbolo em px. showName: exibe o nome ao lado do símbolo.
 */
export function Logo({ size = 36, showName = true, className = '' }) {
  return (
    <Link
      to="/"
      className={`${styles.logo} ${className}`}
      style={{ '--logo-size': `${size}px` }}
      aria-label="Currículo Tapajós — página inicial"
    >
      <span className={styles.mark} aria-hidden="true">
        <img
          src={LOGO_SRC_72}
          srcSet={`${LOGO_SRC_72} 1x, ${LOGO_SRC_144} 2x`}
          alt=""
          width="144"
          height="144"
          className={styles.image}
        />
      </span>
      {showName ? (
        <span className={styles.name} aria-hidden="true">
          <span className={styles.primary}>Currículo</span>{' '}
          <span className={styles.secondary}>Tapajós</span>
        </span>
      ) : null}
    </Link>
  )
}
