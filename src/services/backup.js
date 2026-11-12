import { normalizeResume } from '@/data/resume'
import { DEFAULT_TEMPLATE_ID, getTemplate } from '@/data/templates'

/*
 * Cópia de segurança dos currículos: um arquivo JSON gerado e lido só no aparelho da pessoa
 * (nada é enviado a servidores). Serve para guardar os dados fora do navegador — que pode
 * apagá-los (limpeza de dados, Safari após dias sem uso) — e para levá-los a outro aparelho.
 */
export const BACKUP_APP = 'curriculo-tapajos'
export const BACKUP_TYPE = 'backup'
export const BACKUP_VERSION = 1
// Bem acima de um backup real (~150 KB por currículo com foto); barra arquivos que não são backup.
export const BACKUP_MAX_BYTES = 20 * 1024 * 1024

// Id aceito: o formato que o site gera (UUID ou o alternativo). Vai na chave do armazenamento e na
// URL do editor; um id com "/", "?" ou "%" deixaria o currículo restaurado impossível de abrir.
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

// Foto aceita num backup: só imagem embutida em base64 (o que o próprio site gera).
const PHOTO_PATTERN = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/

export const BACKUP_ERRORS = {
  tooLarge: 'O arquivo é grande demais para ser uma cópia de segurança do Currículo Tapajós.',
  notJson: 'Não foi possível ler o arquivo. Escolha o arquivo .json baixado em “Baixar cópia de segurança”.',
  notBackup: 'Este arquivo não é uma cópia de segurança do Currículo Tapajós.',
  newerVersion: 'Esta cópia foi criada por uma versão mais nova do site. Atualize a página e tente de novo.',
  empty: 'A cópia de segurança não tem nenhum currículo válido.',
}

/** Conteúdo do arquivo de backup para os registros salvos ({ id, title, templateId, …, resume }). */
export function createBackup(records, exportedAt = new Date().toISOString()) {
  return {
    app: BACKUP_APP,
    type: BACKUP_TYPE,
    version: BACKUP_VERSION,
    exportedAt,
    resumes: records.map(({ id, title, templateId, createdAt, updatedAt, resume }) => ({
      id,
      title,
      templateId,
      createdAt,
      updatedAt,
      resume,
    })),
  }
}

// "curriculos-tapajos-2026-11-10.json"
export function backupFileName(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `curriculos-tapajos-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

const isDate = (value) => typeof value === 'string' && !Number.isNaN(Date.parse(value))

// Um registro do arquivo, já no formato atual; null se não der para aproveitar.
function readRecord(raw, fallbackDate) {
  if (!raw || typeof raw !== 'object' || typeof raw.id !== 'string' || !ID_PATTERN.test(raw.id)) return null
  if (!raw.resume || typeof raw.resume !== 'object') return null
  const resume = normalizeResume(raw.resume)
  // Foto fora do formato esperado é descartada (o resto do currículo é mantido).
  if (resume.personal.photo && !PHOTO_PATTERN.test(resume.personal.photo)) resume.personal.photo = ''
  return {
    id: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    templateId: getTemplate(raw.templateId) ? raw.templateId : DEFAULT_TEMPLATE_ID,
    createdAt: isDate(raw.createdAt) ? raw.createdAt : fallbackDate,
    updatedAt: isDate(raw.updatedAt) ? raw.updatedAt : fallbackDate,
    resume,
  }
}

/**
 * Lê e valida o texto de um arquivo de backup. Retorna { records, skipped, exportedAt } ou { error }.
 * Cada currículo passa por `normalizeResume` (só campos conhecidos, só texto); itens inválidos e
 * ids repetidos no próprio arquivo são ignorados e contados em `skipped`.
 */
export function parseBackup(text, { now = () => new Date().toISOString() } = {}) {
  if (typeof text !== 'string') return { error: BACKUP_ERRORS.notJson }
  if (text.length > BACKUP_MAX_BYTES) return { error: BACKUP_ERRORS.tooLarge }
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { error: BACKUP_ERRORS.notJson }
  }
  if (!data || data.app !== BACKUP_APP || data.type !== BACKUP_TYPE || !Array.isArray(data.resumes)) {
    return { error: BACKUP_ERRORS.notBackup }
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) return { error: BACKUP_ERRORS.newerVersion }

  const fallbackDate = now()
  const seen = new Set()
  const records = []
  for (const raw of data.resumes) {
    const record = readRecord(raw, fallbackDate)
    if (!record || seen.has(record.id)) continue
    seen.add(record.id)
    records.push(record)
  }
  if (!records.length) return { error: BACKUP_ERRORS.empty }
  return {
    records,
    skipped: data.resumes.length - records.length,
    exportedAt: isDate(data.exportedAt) ? data.exportedAt : null,
  }
}
