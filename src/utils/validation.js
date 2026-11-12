// Validações e formatações do formulário. Funções puras: não alteram o currículo salvo.
import { ageFromBirthDate } from '@/utils/resumeText'

// ---------- Espaços ----------

// Linha única: remove espaços nas pontas e repetidos no meio.
export function normalizeLine(text) {
  return (text || '').replace(/\s+/g, ' ').trim()
}

// Texto com várias linhas: limpa as pontas de cada linha e evita sequências de linhas vazias.
export function normalizeMultiline(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function isBlank(value) {
  return !String(value ?? '').trim()
}

// ---------- E-mail ----------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[a-z]{2,}$/i

export function validateEmail(value) {
  const email = String(value ?? '').trim()
  if (!email) return null
  if (!email.includes('@')) return 'O e-mail precisa ter “@”. Ex.: nome@email.com'
  if (!EMAIL_PATTERN.test(email) || email.includes('..')) {
    return 'E-mail inválido. Confira se está no formato nome@email.com'
  }
  return null
}

// ---------- Telefone (Brasil) ----------

// Separa o código do país (+55) quando o número começa com “+”.
function splitPhone(value) {
  const raw = String(value ?? '').trim()
  const digits = raw.replace(/\D/g, '')
  if (raw.startsWith('+')) {
    return { international: true, country: digits.slice(0, 2), national: digits.slice(2) }
  }
  return { international: false, country: '', national: digits }
}

// Aplica a máscara (DD) 9XXXX-XXXX ou (DD) XXXX-XXXX conforme a pessoa digita.
// Não acrescenta separadores no fim, para que apagar com Backspace funcione normalmente.
export function formatPhone(value) {
  const raw = String(value ?? '')
  const { international, country, national } = splitPhone(raw)

  if (international) {
    if (country.length < 2) return raw.replace(/[^\d+]/g, '')
    // Números de outros países ficam como digitados; a validação avisa.
    if (country !== '55') return raw
  }

  const digits = national.slice(0, 11)
  const prefix = international ? '+55 ' : ''
  if (!digits) return international ? '+55' : ''

  const ddd = digits.slice(0, 2)
  const number = digits.slice(2)
  if (!number) return `${prefix}(${ddd}`
  const splitAt = number.length > 8 ? 5 : 4
  const first = number.slice(0, splitAt)
  const last = number.slice(splitAt)
  return `${prefix}(${ddd}) ${first}${last ? `-${last}` : ''}`
}

export function validatePhone(value) {
  if (isBlank(value)) return null
  const { international, country, national } = splitPhone(value)
  if (international && country !== '55') return 'Informe um número brasileiro (+55) com DDD.'
  if (national.length < 10) return 'Número incompleto. Informe DDD + número. Ex.: (11) 91234-5678'
  if (national.length > 11) return 'Número com dígitos demais. Confira o DDD e o número.'
  if (!/^[1-9]{2}$/.test(national.slice(0, 2))) return 'DDD inválido. Use dois dígitos de 11 a 99.'
  if (national.length === 11 && national[2] !== '9') {
    return 'Celular com 11 dígitos deve começar com 9 depois do DDD.'
  }
  if (national.length === 10 && !/[2-5]/.test(national[2])) {
    return 'Número fixo inválido. Se for celular, inclua o 9 depois do DDD.'
  }
  return null
}

// ---------- CEP ----------

// Máscara 00000-000 enquanto a pessoa digita.
export function formatZip(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8)
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits
}

export function validateZip(value) {
  if (isBlank(value)) return null
  return String(value).replace(/\D/g, '').length === 8 ? null : 'CEP incompleto. Use 8 dígitos. Ex.: 66010-000'
}

// ---------- Links ----------

