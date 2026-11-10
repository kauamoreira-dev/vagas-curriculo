import { createId } from '@/utils/id'
import { splitSkills } from '@/utils/resumeText'

export function createEmptyExperience() {
  return { id: createId(), role: '', company: '', start: '', end: '', description: '' }
}

export function createEmptyEducation() {
  return { id: createId(), course: '', institution: '', start: '', end: '' }
}

export function createEmptyCertification() {
  return { id: createId(), name: '', issuer: '', issued: '', expires: '', url: '' }
}

export function createEmptyCourse() {
  return { id: createId(), name: '', institution: '', hours: '', year: '' }
}

export function createEmptyLanguage() {
  return { id: createId(), language: '', level: '' }
}

export function createEmptyProject() {
  return { id: createId(), name: '', description: '', technologies: '', url: '' }
}

/** Seções com itens repetíveis (adicionar, editar, excluir e reordenar) e o item vazio de cada uma. */
export const ITEM_FACTORIES = {
  experience: createEmptyExperience,
  education: createEmptyEducation,
  certifications: createEmptyCertification,
  courses: createEmptyCourse,
  languages: createEmptyLanguage,
  projects: createEmptyProject,
}

export const LIST_SECTIONS = Object.keys(ITEM_FACTORIES)

// Listas de habilidades: técnicas (`skills`) e comportamentais (`softSkills`), uma por item.
export const SKILL_LISTS = ['skills', 'softSkills']

export const LANGUAGE_LEVELS = ['Básico', 'Intermediário', 'Avançado', 'Fluente', 'Nativo']

export const STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]

export function createEmptyResume() {
  return {
    personal: {
      name: '',
      title: '',
      email: '',
      phone: '',
      birthDate: '', // AAAA-MM-DD (campo de data) ou DD/MM/AAAA; o currículo mostra a idade
      ageVisible: true,
      city: '',
      state: '',
      street: '',
      number: '',
      complement: '',
      district: '',
      zip: '',
      // 'city': o currículo mostra só cidade/UF; 'full': o endereço completo preenchido.
      addressDisplay: 'city',
      link: '',
      photo: '', // data URL (JPEG em base64) gerada por `preparePhoto`
      photoVisible: true,
    },
    objective: '',
    summary: '',
    experience: [createEmptyExperience()],
    education: [createEmptyEducation()],
    certifications: [],
    courses: [],
    projects: [],
    skills: [],
    softSkills: [],
    languages: [],
    additionalInfo: '',
  }
}

const text = (value) => (typeof value === 'string' ? value : '')

// Mantém só os campos conhecidos do item, como texto, e garante um id.
function normalizeItem(item, createEmpty) {
  const base = createEmpty()
  const normalized = { id: typeof item?.id === 'string' && item.id ? item.id : base.id }
  for (const field of Object.keys(base)) {
    if (field !== 'id') normalized[field] = text(item?.[field])
  }
  return normalized
}

/**
 * Lista de habilidades. Aceita também o formato antigo (um texto separado por vírgula ou linha).
 * Espaços nas pontas e itens vazios são descartados; repetidos ficam, como a pessoa digitou.
 */
