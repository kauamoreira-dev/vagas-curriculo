import { describe, expect, it } from 'vitest'
import {
  formatPhone,
  normalizeLine,
  normalizeMultiline,
  parseResumeDate,
  validateEmail,
  validatePeriod,
  validatePhone,
  validateResume,
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