// Endereço web com domínio (ex.: github.com/nome ou https://site.com.br). O protocolo é opcional.
const URL_PATTERN = /^(https?:\/\/)?[^\s/@]+\.[a-z]{2,}([/?#]\S*)?$/i

export function validateUrl(value) {
  if (isBlank(value)) return null
  return URL_PATTERN.test(String(value).trim()) ? null : 'Link inválido. Ex.: github.com/seu-nome ou https://site.com'
}

// ---------- Data de nascimento ----------

const MIN_AGE = 14
const MAX_AGE = 100

/** Opcional. Precisa ser uma data que existe, não futura, e dar uma idade de 14 a 100 anos. */
export function validateBirthDate(value, { today = new Date() } = {}) {
  if (isBlank(value)) return null
  const age = ageFromBirthDate(value, today)
  if (age === null) return 'Data inválida. Use dia, mês e ano (ex.: 12/03/1996).'
  if (age < 0) return 'A data de nascimento não pode estar no futuro.'
  if (age < MIN_AGE) return `Confira a data: a idade calculada é menor que ${MIN_AGE} anos.`
  if (age > MAX_AGE) return 'Confira o ano de nascimento.'
  return null
}

// ---------- Carga horária ----------

export function validateHours(value) {
  if (isBlank(value)) return null
  const match = String(value).trim().match(/^(\d{1,4})\s*(h|hs|horas?)?$/i)
  if (!match || Number(match[1]) === 0) return 'Informe só o número de horas. Ex.: 40'
  return null
}

// ---------- Datas ----------

const MONTHS = [
  'janeiro',
  'fevereiro',
  'marco',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

const ONGOING_WORDS = [
  'atual',
  'atualmente',
  'presente',
  'hoje',
  'o momento',
  'ate o momento',
  'em andamento',
  'cursando',
  'em curso',
]

const MIN_YEAR = 1950
const DATE_FORMAT_HINT = 'Use mês/ano (ex.: mar/2022 ou 03/2022) ou apenas o ano.'

function simplify(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function parseMonth(token) {
  if (/^\d{1,2}$/.test(token)) {
    const month = Number(token)
    return month >= 1 && month <= 12 ? month : null
  }
  if (token.length < 3) return null
  const index = MONTHS.findIndex((name) => name.startsWith(token))
  return index >= 0 ? index + 1 : null
}

/**
 * Interpreta o texto livre de uma data do formulário.
 * Retorna { empty }, { ongoing }, { year, month } ou { error }.
 */
export function parseResumeDate(value) {
  const text = simplify(value)
  if (!text) return { empty: true }
  if (ONGOING_WORDS.includes(text)) return { ongoing: true }

  let year
  let month = null
  const onlyYear = text.match(/^(\d{4})$/)
  const monthYear = text.match(/^([a-z]+|\d{1,2})\.?\s*(?:[/.-]|de|\s)\s*(\d{4})$/)
  if (onlyYear) {
    year = Number(onlyYear[1])
  } else if (monthYear) {
    month = parseMonth(monthYear[1])
    if (!month) return { error: `Mês não reconhecido. ${DATE_FORMAT_HINT}` }
    year = Number(monthYear[2])
  } else {
    return { error: `Formato de data não reconhecido. ${DATE_FORMAT_HINT}` }
  }

  if (year < MIN_YEAR) return { error: `Confira o ano: use um ano a partir de ${MIN_YEAR}.` }
  return { year, month }
}

// Compara duas datas parseadas; com só o ano em um dos lados, compara apenas os anos.
function compareDates(a, b) {
  if (a.year !== b.year) return a.year - b.year
  if (a.month && b.month) return a.month - b.month
  return 0
}

function isFuture(date, today) {
  const current = { year: today.getFullYear(), month: today.getMonth() + 1 }
  return compareDates(date, current) > 0
}

/**
 * Valida o par início/fim de uma experiência ou formação. Ambos são opcionais.
 * `allowFutureEnd`: formações podem ter conclusão prevista para o futuro.
 */
export function validatePeriod(startValue, endValue, { allowFutureEnd = false, today = new Date() } = {}) {
  const errors = {}
  const start = parseResumeDate(startValue)
  const end = parseResumeDate(endValue)
  const maxYear = today.getFullYear() + 10

  if (start.error) errors.start = start.error
  else if (start.ongoing) errors.start = 'Informe quando começou (mês/ano ou ano).'
  else if (!start.empty && isFuture(start, today)) errors.start = 'O início não pode estar no futuro.'

  if (end.error) errors.end = end.error
  else if (!end.empty && !end.ongoing) {
    if (end.year > maxYear) errors.end = 'Confira o ano informado.'
    else if (!allowFutureEnd && isFuture(end, today)) {
      errors.end = 'O fim não pode estar no futuro. Se ainda está aqui, escreva “Atual”.'
    } else if (!start.empty && !errors.start && compareDates(end, start) < 0) {
      errors.end = 'O fim não pode ser anterior ao início.'
    }
  }

  return errors
}

// ---------- Currículo completo ----------

/** Ano isolado (ex.: conclusão de um curso). Aceita até 10 anos no futuro (curso em andamento). */
export function validateYear(value, { today = new Date() } = {}) {
  if (isBlank(value)) return null
  const text = String(value).trim()
  if (!/^\d{4}$/.test(text)) return 'Informe o ano com 4 dígitos. Ex.: 2023'
  const year = Number(text)
  if (year < MIN_YEAR || year > today.getFullYear() + 10) return 'Confira o ano informado.'
  return null
}

/** Emissão e validade de uma certificação. A emissão não pode ser futura; a validade pode. */
export function validateCertificationDates(issuedValue, expiresValue, { today = new Date() } = {}) {
  const errors = {}
  const issued = parseResumeDate(issuedValue)
  const expires = parseResumeDate(expiresValue)
  if (issued.error) errors.issued = issued.error
  else if (issued.ongoing) errors.issued = 'Informe quando a certificação foi emitida.'
  else if (!issued.empty && isFuture(issued, today)) errors.issued = 'A emissão não pode estar no futuro.'

  if (expires.error) errors.expires = expires.error
  else if (expires.ongoing) errors.expires = 'Informe a data de validade ou deixe em branco.'
  else if (!expires.empty && !issued.empty && !errors.issued && compareDates(expires, issued) < 0) {
    errors.expires = 'A validade não pode ser anterior à emissão.'
  }
  return errors
}


function hasAnyValue(item, fields) {
  return fields.some((field) => !isBlank(item[field]))
}

/**
 * Valida o currículo e retorna um mapa { chaveDoCampo: mensagem }.
 * Chaves: `personal.email`, `experience.<id>.role`, `courses.<id>.year` etc.
 * Itens totalmente vazios são ignorados (não aparecem no currículo). Endereço e seções novas são opcionais.
 */
export function validateResume(resume, { today = new Date() } = {}) {
  const errors = {}
  const { personal } = resume

  if (isBlank(personal.name)) errors['personal.name'] = 'Informe seu nome completo.'

  const emailError = validateEmail(personal.email)
  if (emailError) errors['personal.email'] = emailError
  const phoneError = validatePhone(personal.phone)
  if (phoneError) errors['personal.phone'] = phoneError
  const phone2Error = validatePhone(personal.phone2)
  if (phone2Error) errors['personal.phone2'] = phone2Error
  if (isBlank(personal.email) && isBlank(personal.phone) && isBlank(personal.phone2)) {
    errors['personal.email'] = 'Informe ao menos um contato: e-mail ou telefone.'
  }
  const zipError = validateZip(personal.zip)
  if (zipError) errors['personal.zip'] = zipError
  const birthError = validateBirthDate(personal.birthDate, { today })
  if (birthError) errors['personal.birthDate'] = birthError

  for (const item of resume.experience) {
    if (!hasAnyValue(item, ['role', 'company', 'start', 'end', 'description'])) continue
    const key = `experience.${item.id}`
    if (isBlank(item.role)) errors[`${key}.role`] = 'Informe o cargo.'
    if (isBlank(item.company)) errors[`${key}.company`] = 'Informe a empresa.'
    const period = validatePeriod(item.start, item.end, { today })
    if (period.start) errors[`${key}.start`] = period.start
    if (period.end) errors[`${key}.end`] = period.end
  }

  for (const item of resume.education) {
    if (!hasAnyValue(item, ['course', 'institution', 'start', 'end'])) continue
    const key = `education.${item.id}`
    if (isBlank(item.course)) errors[`${key}.course`] = 'Informe o curso.'
    if (isBlank(item.institution)) errors[`${key}.institution`] = 'Informe a instituição.'
    const period = validatePeriod(item.start, item.end, { allowFutureEnd: true, today })
    if (period.start) errors[`${key}.start`] = period.start
    if (period.end) errors[`${key}.end`] = period.end
  }

  for (const item of resume.certifications ?? []) {
    if (!hasAnyValue(item, ['name', 'issuer', 'issued', 'expires', 'url'])) continue
    const key = `certifications.${item.id}`
    if (isBlank(item.name)) errors[`${key}.name`] = 'Informe o nome da certificação.'
    const dates = validateCertificationDates(item.issued, item.expires, { today })
    if (dates.issued) errors[`${key}.issued`] = dates.issued
    if (dates.expires) errors[`${key}.expires`] = dates.expires
    const urlError = validateUrl(item.url)
    if (urlError) errors[`${key}.url`] = urlError
  }

  for (const item of resume.courses ?? []) {
    if (!hasAnyValue(item, ['name', 'institution', 'hours', 'year'])) continue
    const key = `courses.${item.id}`
    if (isBlank(item.name)) errors[`${key}.name`] = 'Informe o nome do curso.'
    const hoursError = validateHours(item.hours)
    if (hoursError) errors[`${key}.hours`] = hoursError
    const yearError = validateYear(item.year, { today })
    if (yearError) errors[`${key}.year`] = yearError
  }

  for (const item of resume.languages ?? []) {
    if (!hasAnyValue(item, ['language', 'level'])) continue
    if (isBlank(item.language)) errors[`languages.${item.id}.language`] = 'Informe o idioma.'
  }

  for (const item of resume.projects ?? []) {
    if (!hasAnyValue(item, ['name', 'description', 'technologies', 'url'])) continue
    const key = `projects.${item.id}`
    if (isBlank(item.name)) errors[`${key}.name`] = 'Informe o nome do projeto.'
    const urlError = validateUrl(item.url)
    if (urlError) errors[`${key}.url`] = urlError
  }

  return errors
}

// ---------- Gravidade das pendências ----------

// Nome do item em seções opcionais: sem ele o item fica incompleto, mas os dados não estão errados.
const INCOMPLETE_ITEM_FIELDS = new Set(['role', 'company', 'course', 'institution', 'name', 'language'])

/**
 * Gravidade de uma pendência de `validateResume`, pela chave:
 * - 'error': campo obrigatório vazio (nome, contato) ou dado inválido (e-mail, telefone, CEP, data,
 *   link, carga horária, ano). Impede gerar o PDF, que sairia com informação errada;
 * - 'warning': item de seção opcional incompleto (ex.: experiência sem empresa). Pode ser ignorado.
 */
export function errorSeverity(key) {
  const [group, , field] = String(key).split('.')
  return group !== 'personal' && INCOMPLETE_ITEM_FIELDS.has(field) ? 'warning' : 'error'
}

/** Separa as pendências em `blocking` (erros) e `warnings` (avisos), mantendo a ordem. */
export function splitBySeverity(errors) {
  const keys = Object.keys(errors)
  return {
    blocking: keys.filter((key) => errorSeverity(key) === 'error'),
    warnings: keys.filter((key) => errorSeverity(key) === 'warning'),
  }
}
