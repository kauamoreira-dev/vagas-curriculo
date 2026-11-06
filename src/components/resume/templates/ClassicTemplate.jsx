import {
  ContactList,
  EducationList,
  ExperienceList,
  NameBlock,
  Photo,
  SkillsList,
  Summary,
} from './parts'
import styles from './ClassicTemplate.module.css'

export function ClassicTemplate({ resume }) {
  return (
    <div className={styles.page}>
      <Photo personal={resume.personal} styles={styles} />
      <NameBlock personal={resume.personal} styles={styles} />
      <ContactList personal={resume.personal} styles={styles} />
      <Summary summary={resume.summary} styles={styles} />
      <ExperienceList experience={resume.experience} styles={styles} />
      <EducationList education={resume.education} styles={styles} />
      <SkillsList skills={resume.skills} styles={styles} />
    </div>
  )
}
