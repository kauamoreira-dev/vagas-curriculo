import { beforeEach, describe, expect, it } from 'vitest'
import { SAMPLE_RESUME, createEmptyResume } from '@/data/resume'
import { DEFAULT_TEMPLATE_ID } from '@/data/templates'
import { createMemoryStorage, failWritesTo } from '@/test/memoryStorage'
import {
  INDEX_KEY,
  LEGACY_BACKUP_KEY,
  LEGACY_KEY,
  RESUME_PREFIX,
  createResumeStore,
} from './resumeStore'

let clock
const now = () => new Date(Date.UTC(2026, 10, 6, 12, 0, clock++)).toISOString()

function legacyDraft(resume = SAMPLE_RESUME, templateId = 'moderno') {
  return JSON.stringify({ templateId, resume })
}

const resumeKeys = (storage) => [...storage.data.keys()].filter((key) => key.startsWith(RESUME_PREFIX))

beforeEach(() => {
  clock = 0
})

describe('migrateLegacyDraft', () => {
  it('sem rascunho antigo, só cria o índice vazio', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    expect(store.migrateLegacyDraft()).toEqual({ status: 'none' })
    expect(store.listResumes()).toEqual([])
    expect(JSON.parse(storage.getItem(INDEX_KEY))).toMatchObject({ version: 2, items: [] })
  })

  it('converte o rascunho antigo em um currículo e guarda o original como backup', () => {
    const storage = createMemoryStorage()
    const raw = legacyDraft()
    storage.setItem(LEGACY_KEY, raw)
    const store = createResumeStore(storage, { now })

    const result = store.migrateLegacyDraft()
    expect(result.status).toBe('migrated')

    const [item] = store.listResumes()
    expect(item).toMatchObject({
      id: result.id,
      title: 'Marina Albuquerque · Analista de Dados',
      templateId: 'moderno',
      hasPhoto: false,
    })
    const record = store.getResume(result.id)
    expect(record.resume.personal.name).toBe('Marina Albuquerque')
    expect(record.resume.experience).toHaveLength(2)
    expect(storage.getItem(LEGACY_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(raw)
  })

  it('preserva a foto e completa campos ausentes de rascunhos antigos', () => {
    const storage = createMemoryStorage()
    const old = { personal: { name: 'Ana', photo: 'data:image/jpeg;base64,AAAA' }, summary: 'Resumo' }
    storage.setItem(LEGACY_KEY, JSON.stringify({ resume: old }))
    const store = createResumeStore(storage, { now })

    const { id } = store.migrateLegacyDraft()
    const { resume, templateId } = store.getResume(id)
    expect(templateId).toBe('classico')
    expect(resume.personal).toMatchObject({ name: 'Ana', photo: old.personal.photo, photoVisible: true, email: '' })
    expect(resume.experience).toHaveLength(1)
    expect(store.listResumes()[0].hasPhoto).toBe(true)
  })

  it('pode rodar várias vezes sem duplicar', () => {
    const storage = createMemoryStorage()
    storage.setItem(LEGACY_KEY, legacyDraft())
    const store = createResumeStore(storage, { now })
    store.migrateLegacyDraft()
    expect(store.migrateLegacyDraft()).toEqual({ status: 'none' })
    expect(store.listResumes()).toHaveLength(1)
  })

  it('não cria currículo a partir de rascunho vazio ou ilegível, mas guarda o original', () => {
    for (const raw of [legacyDraft(createEmptyResume()), '{corrompido']) {
      const storage = createMemoryStorage()
      storage.setItem(LEGACY_KEY, raw)
      const store = createResumeStore(storage, { now })
      expect(store.migrateLegacyDraft()).toEqual({ status: 'none' })
      expect(store.listResumes()).toEqual([])
      expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(raw)
    }
  })

  it('sem espaço, falha sem tocar no rascunho antigo e o editor ainda o enxerga', () => {
    const raw = legacyDraft()
    const storage = createMemoryStorage({ quota: LEGACY_KEY.length + raw.length + 10 })
    storage.setItem(LEGACY_KEY, raw)
    const store = createResumeStore(storage, { now })

    expect(store.migrateLegacyDraft()).toEqual({ status: 'failed' })
    expect(storage.getItem(LEGACY_KEY)).toBe(raw)
    expect(resumeKeys(storage)).toEqual([])
    expect(store.getUnmigratedLegacy().resume.personal.name).toBe('Marina Albuquerque')
  })

  it('desfaz a gravação parcial se o índice não couber', () => {
    const raw = legacyDraft()
    const storage = createMemoryStorage()
    storage.setItem(LEGACY_KEY, raw)
    const store = createResumeStore(storage, { now })
    failWritesTo(storage, (key) => key === INDEX_KEY)

    expect(store.migrateLegacyDraft()).toEqual({ status: 'failed' })
    expect(resumeKeys(storage)).toEqual([])
    expect(storage.getItem(LEGACY_KEY)).toBe(raw)
  })

  it('importa como novo currículo um rascunho antigo que reaparece (aba antiga aberta)', () => {
    const storage = createMemoryStorage()
    storage.setItem(LEGACY_KEY, legacyDraft())
    const store = createResumeStore(storage, { now })
    store.migrateLegacyDraft()

    const edited = { ...SAMPLE_RESUME, personal: { ...SAMPLE_RESUME.personal, name: 'Marina A. Souza' } }
    storage.setItem(LEGACY_KEY, legacyDraft(edited))
    expect(store.migrateLegacyDraft().status).toBe('recovered')
    expect(store.listResumes().map((item) => item.title)).toEqual([
      'Marina A. Souza · Analista de Dados',
      'Marina Albuquerque · Analista de Dados',
    ])
  })
})

describe('saveResume e listResumes', () => {
  it('grava um currículo novo só no primeiro save e o lista pelo mais recente', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const first = store.newRecord()
    expect(resumeKeys(storage)).toEqual([])

    store.saveResume({ ...first, resume: SAMPLE_RESUME })
    const second = store.saveResume(store.newRecord({ templateId: 'essencial' }))
    expect(store.listResumes().map((item) => item.id)).toEqual([second.id, first.id])

    const updated = store.saveResume({ ...store.getResume(first.id), templateId: 'moderno' })
    expect(store.listResumes().map((item) => item.id)).toEqual([first.id, second.id])
    expect(store.listResumes()[0]).toMatchObject({ templateId: 'moderno', updatedAt: updated.updatedAt })
  })

  it('retorna null quando não há espaço', () => {
    const storage = createMemoryStorage({ quota: 50 })
    const store = createResumeStore(storage, { now })
    expect(store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })).toBeNull()
  })

  it('usa o título escolhido e volta ao gerado quando ele fica vazio', () => {
    const store = createResumeStore(createMemoryStorage(), { now })
    const saved = store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME, title: '  Vaga no banco  ' })
    expect(store.listResumes()[0].title).toBe('Vaga no banco')
    expect(store.getResume(saved.id).title).toBe('  Vaga no banco  ')
    store.saveResume({ ...saved, title: '   ' })
    expect(store.listResumes()[0].title).toBe('Marina Albuquerque · Analista de Dados')
  })

  it('reconcilia índice e currículos gravados', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const kept = store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })
    const lost = store.saveResume(store.newRecord())
    storage.removeItem(RESUME_PREFIX + lost.id) // currículo sumiu: sai da lista
    const orphan = { ...store.newRecord(), resume: SAMPLE_RESUME }
    storage.setItem(RESUME_PREFIX + orphan.id, JSON.stringify(orphan)) // fora do índice: entra na lista
    expect(store.listResumes().map((item) => item.id).sort()).toEqual([kept.id, orphan.id].sort())
  })
})

