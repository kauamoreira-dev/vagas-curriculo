import { describe, expect, it } from 'vitest'
import {
  formatPhone,
  formatZip,
  normalizeLine,
  normalizeMultiline,
  parseResumeDate,
  validateEmail,
  validatePeriod,
  validateCertificationDates,
  validateHours,
  validatePhone,
  validateResume,
  validateUrl,
  validateYear,
  validateZip,
} from './validation'

// Data fixa para que os testes de "futuro" não dependam do dia em que rodam (nov/2026).
const today = new Date(2026, 10, 6)

describe('validateEmail', () => {
  it.each(['nome@email.com', 'a.b+c@empresa.com.br', '  nome@email.com ', ''])(
    'aceita %j',
    (email) => {
      expect(validateEmail(email)).toBeNull()
    },
  )

  it.each([
    'nome',
    'nome@',
    'nome@email',
    'nome@email.c',
    'no me@email.com',
    'nome@@email.com',
    'nome@email..com',
    'nome@.com',
  ])('rejeita %j', (email) => {
    expect(validateEmail(email)).toEqual(expect.any(String))
  })

  it('avisa quando falta o @', () => {
    expect(validateEmail('nome.email.com')).toMatch('precisa ter')
  })
})

describe('formatPhone', () => {
  it('formata progressivamente enquanto a pessoa digita', () => {
    const typed = ['1', '11', '119', '11912', '119123', '1191234', '1191234567', '11912345678']
    const expected = [
      '(1',
      '(11',
      '(11) 9',
      '(11) 912',
      '(11) 9123',
      '(11) 9123-4',
      '(11) 9123-4567',
      '(11) 91234-5678',
    ]
    expect(typed.map(formatPhone)).toEqual(expected)
  })

  it('não deixa separador no fim, para o Backspace não travar', () => {
    expect(formatPhone('(11) ')).toBe('(11')
    expect(formatPhone('(11) 9123-')).toBe('(11) 9123')
    expect(formatPhone('')).toBe('')
  })

  it('limita a 11 dígitos nacionais', () => {
    expect(formatPhone('119123456789')).toBe('(11) 91234-5678')
  })

  it('reformata números colados', () => {
    expect(formatPhone('11 3456 7890')).toBe('(11) 3456-7890')
    expect(formatPhone('+55 11 91234-5678')).toBe('+55 (11) 91234-5678')
  })

  it('mantém como digitado o código de país incompleto ou estrangeiro', () => {
    expect(formatPhone('+5')).toBe('+5')
    expect(formatPhone('+1 212 555')).toBe('+1 212 555')
  })
})

describe('validatePhone', () => {
  it.each(['(11) 91234-5678', '(91) 3222-1234', '+55 (11) 91234-5678', '(91) 90000-0000', ''])(
    'aceita %j',
    (phone) => {
      expect(validatePhone(phone)).toBeNull()
    },
  )

  it.each([
    ['(11) 9123', 'incompleto'],
    ['(00) 00000-0000', 'DDD'],
    ['(10) 91234-5678', 'DDD'],
    ['(11) 81234-5678', 'começar com 9'],
    ['(11) 9123-4567', 'fixo'],
    ['+1 212 555 1234', 'brasileiro'],
  ])('rejeita %j', (phone, message) => {
    expect(validatePhone(phone)).toMatch(message)
  })
})

describe('parseResumeDate', () => {
  it.each([
    ['mar/2022', { year: 2022, month: 3 }],
    ['03/2022', { year: 2022, month: 3 }],
    ['Março de 2022', { year: 2022, month: 3 }],
    ['set. 2020', { year: 2020, month: 9 }],
    ['2019', { year: 2019, month: null }],
    ['Atual', { ongoing: true }],
    ['Em andamento', { ongoing: true }],
    ['  ', { empty: true }],
  ])('interpreta %j', (text, expected) => {
    expect(parseResumeDate(text)).toEqual(expected)
  })

  it.each(['13/2022', 'xyz/2022', 'ontem', '22', '03/22', '1900'])('rejeita %j', (text) => {
    expect(parseResumeDate(text).error).toEqual(expect.any(String))
  })
})

