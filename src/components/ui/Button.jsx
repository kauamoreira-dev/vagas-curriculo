import { Link } from 'react-router-dom'
import styles from './Button.module.css'

/**
 * Botão do sistema. Com `to`, vira link de navegação interna.
 * variant: primary | secondary | tonal | ghost | danger — size: md | sm
 * `tonal` é para ações de apoio que precisam aparecer (ex.: Usar exemplo) sem competir com a primária.
 */
export function Button({
  to,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  children,
  ...props
}) {
  const classes = [styles.button, styles[variant], styles[size], className].join(' ')

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  )
}