describe('deleteResume e duplicateResume', () => {
  it('exclui o currículo e o tira da lista', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const first = store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })
    const second = store.saveResume(store.newRecord())
    expect(store.deleteResume(first.id)).toBe(true)
    expect(store.listResumes().map((item) => item.id)).toEqual([second.id])
    expect(store.getResume(first.id)).toBeNull()
  })

  it('duplica com novo id, título "(cópia)" e dados independentes', () => {
    const store = createResumeStore(createMemoryStorage(), { now })
    const original = store.saveResume({ ...store.newRecord({ templateId: 'moderno' }), resume: SAMPLE_RESUME })
    const copy = store.duplicateResume(original.id)

    expect(copy.id).not.toBe(original.id)
    expect(copy).toMatchObject({ templateId: 'moderno', title: 'Marina Albuquerque · Analista de Dados (cópia)' })
    expect(store.listResumes().map((item) => item.id)).toEqual([copy.id, original.id])

    store.saveResume({ ...copy, resume: { ...copy.resume, summary: 'Alterado' } })
    expect(store.getResume(original.id).resume.summary).toBe(SAMPLE_RESUME.summary)
  })

  it('duplicar um id inexistente retorna null', () => {
    const store = createResumeStore(createMemoryStorage(), { now })
    expect(store.duplicateResume('nao-existe')).toBeNull()
  })
})

