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
import styles from './ClassicTemplate.module.css'

export function ClassicTemplate({ resume }) {
  return (
    <div className={styles.page}>
      <Photo personal={resume.personal} styles={styles} />
      <NameBlock personal={resume.personal} styles={styles} />
      <ContactList personal={resume.personal} styles={styles} />
      <Objective objective={resume.objective} styles={styles} />
      <Summary summary={resume.summary} styles={styles} />
      <ExperienceList experience={resume.experience} styles={styles} />
      <EducationList education={resume.education} styles={styles} />
      <CourseList courses={resume.courses} styles={styles} />
      <CertificationList certifications={resume.certifications} styles={styles} />
      <ProjectList projects={resume.projects} styles={styles} />
      <SkillsList skills={resume.skills} softSkills={resume.softSkills} styles={styles} />
      <LanguageList languages={resume.languages} styles={styles} />
      <AdditionalInfo additionalInfo={resume.additionalInfo} styles={styles} />
    </div>
  )
}
