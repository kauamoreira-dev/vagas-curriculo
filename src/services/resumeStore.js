import { createEmptyResume, hasResumeContent, normalizeResume, resumeTitle } from '@/data/resume'
import { DEFAULT_TEMPLATE_ID, getTemplate } from '@/data/templates'
import { createId } from '@/utils/id'
import { listKeys, readJSON, readText, removeKey, writeJSON, writeText } from '@/utils/storage'

/**
 * Currículos salvos no navegador (localStorage), formato v2:
 * - INDEX_KEY: { version: 2, legacyHash, items: [{ id, title, templateId, createdAt, updatedAt, hasPhoto }] }
 *   Resumo leve para listar sem carregar fotos.
 * - RESUME_PREFIX + id: { id, templateId, createdAt, updatedAt, resume } — os dados completos.
 * O currículo é gravado antes do índice; na leitura, os dois são reconciliados.
 */
export const LEGACY_KEY = 'vagas-curriculo:rascunho:v1'
export const LEGACY_BACKUP_KEY = `${LEGACY_KEY}:backup`
export const INDEX_KEY = 'vagas-curriculo:v2:indice'
export const RESUME_PREFIX = 'vagas-curriculo:v2:curriculo:'

// Hash curto (djb2) para reconhecer um rascunho antigo já migrado sem guardar outra cópia dele.
function hashText(value) {
  let hash = 5381
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0
  }
  return `${value.length}:${(hash >>> 0).toString(36)}`
}

function normalizeRecord(raw, fallbackDate) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !raw.id) return null
  return {
    id: raw.id,
    templateId: getTemplate(raw.templateId) ? raw.templateId : DEFAULT_TEMPLATE_ID,
    createdAt: typeof raw.createdAt === 'string' ? raw.createdAt : fallbackDate,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : fallbackDate,
    resume: normalizeResume(raw.resume),
  }
}

function summarize(record) {
  return {
    id: record.id,
    title: resumeTitle(record.resume),
    templateId: record.templateId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    hasPhoto: Boolean(record.resume.personal.photo),
  }
}

const byMostRecent = (a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0)

export function createResumeStore(storage, { now = () => new Date().toISOString() } = {}) {
  const resumeKey = (id) => RESUME_PREFIX + id

  // Grava e confere lendo de volta: só então a etapa seguinte da migração pode prosseguir.
  function writeVerified(key, value) {
    const serialized = JSON.stringify(value)
    return writeText(key, serialized, storage) && readText(key, storage) === serialized
  }

  function readIndex() {
    const index = readJSON(INDEX_KEY, storage)
    if (!index || index.version !== 2 || !Array.isArray(index.items)) return null
    return index
  }

  function getResume(id) {
    return normalizeRecord(readJSON(resumeKey(id), storage), now())
  }

  /**
   * Lista os currículos, do mais recente para o mais antigo. Descarta itens do índice cujo
   * currículo sumiu e recupera currículos gravados que ficaram fora do índice.
   */
  function listResumes() {
    const index = readIndex()
    const stored = new Set(listKeys(RESUME_PREFIX, storage).map((key) => key.slice(RESUME_PREFIX.length)))
    const items = (index?.items ?? []).filter((item) => item && stored.has(item.id))
    const known = new Set(items.map((item) => item.id))
    for (const id of stored) {
      if (known.has(id)) continue
      const record = getResume(id)
      if (record) items.push(summarize(record))
    }
    return items.sort(byMostRecent)
  }

  function writeIndex(items, extra = {}) {
    const current = readIndex()
    return writeJSON(
      INDEX_KEY,
      { version: 2, legacyHash: current?.legacyHash ?? null, ...extra, items },
      storage,
    )
  }

  // Novo currículo em memória; só é gravado no primeiro `saveResume`.
  function newRecord({ templateId = DEFAULT_TEMPLATE_ID, resume = createEmptyResume() } = {}) {
    const date = now()
    return { id: createId(), templateId, createdAt: date, updatedAt: date, resume }
  }

  /** Grava (ou cria) o currículo e atualiza o índice. Retorna o registro salvo ou null se falhar. */
  function saveResume(record) {
    const saved = { ...record, updatedAt: now() }
    if (!writeJSON(resumeKey(saved.id), saved, storage)) return null
    const items = listResumes().filter((item) => item.id !== saved.id)
    if (!writeIndex([summarize(saved), ...items])) return null
    return saved
  }

  function moveLegacyToBackup(raw) {
    if (writeText(LEGACY_BACKUP_KEY, raw, storage)) removeKey(LEGACY_KEY, storage)
  }

  function parseLegacy(raw) {
    let legacy = null
    try {
      legacy = JSON.parse(raw)
    } catch {
      // Rascunho ilegível: não há o que aproveitar, mas o original fica guardado no backup.
    }
    const resume = normalizeResume(legacy?.resume)
    const templateId = getTemplate(legacy?.templateId) ? legacy.templateId : DEFAULT_TEMPLATE_ID
    return { resume, templateId }
  }

  /**
   * Rascunho antigo ainda não migrado (ex.: a migração falhou por falta de espaço), como
   * registro em memória. Permite que o editor mostre os dados em vez de abrir vazio.
   */
  function getUnmigratedLegacy() {
    const raw = readText(LEGACY_KEY, storage)
    if (raw === null || readIndex()?.legacyHash === hashText(raw)) return null
    const legacy = parseLegacy(raw)
    return hasResumeContent(legacy.resume) ? newRecord(legacy) : null
  }

  /**
   * Migra o rascunho único do formato v1 para a lista v2. Pode rodar a cada carregamento:
   * - nada a migrar → status 'none';
   * - rascunho antigo convertido em currículo → 'migrated' (o original vai para LEGACY_BACKUP_KEY);
   * - rascunho antigo reapareceu depois da migração (aba antiga aberta) → 'recovered', como novo currículo;
   * - falha ao gravar → 'failed', sem tocar no rascunho antigo (tenta de novo no próximo carregamento).
   */
  function migrateLegacyDraft() {
    const index = readIndex()
    const raw = readText(LEGACY_KEY, storage)

    if (raw === null) {
      if (!index) writeIndex([])
      return { status: 'none' }
    }

    const hash = hashText(raw)
    if (index && index.legacyHash === hash) {
      moveLegacyToBackup(raw) // migração anterior não chegou a guardar o backup
      return { status: 'none' }
    }

    const legacy = parseLegacy(raw)
    if (!hasResumeContent(legacy.resume)) {
      if (writeIndex(index ? listResumes() : [], { legacyHash: hash })) moveLegacyToBackup(raw)
      return { status: 'none' }
    }

    const record = newRecord(legacy)
    if (!writeVerified(resumeKey(record.id), record)) {
      removeKey(resumeKey(record.id), storage)
      return { status: 'failed' }
    }
    const items = [summarize(record), ...(index ? listResumes().filter((item) => item.id !== record.id) : [])]
    const nextIndex = { version: 2, legacyHash: hash, items }
    if (!writeVerified(INDEX_KEY, nextIndex)) {
      // Desfaz a gravação parcial; o rascunho antigo continua intacto.
      removeKey(resumeKey(record.id), storage)
      if (index) writeJSON(INDEX_KEY, index, storage)
      return { status: 'failed' }
    }
    moveLegacyToBackup(raw)
    return { status: index ? 'recovered' : 'migrated', id: record.id }
  }

  return { listResumes, getResume, newRecord, saveResume, migrateLegacyDraft, getUnmigratedLegacy }
}

// Instância usada pelo app, ligada ao localStorage do navegador.
export const resumeStore = createResumeStore()
