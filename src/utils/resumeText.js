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
  const from = String(start ?? '').trim()
  const to = String(end ?? '').trim()
  if (from && to) return `${from} – ${to}`
  return from || to
}

// Campos só com espaços não contam como conteúdo.
const filled = (value) => Boolean(String(value ?? '').trim())

export function hasExperienceContent(item) {
  return filled(item.role) || filled(item.company) || filled(item.description)
}

export function hasEducationContent(item) {
  return filled(item.course) || filled(item.institution)
}
