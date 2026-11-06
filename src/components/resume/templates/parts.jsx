import {
  formatPeriod,
  hasEducationContent,
  hasExperienceContent,
  splitLines,
  splitSkills,
} from '@/utils/resumeText'

// Blocos de conteúdo compartilhados pelos modelos. Cada modelo define o próprio visual via `styles`.

export function NameBlock({ personal, styles }) {
  const name = personal.name?.trim()
  const title = personal.title?.trim()
  return (
    <header className={styles.identity}>
      <h1 className={name ? styles.name : `${styles.name} ${styles.placeholder}`}>
        {name || 'Seu nome'}
      </h1>
      <p className={title ? styles.title : `${styles.title} ${styles.placeholder}`}>
        {title || 'Cargo ou área de atuação'}
      </p>
    </header>
  )
}

// Foto de perfil; não aparece sem foto ou quando a pessoa escolheu ocultá-la.
export function Photo({ personal, styles }) {
  if (!personal.photo || personal.photoVisible === false) return null
  const name = personal.name?.trim()
  return (
    <img
      className={styles.photo}
      src={personal.photo}
      alt={name ? `Foto de ${name}` : 'Foto de perfil'}
      width={400}
      height={400}
    />
  )
}

export function ContactList({ personal, styles }) {
  const items = [personal.email, personal.phone, personal.location, personal.link]
    .map((item) => item?.trim())
    .filter(Boolean)
  if (!items.length) return null
  return (
    <ul className={styles.contact}>
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  )
}

export function Section({ title, styles, children }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      <div className={styles.sectionBody}>{children}</div>
    </section>
  )
}

export function Summary({ summary, styles }) {
  if (!summary?.trim()) return null
  return (
    <Section title="Resumo" styles={styles}>
      <p className={styles.paragraph}>{summary}</p>
    </Section>
  )
}

function EntryHead({ title: rawTitle, org: rawOrg, period, styles }) {
  const title = rawTitle?.trim()
  const org = rawOrg?.trim()
  return (
    <div className={styles.entryHead}>
      <h3 className={styles.entryTitle}>
        {title}
        {title && org ? <span className={styles.entrySep}> · </span> : null}
        {org ? <span className={styles.entryOrg}>{org}</span> : null}
      </h3>
      {period ? <span className={styles.period}>{period}</span> : null}
    </div>
  )
}

export function ExperienceList({ experience, styles }) {
  const items = experience.filter(hasExperienceContent)
  if (!items.length) return null
  return (
    <Section title="Experiência" styles={styles}>
      {items.map((item) => {
        const bullets = splitLines(item.description)
        return (
          <article key={item.id} className={styles.entry}>
            <EntryHead
              title={item.role}
              org={item.company}
              period={formatPeriod(item.start, item.end)}
              styles={styles}
            />
            {bullets.length > 0 && (
              <ul className={styles.bullets}>
                {bullets.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            )}
          </article>
        )
      })}
    </Section>
  )
}

export function EducationList({ education, styles }) {
  const items = education.filter(hasEducationContent)
  if (!items.length) return null
  return (
    <Section title="Formação" styles={styles}>
      {items.map((item) => (
        <article key={item.id} className={styles.entry}>
          <EntryHead
            title={item.course}
            org={item.institution}
            period={formatPeriod(item.start, item.end)}
            styles={styles}
          />
        </article>
      ))}
    </Section>
  )
}

export function SkillsList({ skills, styles }) {
  const items = splitSkills(skills)
  if (!items.length) return null
  return (
    <Section title="Habilidades" styles={styles}>
      <ul className={styles.skills}>
        {/* Pela posição: a pessoa pode repetir uma habilidade, e o texto não serve de chave */}
        {items.map((skill, index) => (
          <li key={index}>{skill}</li>
        ))}
      </ul>
    </Section>
  )
}
