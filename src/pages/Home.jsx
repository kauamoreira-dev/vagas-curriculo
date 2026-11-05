import { Link } from 'react-router-dom'
import { ResumeDocument } from '@/components/resume/ResumeDocument'
import { ScaledSheet } from '@/components/resume/ScaledSheet'
import { Button } from '@/components/ui/Button'
import { SAMPLE_RESUME } from '@/data/resume'
import { TEMPLATES } from '@/data/templates'
import styles from './Home.module.css'

// Anotações de revisão sobre a folha de exemplo. `top` é a posição (% da área visível da folha) do trecho comentado.
const MARGIN_NOTES = [
  { top: 4, section: 'Cabeçalho', text: 'Nome e cargo no topo: é o primeiro trecho lido.' },
  { top: 27, section: 'Resumo', text: 'Duas ou três linhas, sem adjetivos vagos.' },
  {
    top: 47,
    section: 'Experiência',
    text: 'Cada linha começa com um verbo e, se possível, um resultado.',
  },
  { top: 85, section: 'Habilidades', text: 'As que a vaga pede — não uma lista de tudo.' },
]

const STEPS = [
  {
    title: 'Escolha um modelo',
    text: 'Clássico, Moderno ou Essencial. Dá para trocar a qualquer momento sem perder o que já foi escrito.',
  },
  {
    title: 'Preencha ao lado da página',
    text: 'Cada campo aparece na folha enquanto você digita. O rascunho fica salvo neste navegador.',
  },
  {
    title: 'Salve em PDF',
    text: 'Use “Salvar PDF” no editor e escolha “Salvar como PDF” na janela de impressão do navegador.',
  },
]

const QUESTIONS = [
  {
    q: 'Preciso criar uma conta?',
    a: 'Não. Nesta versão o editor funciona sem cadastro, direto no navegador.',
  },
  {
    q: 'Onde ficam os meus dados?',
    a: 'Somente no armazenamento local do navegador que você está usando. Nada é enviado para servidores. Se você limpar os dados do navegador ou trocar de aparelho, o rascunho não estará lá.',
  },
  {
    q: 'Consigo exportar em Word?',
    a: 'Ainda não. Por enquanto a exportação é em PDF, pela impressão do navegador.',
  },
]

export function Home() {
  return (
    <>
      <section className={styles.hero}>
        <div className={`container ${styles.heroGrid}`}>
          <div className={styles.heroText}>
            <h1 className={styles.headline}>
              Um currículo claro diz mais <em>em uma página</em>.
            </h1>
            <p className={styles.lede}>
              Preencha suas informações, veja a folha tomando forma ao lado e salve em PDF. Três
              modelos, sem cadastro.
            </p>
            <div className={styles.actions}>
              <Button to="/editor">Criar meu currículo</Button>
              <Button to="/modelos" variant="secondary">
                Ver modelos
              </Button>
            </div>
          </div>

          <figure className={styles.specimen}>
            <div className={styles.sheetWrap}>
              <ScaledSheet clip={0.66} className={styles.sheet}>
                <ResumeDocument templateId="classico" resume={SAMPLE_RESUME} />
              </ScaledSheet>
              <ol className={styles.notes} aria-label="Anotações sobre o exemplo">
                {MARGIN_NOTES.map((note) => (
                  <li
                    key={note.section}
                    className={styles.note}
                    style={{ '--top': `${note.top}%` }}
                  >
                    <span className={styles.noteLabel}>{note.section}</span>
                    {note.text}
                  </li>
                ))}
              </ol>
            </div>
            <figcaption className={styles.caption}>Exemplo fictício no modelo Clássico.</figcaption>
          </figure>
        </div>
      </section>

      <section id="como-funciona" className={styles.steps} aria-labelledby="como-funciona-titulo">
        <div className="container">
          <h2 id="como-funciona-titulo" className={styles.sectionTitle}>
            Como funciona
          </h2>
          <ol className={styles.stepList}>
            {STEPS.map((step, index) => (
              <li key={step.title} className={styles.step}>
                <span className={styles.stepNumber} aria-hidden="true">
                  {index + 1}
                </span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepText}>{step.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className={styles.models} aria-labelledby="modelos-titulo">
        <div className="container">
          <div className={styles.modelsHead}>
            <h2 id="modelos-titulo" className={styles.sectionTitle}>
              Três modelos para começar
            </h2>
            <Link to="/modelos" className={styles.textLink}>
              Comparar modelos
            </Link>
          </div>
          <ul className={styles.modelGrid}>
            {TEMPLATES.map((template) => (
              <li key={template.id}>
                <Link to={`/editor?modelo=${template.id}`} className={styles.modelCard}>
                  <ScaledSheet clip className={styles.modelThumb}>
                    <ResumeDocument templateId={template.id} resume={SAMPLE_RESUME} />
                  </ScaledSheet>
                  <span className={styles.modelName}>{template.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className={styles.faq} aria-labelledby="perguntas-titulo">
        <div className={`container ${styles.faqGrid}`}>
          <h2 id="perguntas-titulo" className={styles.sectionTitle}>
            Antes de começar
          </h2>
          <div className={styles.faqList}>
            {QUESTIONS.map((item) => (
              <details key={item.q} className={styles.question}>
                <summary>{item.q}</summary>
                <p>{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <section className={styles.closing}>
        <div className={`container ${styles.closingInner}`}>
          <p className={styles.closingText}>Comece pelo modelo. O texto você ajusta depois.</p>
          <Button to="/editor">Abrir o editor</Button>
        </div>
      </section>
    </>
  )
}