describe('falhas parciais de gravação', () => {
  it('saveResume retorna null se o índice não couber, mas o currículo fica gravado e volta à lista', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const existing = store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })
    failWritesTo(storage, (key) => key === INDEX_KEY)

    const record = { ...store.newRecord({ templateId: 'moderno' }), resume: SAMPLE_RESUME }
    expect(store.saveResume(record)).toBeNull()
    // Comportamento atual: o null não significa perda de dados — a reconciliação recupera o órfão.
    expect(store.getResume(record.id)?.templateId).toBe('moderno')
    expect(store.listResumes().map((item) => item.id).sort()).toEqual([existing.id, record.id].sort())
  })

  it('deleteResume retorna false se o índice não puder ser regravado, mas o currículo já foi removido', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const kept = store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })
    const removed = store.saveResume(store.newRecord())
    failWritesTo(storage, (key) => key === INDEX_KEY)

    expect(store.deleteResume(removed.id)).toBe(false)
    expect(store.getResume(removed.id)).toBeNull()
    // O índice antigo ainda cita o excluído; a lista o descarta por não achar o currículo.
    expect(JSON.parse(storage.getItem(INDEX_KEY)).items.map((item) => item.id)).toContain(removed.id)
    expect(store.listResumes().map((item) => item.id)).toEqual([kept.id])
  })
})

describe('dados corrompidos', () => {
  it.each([
    ['JSON ilegível', '{quebrado'],
    ['de outra versão', JSON.stringify({ version: 1, items: [] })],
    ['sem itens', JSON.stringify({ version: 2 })],
  ])('com índice %s, reconstrói a lista a partir dos currículos e o próximo save o regrava', (_, raw) => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const first = store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })
    const second = store.saveResume(store.newRecord({ templateId: 'essencial' }))
    storage.setItem(INDEX_KEY, raw)

    expect(store.listResumes().map((item) => item.id)).toEqual([second.id, first.id])

    const third = store.saveResume(store.newRecord())
    const index = JSON.parse(storage.getItem(INDEX_KEY))
    expect(index.version).toBe(2)
    expect(index.items.map((item) => item.id)).toEqual([third.id, second.id, first.id])
  })

  it('ignora currículo gravado com JSON ilegível ou sem id', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const valid = store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })
    storage.setItem(`${RESUME_PREFIX}ilegivel`, '{quebrado')
    storage.setItem(`${RESUME_PREFIX}sem-id`, JSON.stringify({ resume: SAMPLE_RESUME }))

    expect(store.getResume('ilegivel')).toBeNull()
    expect(store.getResume('sem-id')).toBeNull()
    expect(store.listResumes().map((item) => item.id)).toEqual([valid.id])
  })

  it('mantém na lista um item do índice cujo currículo ficou ilegível (abrir dá "não encontrado")', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const saved = store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })
    storage.setItem(RESUME_PREFIX + saved.id, '{quebrado')

    // Comportamento atual: a lista confia no índice enquanto a chave existir.
    expect(store.listResumes().map((item) => item.id)).toEqual([saved.id])
    expect(store.getResume(saved.id)).toBeNull()
  })

  it('troca modelo desconhecido pelo padrão e completa título, datas e campos ausentes', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    const raw = { id: 'antigo', title: 42, templateId: 'inexistente', resume: { personal: { name: 'Ana' } } }
    storage.setItem(`${RESUME_PREFIX}antigo`, JSON.stringify(raw))

    const record = store.getResume('antigo')
    expect(record).toMatchObject({ id: 'antigo', title: '', templateId: DEFAULT_TEMPLATE_ID })
    expect(record.createdAt).toEqual(expect.any(String))
    expect(record.updatedAt).toBe(record.createdAt)
    expect(record.resume.personal).toMatchObject({ name: 'Ana', email: '', photoVisible: true })
    expect(store.listResumes()[0]).toMatchObject({ id: 'antigo', title: 'Ana', templateId: DEFAULT_TEMPLATE_ID })
  })
})

