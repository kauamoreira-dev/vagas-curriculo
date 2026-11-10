import {
  AdditionalInfo,
  CertificationList,
  ContactList,
  CourseList,
  EducationList,
  ExperienceList,
  LanguageList,
  NameBlock,
  Objective,
  Photo,
  ProjectList,
  SkillsList,
  Summary,
} from './parts'
import styles from './ModernTemplate.module.css'

export function ModernTemplate({ resume }) {
  return (
    <div className={styles.page}>
      <aside className={styles.aside}>
        <Photo personal={resume.personal} styles={styles} />
        <NameBlock personal={resume.personal} styles={styles} />
        <ContactList personal={resume.personal} styles={styles} />
        <SkillsList skills={resume.skills} softSkills={resume.softSkills} styles={styles} />
        <LanguageList languages={resume.languages} styles={styles} />
      </aside>
      <div className={styles.main}>
        <Objective objective={resume.objective} styles={styles} />
        <Summary summary={resume.summary} styles={styles} />
        <ExperienceList experience={resume.experience} styles={styles} />
        <EducationList education={resume.education} styles={styles} />
        <CourseList courses={resume.courses} styles={styles} />
        <CertificationList certifications={resume.certifications} styles={styles} />
        <ProjectList projects={resume.projects} styles={styles} />
        <AdditionalInfo additionalInfo={resume.additionalInfo} styles={styles} />
      </div>
    </div>
  )
}
