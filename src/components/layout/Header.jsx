import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Logo } from './Logo'
import styles from './Header.module.css'

const NAV_ITEMS = [
  { to: '/#como-funciona', label: 'Como funciona', hash: true },
  { to: '/modelos', label: 'Modelos' },
  { to: '/curriculos', label: 'Meus currículos' },
  { to: '/editor', label: 'Editor' },
]

export function Header() {
  const [open, setOpen] = useState(false)
  // Fecha o menu móvel ao escolher um destino.
  const close = () => setOpen(false)

  return (
    <header className={styles.header}>
      <div className={`container ${styles.bar}`}>
        <Logo />

        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls="menu-principal"
          onClick={() => setOpen((value) => !value)}
        >
          <span className={styles.menuIcon} data-open={open} aria-hidden="true" />
          {open ? 'Fechar' : 'Menu'}
        </button>

        <nav
          id="menu-principal"
          className={styles.nav}
          data-open={open}
          aria-label="Navegação principal"
        >
          <ul className={styles.links}>
            {NAV_ITEMS.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end
                  onClick={close}
                  className={({ isActive }) =>
                    `${styles.link} ${isActive && !item.hash ? styles.active : ''}`
                  }
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
          <Button to="/editor" size="sm" className={styles.cta} onClick={close}>
            Criar currículo
          </Button>
        </nav>
      </div>
    </header>
  )
}
