import { describe, expect, it } from 'vitest'
import { SAMPLE_RESUME, createEmptyResume } from '@/data/resume'
import { createMemoryStorage, failWritesTo } from '@/test/memoryStorage'
import { BACKUP_ERRORS, BACKUP_MAX_BYTES, backupFileName, createBackup, parseBackup } from './backup'
import { RESUME_PREFIX, createResumeStore } from './resumeStore'

const NOW = '2026-11-10T12:00:00.000Z'
const record = (id, overrides = {}) => ({
  id,
  title: '',
  templateId: 'classico',
  createdAt: NOW,
  updatedAt: NOW,
  resume: SAMPLE_RESUME,
  ...overrides,
})
const fileOf = (backup) => JSON.stringify(backup)

describe('createBackup e backupFileName', () => {
  it('gera o arquivo com identificação, versão e os currículos completos', () => {
    const backup = createBackup([record('a')], NOW)
    expect(backup).toMatchObject({ app: 'curriculo-tapajos', type: 'backup', version: 1, exportedAt: NOW })
    expect(backup.resumes).toEqual([record('a')])
  })

  it('nome do arquivo com a data', () => {
    expect(backupFileName(new Date(2026, 0, 5))).toBe('curriculos-tapajos-2026-01-05.json')
  })
})

describe('parseBackup', () => {
  it('lê um backup válido, de volta igual ao que foi exportado', () => {
    const result = parseBackup(fileOf(createBackup([record('a'), record('b', { title: 'Vaga X' })], NOW)))
    expect(result.records).toEqual([record('a'), record('b', { title: 'Vaga X' })])
    expect(result).toMatchObject({ skipped: 0, exportedAt: NOW })
  })

  it.each([
    ['texto que não é JSON', '{ isso não é json', BACKUP_ERRORS.notJson],
    ['JSON de outro app', JSON.stringify({ app: 'outro', type: 'backup', version: 1, resumes: [] }), BACKUP_ERRORS.notBackup],
    ['currículo solto, sem o envelope do backup', JSON.stringify(SAMPLE_RESUME), BACKUP_ERRORS.notBackup],
    ['versão mais nova do formato', JSON.stringify({ ...createBackup([record('a')]), version: 2 }), BACKUP_ERRORS.newerVersion],
    ['backup sem nenhum currículo válido', JSON.stringify(createBackup([])), BACKUP_ERRORS.empty],
  ])('recusa %s com mensagem clara', (_, text, error) => {
    expect(parseBackup(text)).toEqual({ error })
  })

  it('recusa arquivo grande demais', () => {
    expect(parseBackup('x'.repeat(BACKUP_MAX_BYTES + 1))).toEqual({ error: BACKUP_ERRORS.tooLarge })
  })

  it('ignora itens inválidos e ids repetidos, contando quantos', () => {
    const backup = createBackup([record('a')])
    backup.resumes.push(null, { id: '', resume: {} }, { id: 'sem-dados' }, record('a', { title: 'repetido' }))
    const result = parseBackup(fileOf(backup))
    expect(result.records.map((item) => item.id)).toEqual(['a'])
    expect(result.skipped).toBe(4)
  })

  it('ignora ids fora do formato do site (iriam para a URL e a chave do armazenamento)', () => {
    const backup = createBackup([record('a1-B_2'), record('x/y'), record('?q'), record('%'), record(' a '), record('z'.repeat(65))])
    const result = parseBackup(fileOf(backup))
    expect(result.records.map((item) => item.id)).toEqual(['a1-B_2'])
    expect(result.skipped).toBe(5)
  })

  it('normaliza cada currículo: campos desconhecidos saem, formato antigo é convertido', () => {
    const backup = createBackup([
      record('a', {
        templateId: 'inexistente',
        createdAt: 'ontem',
        resume: { personal: { name: 'Ana', location: 'Belém, PA', script: '<script>' }, skills: 'SQL, Excel', extra: 1 },
      }),
    ])
    const [item] = parseBackup(fileOf(backup), { now: () => NOW }).records
    expect(item.templateId).toBe('classico')
    expect(item.createdAt).toBe(NOW)
    expect(item.resume.personal).toMatchObject({ name: 'Ana', city: 'Belém', state: 'PA' })
    expect(item.resume.personal).not.toHaveProperty('script')
    expect(item.resume).not.toHaveProperty('extra')
    expect(item.resume.skills).toEqual(['SQL', 'Excel'])
  })

  it('aceita só foto embutida como imagem; outros endereços são descartados', () => {
    const withPhoto = (photo) =>
      parseBackup(fileOf(createBackup([record('a', { resume: { ...SAMPLE_RESUME, personal: { ...SAMPLE_RESUME.personal, photo } } })])))
        .records[0].resume.personal.photo
    expect(withPhoto('data:image/jpeg;base64,AAAA')).toBe('data:image/jpeg;base64,AAAA')
    expect(withPhoto('javascript:alert(1)')).toBe('')
    expect(withPhoto('https://exemplo.com/rastreio.png')).toBe('')
    expect(withPhoto('data:text/html;base64,PHNjcmlwdD4=')).toBe('')
  })
})

