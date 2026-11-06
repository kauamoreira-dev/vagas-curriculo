import { createId } from '@/utils/id'

export function createEmptyExperience() {
  return { id: createId(), role: '', company: '', start: '', end: '', description: '' }
}

export function createEmptyEducation() {
  return { id: createId(), course: '', institution: '', start: '', end: '' }
}

export function createEmptyResume() {
  return {
    personal: {
      name: '',
      title: '',
      email: '',
      phone: '',
      location: '',
      link: '',
      photo: '', // data URL (JPEG em base64) gerada por `preparePhoto`
      photoVisible: true,
    },
    summary: '',
    experience: [createEmptyExperience()],
    education: [createEmptyEducation()],
    skills: '',
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
 * Converte qualquer dado salvo (inclusive de versões antigas ou corrompido) em um currículo
 * no formato atual. Campos ausentes recebem o valor vazio; desconhecidos são descartados.
 */
export function normalizeResume(raw) {
  const empty = createEmptyResume()
  if (!raw || typeof raw !== 'object') return empty
  const personal = {}
  for (const field of Object.keys(empty.personal)) {
    personal[field] =
      field === 'photoVisible' ? raw.personal?.photoVisible !== false : text(raw.personal?.[field])
  }
  return {
    personal,
    summary: text(raw.summary),
    experience: Array.isArray(raw.experience)
      ? raw.experience.map((item) => normalizeItem(item, createEmptyExperience))
      : empty.experience,
    education: Array.isArray(raw.education)
      ? raw.education.map((item) => normalizeItem(item, createEmptyEducation))
      : empty.education,
    skills: text(raw.skills),
  }
}

const filled = (value) => typeof value === 'string' && Boolean(value.trim())
const hasItemText = (item) => Object.entries(item).some(([field, value]) => field !== 'id' && filled(value))

// Algo digitado em qualquer campo (a foto conta; espaços em branco e o booleano photoVisible não).
export function hasResumeContent(resume) {
  return (
    Object.values(resume.personal).some(filled) ||
    filled(resume.summary) ||
    filled(resume.skills) ||
    resume.experience.some(hasItemText) ||
    resume.education.some(hasItemText)
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
    location: 'Belém, PA',
    link: 'linkedin.com/in/exemplo',
    photo: '',
    photoVisible: true,
  },
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
  skills: 'SQL, Power BI, Excel avançado, Python, Comunicação com áreas de negócio',
}
