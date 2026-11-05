import { ResumeDocument } from '@/components/resume/ResumeDocument'
import { ScaledSheet } from '@/components/resume/ScaledSheet'
import { Button } from '@/components/ui/Button'
import { SAMPLE_RESUME } from '@/data/resume'
import { TEMPLATES } from '@/data/templates'
import styles from './Templates.module.css'

export function Templates() {
  return (
    <div className={styles.page}>
      <header className={`container ${styles.intro}`}>
        <h1 className={styles.title}>Modelos</h1>
        <p className={styles.lede}>
          Os três usam o mesmo conteúdo. Escolha pelo visual que combina com a sua área — dá para
          trocar dentro do editor sem perder nada.
        </p>
      </header>

      <ul className={`container ${styles.grid}`}>
        {TEMPLATES.map((template) => (
          <li key={template.id} className={styles.card}>
            <ScaledSheet clip className={styles.thumb}>
              <ResumeDocument templateId={template.id} resume={SAMPLE_RESUME} />
            </ScaledSheet>
            <div className={styles.body}>
              <h2 className={styles.name}>{template.name}</h2>
              <p className={styles.description}>{template.description}</p>
              <p className={styles.bestFor}>
                <span>Indicado para</span> {template.bestFor}
              </p>
              <Button to={`/editor?modelo=${template.id}`} className={styles.cta}>
                Usar o modelo {template.name}
              </Button>
            </div>
          </li>
        ))}
      </ul>

      <p className={`container ${styles.note}`}>As miniaturas mostram um currículo fictício.</p>
    </div>
  )
}