describe('validatePeriod', () => {
  const period = (start, end, options = {}) => validatePeriod(start, end, { today, ...options })

  it('aceita datas vazias, períodos em curso e granularidades diferentes', () => {
    expect(period('', '')).toEqual({})
    expect(period('mar/2022', 'Atual')).toEqual({})
    expect(period('2022', 'mar/2022')).toEqual({})
    expect(period('', 'fev/2023')).toEqual({})
    expect(period('nov/2026', '')).toEqual({})
  })

  it('rejeita fim anterior ao início', () => {
    expect(period('mar/2022', 'fev/2022').end).toMatch('anterior')
    expect(period('2023', '2021').end).toMatch('anterior')
  })

  it('rejeita "Atual" no início e início no futuro', () => {
    expect(period('Atual', '').start).toEqual(expect.any(String))
    expect(period('dez/2026', '').start).toMatch('futuro')
  })

  it('só permite fim no futuro quando indicado (formação)', () => {
    expect(period('2020', '2028').end).toMatch('futuro')
    expect(period('2024', '2028', { allowFutureEnd: true })).toEqual({})
    expect(period('2024', '2099', { allowFutureEnd: true }).end).toEqual(expect.any(String))
  })
})

describe('validateResume', () => {
  function emptyResume() {
    return {
      personal: { name: '', title: '', email: '', phone: '', location: '', link: '' },
      summary: '',
      skills: '',
      experience: [{ id: 'e1', role: '', company: '', start: '', end: '', description: '' }],
      education: [{ id: 'f1', course: '', institution: '', start: '', end: '' }],
    }
  }

  it('exige nome e ao menos um contato', () => {
    expect(Object.keys(validateResume(emptyResume(), { today })).sort()).toEqual([
      'personal.email',
      'personal.name',
    ])
  })

  it('aceita currículo com nome e só telefone, ignorando itens vazios', () => {
    const resume = emptyResume()
    resume.personal.name = 'Ana'
    resume.personal.phone = '(91) 98888-7777'
    expect(validateResume(resume, { today })).toEqual({})
  })

  it('trata item só com espaços como vazio', () => {
    const resume = emptyResume()
    resume.personal.name = 'Ana'
    resume.personal.email = 'ana@email.com'
    resume.experience[0].role = '   '
    expect(validateResume(resume, { today })).toEqual({})
  })

  it('exige cargo e empresa, ou curso e instituição, quando o item foi iniciado', () => {
    const resume = emptyResume()
    resume.personal.name = 'Ana'
    resume.personal.email = 'ana@email.com'
    resume.experience[0].start = '2024'
    resume.education[0].course = 'ADS'
    resume.education[0].end = 'Cursando'
    expect(Object.keys(validateResume(resume, { today })).sort()).toEqual([
      'education.f1.institution',
      'experience.e1.company',
      'experience.e1.role',
    ])
  })
})

describe('normalização de espaços', () => {
  it('normalizeLine remove espaços nas pontas e repetidos', () => {
    expect(normalizeLine('  Ana   Maria  ')).toBe('Ana Maria')
  })

  it('normalizeMultiline limpa cada linha e limita linhas vazias seguidas', () => {
    expect(normalizeMultiline('  linha 1  \n\n\n\n  linha  2 \n')).toBe('linha 1\n\nlinha 2')
  })
})

describe('CEP', () => {
  it('formata enquanto a pessoa digita e limita a 8 dígitos', () => {
    expect(formatZip('66')).toBe('66')
    expect(formatZip('66010')).toBe('66010')
    expect(formatZip('660100')).toBe('66010-0')
    expect(formatZip('66010000999')).toBe('66010-000')
    expect(formatZip('66.010-000')).toBe('66010-000')
  })

  it('aceita vazio ou 8 dígitos', () => {
    expect(validateZip('')).toBeNull()
    expect(validateZip('66010-000')).toBeNull()
    expect(validateZip('66010')).toMatch(/8 dígitos/)
  })
})

