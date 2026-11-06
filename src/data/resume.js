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
