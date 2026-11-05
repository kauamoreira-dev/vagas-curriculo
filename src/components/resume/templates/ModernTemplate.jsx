import { ContactList, EducationList, ExperienceList, NameBlock, SkillsList, Summary } from './parts'
import styles from './ModernTemplate.module.css'

export function ModernTemplate({ resume }) {
  return (
    <div className={styles.page}>
      <aside className={styles.aside}>
        <NameBlock personal={resume.personal} styles={styles} />
        <ContactList personal={resume.personal} styles={styles} />
        <SkillsList skills={resume.skills} styles={styles} />
      </aside>
      <div className={styles.main}>
        <Summary summary={resume.summary} styles={styles} />
        <ExperienceList experience={resume.experience} styles={styles} />
        <EducationList education={resume.education} styles={styles} />
      </div>
    </div>
  )
}
