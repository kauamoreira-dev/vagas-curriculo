import { beforeEach, describe, expect, it } from 'vitest'
import { SAMPLE_RESUME, createEmptyResume } from '@/data/resume'
import {
  INDEX_KEY,
  LEGACY_BACKUP_KEY,
  LEGACY_KEY,
  RESUME_PREFIX,
  createResumeStore,
} from './resumeStore'

// localStorage em memória; `quota` (em caracteres) simula espaço esgotado.
function createMemoryStorage({ quota = Infinity } = {}) {
  const data = new Map()
  const used = () => [...data].reduce((total, [key, value]) => total + key.length + value.length, 0)
  return {
    data,
    get length() {
      return data.size
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem(key, value) {
      const previous = data.get(key)
      const next = used() - (previous ? key.length + previous.length : 0) + key.length + String(value).length
      if (next > quota) throw new DOMException('Sem espaço', 'QuotaExceededError')
      data.set(key, String(value))
    },
    removeItem: (key) => data.delete(key),
  }
}

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
    const original = storage.setItem
    storage.setItem = (key, value) => {
      if (key === INDEX_KEY) throw new DOMException('Sem espaço', 'QuotaExceededError')
      original(key, value)
    }

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
