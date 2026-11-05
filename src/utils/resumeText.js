// Transforma o texto livre do formulário em listas para a pré-visualização.

export function splitLines(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.replace(/^\s*[-•*]\s*/, '').trim())
    .filter(Boolean)
}

export function splitSkills(text) {
  return (text || '')
    .split(/[,\n]/)
    .map((skill) => skill.trim())
    .filter(Boolean)
}

export function formatPeriod(start, end) {
  if (start && end) return `${start} – ${end}`
  return start || end || ''
}

export function hasExperienceContent(item) {
  return Boolean(item.role || item.company || item.description)
}

export function hasEducationContent(item) {
  return Boolean(item.course || item.institution)
}