export function normalizeSkillList(value) {
  if (!Array.isArray(value)) return splitSkills(text(value))
  return value.filter((item) => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
}

const LOCATION_PATTERN = /^(.+?)\s*(?:,|\s-\s|–|\/|\()\s*([a-z]{2})\)?$/i

/**
 * Formato antigo: um único campo livre `location` (ex.: "Belém, PA"). Separa a cidade da UF
 * quando é possível reconhecer a sigla; senão, o texto inteiro vira a cidade (nada se perde).
 */
export function splitLocation(location) {
  const value = text(location).trim()
  const match = value.match(LOCATION_PATTERN)
  if (match && STATES.includes(match[2].toUpperCase())) {
    return { city: match[1].trim(), state: match[2].toUpperCase() }
  }
  return { city: value, state: '' }
}

function normalizePersonal(raw, empty) {
  const personal = {}
  for (const field of Object.keys(empty)) personal[field] = text(raw?.[field])
  personal.photoVisible = raw?.photoVisible !== false
  personal.ageVisible = raw?.ageVisible !== false
  personal.addressDisplay = raw?.addressDisplay === 'full' ? 'full' : 'city'
  personal.state = STATES.includes(personal.state) ? personal.state : ''
  // Currículos salvos antes da separação em cidade e estado.
  if (!('city' in Object(raw)) && !('state' in Object(raw)) && text(raw?.location).trim()) {
    Object.assign(personal, splitLocation(raw.location))
  }
  return personal
}

/**
 * Converte qualquer dado salvo (inclusive de versões antigas ou corrompido) em um currículo
 * no formato atual. Campos ausentes recebem o valor vazio; desconhecidos são descartados.
 */
export function normalizeResume(raw) {
  const empty = createEmptyResume()
  if (!raw || typeof raw !== 'object') return empty
  const resume = {
    personal: normalizePersonal(raw.personal, empty.personal),
    objective: text(raw.objective),
    summary: text(raw.summary),
    additionalInfo: text(raw.additionalInfo),
  }
  for (const section of LIST_SECTIONS) {
    resume[section] = Array.isArray(raw[section])
      ? raw[section].map((item) => normalizeItem(item, ITEM_FACTORIES[section]))
      : empty[section]
  }
  for (const list of SKILL_LISTS) resume[list] = normalizeSkillList(raw[list])
  // Mesma ordem de chaves do currículo vazio.
  return Object.fromEntries(Object.keys(empty).map((key) => [key, resume[key]]))
}

const filled = (value) => typeof value === 'string' && Boolean(value.trim())
const hasItemText = (item) => Object.entries(item).some(([field, value]) => field !== 'id' && filled(value))
// Preferências de exibição não são conteúdo digitado.
const PERSONAL_SETTINGS = ['photoVisible', 'ageVisible', 'addressDisplay']

// Algo digitado em qualquer campo (a foto conta; espaços em branco e as preferências de exibição não).
export function hasResumeContent(resume) {
  return (
    Object.entries(resume.personal).some(([field, value]) => !PERSONAL_SETTINGS.includes(field) && filled(value)) ||
    filled(resume.objective) ||
    filled(resume.summary) ||
    filled(resume.additionalInfo) ||
    SKILL_LISTS.some((list) => resume[list].some(filled)) ||
    LIST_SECTIONS.some((section) => resume[section].some(hasItemText))
  )
}

// Título exibido na lista de currículos, derivado do nome e do cargo.
export function resumeTitle(resume) {
  const name = text(resume?.personal?.name).trim()
  const title = text(resume?.personal?.title).trim()
  if (name && title) return `${name} · ${title}`
  return name || title || 'Currículo sem título'
}

// Conteúdo fictício, usado apenas para demonstrar os modelos.
export const SAMPLE_RESUME = {
  personal: {
    name: 'Marina Albuquerque',
    title: 'Analista de Dados',
    email: 'marina.exemplo@email.com',
    phone: '(91) 90000-0000',
    birthDate: '',
    ageVisible: true,
    city: 'Belém',
    state: 'PA',
    street: '',
    number: '',
    complement: '',
    district: '',
    zip: '',
    addressDisplay: 'city',
    link: 'linkedin.com/in/exemplo',
    photo: '',
    photoVisible: true,
  },
  objective: '',
  summary:
    'Analista com quatro anos de experiência em indicadores comerciais e logísticos. Organizo bases, construo painéis e traduzo números em decisões para equipes não técnicas.',
  experience: [
    {
      id: 'exemplo-exp-1',
      role: 'Analista de Dados Pleno',
      company: 'Cooperativa Rio Claro',
      start: 'mar/2023',
      end: 'Atual',
      description:
        'Reestruturei o painel de vendas usado por 12 filiais\nAutomatizei o fechamento mensal, reduzindo de 3 dias para 4 horas\nTreinei a equipe comercial na leitura dos indicadores',
    },
    {
      id: 'exemplo-exp-2',
      role: 'Assistente de Planejamento',
      company: 'Grupo Varanda Distribuição',
      start: 'fev/2021',
      end: 'fev/2023',
      description:
        'Mantive a base de estoque e as previsões semanais de reposição\nPadronizei relatórios entre três centros de distribuição',
    },
  ],
  education: [
    {
      id: 'exemplo-edu-1',
      course: 'Bacharelado em Estatística',
      institution: 'Universidade Federal (exemplo)',
      start: '2016',
      end: '2020',
    },
  ],
  certifications: [
    {
      id: 'exemplo-cert-1',
      name: 'Certificação em Análise de Dados',
      issuer: 'Instituto de Tecnologia (exemplo)',
      issued: 'jun/2024',
      expires: '',
      url: '',
    },
  ],
  courses: [
    {
      id: 'exemplo-curso-1',
      name: 'Visualização de Dados para Negócios',
      institution: 'Escola Aberta (exemplo)',
      hours: '40',
      year: '2022',
    },
  ],
  projects: [],
  skills: ['SQL', 'Power BI', 'Excel avançado', 'Python'],
  softSkills: ['Comunicação com áreas de negócio'],
  languages: [
    { id: 'exemplo-idioma-1', language: 'Inglês', level: 'Intermediário' },
  ],
  additionalInfo: '',
}
