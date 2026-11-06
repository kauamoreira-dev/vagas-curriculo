import {
  ContactList,
  EducationList,
  ExperienceList,
  NameBlock,
  Photo,
  SkillsList,
  Summary,
} from './parts'
import styles from './EssentialTemplate.module.css'

export function EssentialTemplate({ resume }) {
  return (
    <div className={styles.page}>
      <div className={styles.top}>
        <NameBlock personal={resume.personal} styles={styles} />
        <ContactList personal={resume.personal} styles={styles} />
        <Photo personal={resume.personal} styles={styles} />
      </div>
      <Summary summary={resume.summary} styles={styles} />
      <ExperienceList experience={resume.experience} styles={styles} />
      <EducationList education={resume.education} styles={styles} />
      <SkillsList skills={resume.skills} styles={styles} />
    </div>
  )
}
