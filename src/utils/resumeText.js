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

/**
 * Data de nascimento do formulário (AAAA-MM-DD do campo de data, ou DD/MM/AAAA digitada) como
 * { year, month, day }, ou null se não for uma data que existe.
 */
export function parseBirthDate(value) {
  const text = String(value ?? '').trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  const [year, month, day] = iso
    ? [iso[1], iso[2], iso[3]].map(Number)
    : br
      ? [br[3], br[2], br[1]].map(Number)
      : []
  if (!year) return null
  const date = new Date(year, month - 1, day)
  const exists = date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
  return exists ? { year, month, day } : null
}

/** Idade completa em `today` (conta só depois do aniversário), ou null se a data for inválida. */
export function ageFromBirthDate(value, today = new Date()) {
  const birth = parseBirthDate(value)
  if (!birth) return null
  const month = today.getMonth() + 1
  const beforeBirthday = month < birth.month || (month === birth.month && today.getDate() < birth.day)
  return today.getFullYear() - birth.year - (beforeBirthday ? 1 : 0)
}

// "28 anos" (ou "1 ano"); vazio se a data for inválida ou no futuro.
export function formatAge(value, today = new Date()) {
  const age = ageFromBirthDate(value, today)
  if (age === null || age < 0) return ''
  return age === 1 ? '1 ano' : `${age} anos`
}