describe('armazenamento indisponível', () => {
  it('nenhuma operação lança erro: listas vazias e gravações retornam null/false', () => {
    const store = createResumeStore(createMemoryStorage({ unavailable: true }), { now })

    expect(store.listResumes()).toEqual([])
    expect(store.getResume('qualquer')).toBeNull()
    expect(store.saveResume({ ...store.newRecord(), resume: SAMPLE_RESUME })).toBeNull()
    expect(store.deleteResume('qualquer')).toBe(false)
    expect(store.duplicateResume('qualquer')).toBeNull()
    expect(store.migrateLegacyDraft()).toEqual({ status: 'none' })
    expect(store.getUnmigratedLegacy()).toBeNull()
  })

  it('newRecord funciona mesmo assim, para o editor abrir um currículo em memória', () => {
    const store = createResumeStore(createMemoryStorage({ unavailable: true }), { now })
    expect(store.newRecord()).toMatchObject({ id: expect.any(String), templateId: DEFAULT_TEMPLATE_ID })
  })
})

describe('backup do rascunho antigo', () => {
  it('se o backup não couber, migra mesmo assim e conclui a remoção do antigo numa próxima execução', () => {
    const storage = createMemoryStorage()
    const raw = legacyDraft()
    storage.setItem(LEGACY_KEY, raw)
    const store = createResumeStore(storage, { now })
    let backupFails = true
    failWritesTo(storage, (key) => backupFails && key === LEGACY_BACKUP_KEY)

    const result = store.migrateLegacyDraft()
    expect(result.status).toBe('migrated')
    expect(storage.getItem(LEGACY_KEY)).toBe(raw) // sem backup, o original não é apagado
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBeNull()
    expect(store.getUnmigratedLegacy()).toBeNull() // o hash no índice o reconhece como já migrado

    backupFails = false
    expect(store.migrateLegacyDraft()).toEqual({ status: 'none' })
    expect(storage.getItem(LEGACY_KEY)).toBeNull()
    expect(storage.getItem(LEGACY_BACKUP_KEY)).toBe(raw)
    expect(store.listResumes().map((item) => item.id)).toEqual([result.id])
  })
})

describe('getUnmigratedLegacy', () => {
  it('retorna null sem rascunho antigo, para rascunho vazio e depois da migração', () => {
    const storage = createMemoryStorage()
    const store = createResumeStore(storage, { now })
    expect(store.getUnmigratedLegacy()).toBeNull()

    storage.setItem(LEGACY_KEY, legacyDraft(createEmptyResume()))
    expect(store.getUnmigratedLegacy()).toBeNull()

    storage.setItem(LEGACY_KEY, legacyDraft())
    store.migrateLegacyDraft()
    expect(store.getUnmigratedLegacy()).toBeNull()
  })

  it('devolve o rascunho como registro em memória, sem gravá-lo', () => {
    const storage = createMemoryStorage()
    storage.setItem(LEGACY_KEY, legacyDraft(SAMPLE_RESUME, 'essencial'))
    const store = createResumeStore(storage, { now })

    const record = store.getUnmigratedLegacy()
    expect(record).toMatchObject({ title: '', templateId: 'essencial' })
    expect(record.resume.personal.name).toBe('Marina Albuquerque')
    expect(resumeKeys(storage)).toEqual([])
  })
})

describe('duplicateResume com foto e título próprio', () => {
  it('copia a foto (e se ela está oculta) e parte do título escolhido pela pessoa', () => {
    const store = createResumeStore(createMemoryStorage(), { now })
    const photo = 'data:image/jpeg;base64,AAAA'
    const original = store.saveResume({
      ...store.newRecord(),
      title: 'Vaga no banco',
      resume: { ...SAMPLE_RESUME, personal: { ...SAMPLE_RESUME.personal, photo, photoVisible: false } },
    })

    const copy = store.duplicateResume(original.id)
    expect(copy.title).toBe('Vaga no banco (cópia)')
    expect(copy.resume.personal).toMatchObject({ photo, photoVisible: false })
    expect(copy.createdAt).not.toBe(original.createdAt)
    expect(store.listResumes().map((item) => [item.title, item.hasPhoto])).toEqual([
      ['Vaga no banco (cópia)', true],
      ['Vaga no banco', true],
    ])
  })
})
