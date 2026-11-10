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

export function hasCertificationContent(item) {
  return filled(item.name) || filled(item.issuer)
}

export function hasCourseContent(item) {
  return filled(item.name) || filled(item.institution)
}

export function hasLanguageContent(item) {
  return filled(item.language)
}

export function hasProjectContent(item) {
  return filled(item.name) || filled(item.description)
}

const join = (parts, separator) =>
  parts
    .map((part) => String(part ?? '').trim())
    .filter(Boolean)
    .join(separator)

// "Belém, PA" — cidade e/ou UF, o que estiver preenchido.
export function formatCityState(personal) {
  return join([personal.city, personal.state], ', ')
}

/**
 * Endereço exibido no currículo. Por padrão só cidade/UF; com `addressDisplay: 'full'`,
 * tudo o que foi preenchido: "Rua das Flores, 120, apto 3 – Centro – Belém, PA – CEP 66010-000".
 * Nenhuma parte é obrigatória.
 */
export function formatAddress(personal) {
  const cityState = formatCityState(personal)
  if (personal.addressDisplay !== 'full') return cityState
  const street = join([personal.street, personal.number, personal.complement], ', ')
  const zip = String(personal.zip ?? '').trim()
  return join([street, personal.district, cityState, zip && `CEP ${zip}`], ' – ')
}
