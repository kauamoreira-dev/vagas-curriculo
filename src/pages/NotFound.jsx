import { Button } from '@/components/ui/Button'
import styles from './NotFound.module.css'

export function NotFound() {
  return (
    <div className={`container ${styles.page}`}>
      <h1 className={styles.title}>Página não encontrada</h1>
      <p className={styles.text}>O endereço pode ter mudado ou foi digitado com erro.</p>
      <div className={styles.actions}>
        <Button to="/">Ir para o início</Button>
        <Button to="/editor" variant="secondary">
          Abrir o editor
        </Button>
      </div>
    </div>
  )
}
