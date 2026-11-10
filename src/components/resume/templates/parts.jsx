import {
  formatAddress,
  formatPeriod,
  hasCertificationContent,
  hasCourseContent,
  hasEducationContent,
  hasExperienceContent,
  hasLanguageContent,
  hasProjectContent,
  splitLines,
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
  const fullAddress = personal.addressDisplay === 'full'
  const items = [
    { text: personal.email },
    { text: personal.phone },
    // Endereço completo é longo: os modelos podem dar uma linha só para ele.
    { text: formatAddress(personal), address: fullAddress },
    { text: personal.link },
  ]
    .map((item) => ({ ...item, text: item.text?.trim() }))
    .filter((item) => item.text)
  if (!items.length) return null
  return (
    <ul className={styles.contact}>
      {items.map((item, index) => (
        <li key={index} className={item.address ? styles.fullAddress : undefined}>
          {item.text}
        </li>
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

export function Objective({ objective, styles }) {
  if (!objective?.trim()) return null
  return (
    <Section title="Objetivo" styles={styles}>
      <p className={styles.paragraph}>{objective}</p>
    </Section>
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

// Link clicável no PDF; o texto mostrado fica como a pessoa digitou.
function ExternalLink({ url, styles }) {
  const label = url?.trim()
  if (!label) return null
  const href = /^https?:\/\//i.test(label) ? label : `https://${label}`
  return (
    <a className={styles.entryLink} href={href}>
      {label}
    </a>
  )
}

export function CertificationList({ certifications, styles }) {
  const items = certifications.filter(hasCertificationContent)
  if (!items.length) return null
  return (
    <Section title="Certificações" styles={styles}>
      {items.map((item) => {
        const issued = item.issued.trim()
        const expires = item.expires.trim()
        const dates = [issued && `Emitida em ${issued}`, expires && `válida até ${expires}`]
          .filter(Boolean)
          .join(' · ')
        return (
          <article key={item.id} className={styles.entry}>
            <EntryHead title={item.name} org={item.issuer} period={dates} styles={styles} />
            <ExternalLink url={item.url} styles={styles} />
          </article>
        )
      })}
    </Section>
  )
}

// "40" ou "40h" → "40 h".
function formatHours(hours) {
  const digits = String(hours ?? '').match(/\d+/)?.[0]
  return digits ? `${digits} h` : String(hours ?? '').trim()
}

export function CourseList({ courses, styles }) {
  const items = courses.filter(hasCourseContent)
  if (!items.length) return null
  return (
    <Section title="Cursos complementares" styles={styles}>
      {items.map((item) => (
        <article key={item.id} className={styles.entry}>
          <EntryHead
            title={item.name}
            org={item.institution}
            period={[formatHours(item.hours), item.year.trim()].filter(Boolean).join(' · ')}
            styles={styles}
          />
        </article>
      ))}
    </Section>
  )
}

export function ProjectList({ projects, styles }) {
  const items = projects.filter(hasProjectContent)
  if (!items.length) return null
  return (
    <Section title="Projetos" styles={styles}>
      {items.map((item) => {
        const lines = splitLines(item.description)
        const technologies = item.technologies.trim()
        return (
          <article key={item.id} className={styles.entry}>
            <EntryHead title={item.name} styles={styles} />
            {technologies ? <p className={styles.entryMeta}>{technologies}</p> : null}
            {lines.length === 1 ? <p className={styles.paragraph}>{lines[0]}</p> : null}
            {lines.length > 1 ? (
              <ul className={styles.bullets}>
                {lines.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            ) : null}
            <ExternalLink url={item.url} styles={styles} />
          </article>
        )
      })}
    </Section>
  )
}

function SkillItems({ items, styles }) {
  return (
    <ul className={styles.skills}>
      {/* Pela posição: a pessoa pode repetir uma habilidade, e o texto não serve de chave */}
      {items.map((skill, index) => (
        <li key={index}>{skill}</li>
      ))}
    </ul>
  )
}

// Com os dois grupos preenchidos, cada um ganha um subtítulo; com um só, a lista fica direto na seção.
export function SkillsList({ skills, softSkills = [], styles }) {
  const technical = skills.filter((skill) => skill.trim())
  const soft = softSkills.filter((skill) => skill.trim())
  if (!technical.length && !soft.length) return null
  if (!technical.length || !soft.length) {
    return (
      <Section title="Habilidades" styles={styles}>
        <SkillItems items={technical.length ? technical : soft} styles={styles} />
      </Section>
    )
  }
  return (
    <Section title="Habilidades" styles={styles}>
      <div className={styles.skillGroup}>
        <h3 className={styles.groupTitle}>Técnicas</h3>
        <SkillItems items={technical} styles={styles} />
      </div>
      <div className={styles.skillGroup}>
        <h3 className={styles.groupTitle}>Comportamentais</h3>
        <SkillItems items={soft} styles={styles} />
      </div>
    </Section>
  )
}

export function LanguageList({ languages, styles }) {
  const items = languages.filter(hasLanguageContent)
  if (!items.length) return null
  return (
    <Section title="Idiomas" styles={styles}>
      <ul className={styles.languages}>
        {items.map((item) => (
          <li key={item.id}>
            <span className={styles.languageName}>{item.language.trim()}</span>
            {item.level ? <span className={styles.languageLevel}>{item.level}</span> : null}
          </li>
        ))}
      </ul>
    </Section>
  )
}

// Várias linhas viram tópicos (ex.: "CNH categoria B", "Disponibilidade para viagens").
export function AdditionalInfo({ additionalInfo, styles }) {
  const lines = splitLines(additionalInfo)
  if (!lines.length) return null
  return (
    <Section title="Informações adicionais" styles={styles}>
      {lines.length === 1 ? (
        <p className={styles.paragraph}>{lines[0]}</p>
      ) : (
        <ul className={styles.bullets}>
          {lines.map((line, index) => (
            <li key={index}>{line}</li>
          ))}
        </ul>
      )}
    </Section>
  )
}