describe('validateUrl', () => {
  it.each(['', 'github.com/ana', 'https://www.credly.com/badges/abc?x=1', 'http://site.com.br'])('aceita %j', (url) => {
    expect(validateUrl(url)).toBeNull()
  })

  it.each(['github', 'ana@email.com', 'https://', 'site .com'])('rejeita %j', (url) => {
    expect(validateUrl(url)).toMatch(/Link inválido/)
  })
})

describe('validateHours e validateYear', () => {
  it('carga horária: só o número, com "h" opcional', () => {
    expect(validateHours('')).toBeNull()
    expect(validateHours('40')).toBeNull()
    expect(validateHours('40h')).toBeNull()
    expect(validateHours('120 horas')).toBeNull()
    expect(validateHours('0')).toMatch(/número de horas/)
    expect(validateHours('quarenta')).toMatch(/número de horas/)
  })

  it('ano com 4 dígitos, de 1950 até 10 anos à frente', () => {
    expect(validateYear('', { today })).toBeNull()
    expect(validateYear('2022', { today })).toBeNull()
    expect(validateYear('2027', { today })).toBeNull()
    expect(validateYear('22', { today })).toMatch(/4 dígitos/)
    expect(validateYear('1900', { today })).toMatch(/Confira/)
    expect(validateYear('2040', { today })).toMatch(/Confira/)
  })
})

describe('validateCertificationDates', () => {
  it('aceita datas vazias, validade futura e granularidades diferentes', () => {
    expect(validateCertificationDates('', '', { today })).toEqual({})
    expect(validateCertificationDates('jun/2024', 'jun/2027', { today })).toEqual({})
    expect(validateCertificationDates('2024', '', { today })).toEqual({})
  })

  it('rejeita emissão futura, validade anterior à emissão e formatos inválidos', () => {
    expect(validateCertificationDates('2030', '', { today }).issued).toMatch(/futuro/)
    expect(validateCertificationDates('jun/2024', 'jan/2024', { today }).expires).toMatch(/anterior à emissão/)
    expect(validateCertificationDates('ontem', 'Atual', { today })).toEqual({
      issued: expect.stringMatching(/não reconhecido/),
      expires: expect.stringMatching(/validade/),
    })
  })
})

describe('validateResume — seções novas e endereço', () => {
  function validResume(overrides = {}) {
    return {
      personal: { name: 'Ana', email: 'ana@email.com', phone: '', zip: '' },
      experience: [],
      education: [],
      certifications: [],
      courses: [],
      languages: [],
      projects: [],
      ...overrides,
    }
  }

  it('seções novas vazias, itens vazios e endereço em branco não geram pendência', () => {
    const resume = validResume({
      certifications: [{ id: 'c1', name: '', issuer: '', issued: '', expires: '', url: '' }],
      courses: [{ id: 'k1', name: '', institution: '', hours: '', year: '' }],
      languages: [{ id: 'l1', language: '', level: '' }],
      projects: [{ id: 'p1', name: '', description: ' ', technologies: '', url: '' }],
    })
    expect(validateResume(resume, { today })).toEqual({})
  })

  it('aceita currículo antigo, sem as listas novas', () => {
    const { certifications, courses, languages, projects, ...old } = validResume()
    expect([certifications, courses, languages, projects].every(Array.isArray)).toBe(true)
    expect(validateResume(old, { today })).toEqual({})
  })

  it('aponta cada campo inválido das seções novas pela chave do item', () => {
    const resume = validResume({
      personal: { name: 'Ana', email: 'ana@email.com', zip: '660' },
      certifications: [{ id: 'c1', name: '', issuer: 'AWS', issued: '2030', expires: '', url: 'aws' }],
      courses: [{ id: 'k1', name: '', institution: 'Senac', hours: 'muitas', year: '22' }],
      languages: [{ id: 'l1', language: '', level: 'Básico' }],
      projects: [{ id: 'p1', name: '', description: 'App', technologies: '', url: 'meu app' }],
    })
    expect(Object.keys(validateResume(resume, { today })).sort()).toEqual([
      'certifications.c1.issued',
      'certifications.c1.name',
      'certifications.c1.url',
      'courses.k1.hours',
      'courses.k1.name',
      'courses.k1.year',
      'languages.l1.language',
      'personal.zip',
      'projects.p1.name',
      'projects.p1.url',
    ])
  })
})