describe('restaurar no resumeStore (planImport + importPlan)', () => {
  function setup(options) {
    const storage = createMemoryStorage(options)
    let clock = 0
    const store = createResumeStore(storage, { now: () => new Date(Date.UTC(2026, 10, 10, 12, 0, clock++)).toISOString() })
    return { storage, store }
  }

  it('novo entra com o mesmo id; igual é ignorado; diferente entra como cópia, sem substituir', () => {
    const { store } = setup()
    const mine = store.saveResume(record('mesmo', { title: 'Meu' }))
    const changed = store.saveResume(record('diferente', { title: 'Daqui' }))
    const file = parseBackup(
      fileOf(
        createBackup([
          record('novo', { title: 'Novo' }),
          { ...mine },
          record('diferente', { title: 'Do arquivo', resume: createEmptyResume() }),
        ]),
      ),
    ).records

    const plan = store.planImport(file)
    expect(plan.map((item) => item.action)).toEqual(['new', 'same', 'copy'])

    expect(store.importPlan(plan)).toEqual({ imported: 2, failed: 0 })
    const titles = store.listResumes().map((item) => item.title).sort()
    expect(titles).toEqual(['Daqui', 'Do arquivo (restaurado)', 'Meu', 'Novo'])
    // O daqui continua igual.
    expect(store.getResume('diferente')).toMatchObject({ title: 'Daqui', resume: changed.resume })
  })

  it('restaurar o mesmo arquivo duas vezes não duplica nada', () => {
    const { store } = setup()
    const file = parseBackup(fileOf(createBackup([record('a'), record('b')]))).records
    store.importPlan(store.planImport(file))
    const again = store.planImport(file)
    expect(again.map((item) => item.action)).toEqual(['same', 'same'])
    expect(store.importPlan(again)).toEqual({ imported: 0, failed: 0 })
    expect(store.listResumes()).toHaveLength(2)
  })

  it('sem espaço no meio da restauração: para, mantém o que entrou e informa o que faltou', () => {
    const { storage, store } = setup()
    const file = parseBackup(fileOf(createBackup([record('a'), record('b'), record('c')]))).records
    let writes = 0
    failWritesTo(storage, (key) => key.startsWith(RESUME_PREFIX) && ++writes > 1)
    expect(store.importPlan(store.planImport(file))).toEqual({ imported: 1, failed: 2 })
    expect(store.getResume('a')).not.toBeNull()
    expect(store.getResume('b')).toBeNull()
  })

  it('exportRecords devolve todos os currículos completos', () => {
    const { store } = setup()
    store.saveResume(record('a'))
    store.saveResume(record('b'))
    expect(store.exportRecords().map((item) => item.id).sort()).toEqual(['a', 'b'])
    expect(store.exportRecords()[0].resume.personal.name).toBe('Marina Albuquerque')
  })

  it('restaurar de novo um arquivo com versão diferente não cria outra cópia (nem após falta de espaço)', () => {
    const { store } = setup()
    store.saveResume(record('a', { title: 'Daqui' }))
    const file = parseBackup(fileOf(createBackup([record('a', { title: 'Do arquivo', resume: createEmptyResume() })]))).records
    expect(store.importPlan(store.planImport(file))).toEqual({ imported: 1, failed: 0 })
    const again = store.planImport(file)
    expect(again.map((item) => item.action)).toEqual(['same'])
    expect(store.importPlan(again)).toEqual({ imported: 0, failed: 0 })
    expect(store.listResumes().map((item) => item.title).sort()).toEqual(['Daqui', 'Do arquivo (restaurado)'])
  })
})
