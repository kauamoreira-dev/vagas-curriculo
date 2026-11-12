import { Link } from 'react-router-dom'
import { ResumeDocument } from '@/components/resume/ResumeDocument'
import { ScaledSheet } from '@/components/resume/ScaledSheet'
import { Button } from '@/components/ui/Button'
import { SAMPLE_RESUME } from '@/data/resume'
import { TEMPLATES } from '@/data/templates'
import { createResumePath } from '@/services/resumeStore'
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
    title: 'Preencha e acompanhe a folha',
    text: 'Cada campo aparece na folha enquanto você digita. O rascunho fica salvo neste navegador.',
  },
  {
    title: 'Salve em PDF',
    text: 'Toque em PDF no editor e salve o arquivo pela janela de impressão do navegador.',
  },
]

// O que muda a decisão de quem chega: sem conta, dados no aparelho, PDF pronto.
const PROMISES = ['Sem cadastro', 'Fica só no seu aparelho', 'PDF pronto para imprimir']

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
    q: 'Como levo meus currículos para outro aparelho?',
    a: 'Em Meus currículos, toque em “Baixar cópia de segurança”. No outro aparelho, abra Meus currículos e use “Restaurar de um arquivo”. O arquivo fica só com você.',
  },
  {
    q: 'Consigo exportar em Word?',
    a: 'Ainda não. Por enquanto a exportação é em PDF, pela impressão do navegador.',
  },
]

/*
 * No carrossel do celular, o cartão que recebe o foco (Tab) vem inteiro para a tela. Sozinho, o
 * navegador não rola a faixa quando o cartão já aparece em parte (a ponta do seguinte à direita).
 * Na grade do computador não há rolagem lateral, e a chamada não move nada.
 */
function revealInCarousel(event) {
  event.currentTarget.scrollIntoView({ block: 'nearest', inline: 'start' })
}

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
              Preencha suas informações, veja a folha tomando forma e salve em PDF. Três modelos, sem
              cadastro.
            </p>
            <div className={styles.actions}>
              <Button to={createResumePath()}>Criar meu currículo</Button>
              <Button to="/modelos" variant="secondary">
                Ver modelos
              </Button>
            </div>
            <ul className={styles.promises}>
              {PROMISES.map((promise) => (
                <li key={promise}>
                  <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.check}>
                    <path d="M3.5 8.5l3 3 6-7" />
                  </svg>
                  {promise}
                </li>
              ))}
            </ul>
          </div>

          <figure className={styles.specimen}>
            <div className={styles.sheetWrap}>
              {/* No celular, números sobre a folha marcam o trecho de cada anotação (legenda abaixo) */}
              <div className={styles.sheetFrame}>
                <ScaledSheet clip={0.66} className={styles.sheet}>
                  <ResumeDocument templateId="classico" resume={SAMPLE_RESUME} />
                </ScaledSheet>
                {MARGIN_NOTES.map((note, index) => (
                  <span
                    key={note.section}
                    className={styles.noteMarker}
                    style={{ '--top': `${note.top}%` }}
                    aria-hidden="true"
                  >
                    {index + 1}
                  </span>
                ))}
              </div>
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
                <Link
                  to={`/editor?modelo=${template.id}`}
                  className={styles.modelCard}
                  onFocus={revealInCarousel}
                >
                  {/* Miniatura decorativa: sem ela no nome do link, o leitor de tela não lê o currículo inteiro */}
                  <div aria-hidden="true">
                    <ScaledSheet clip className={styles.modelThumb}>
                      <ResumeDocument templateId={template.id} resume={SAMPLE_RESUME} />
                    </ScaledSheet>
                  </div>
                  <span className={styles.modelInfo}>
                    <span className={styles.modelName}>{template.name}</span>
                    <span className={styles.modelFor}>{template.bestFor}</span>
                    <span className={styles.modelAction}>
                      Usar este modelo <span aria-hidden="true">→</span>
                    </span>
                  </span>
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
