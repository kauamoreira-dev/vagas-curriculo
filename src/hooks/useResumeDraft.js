import { useCallback, useEffect, useRef, useState } from 'react'
import { createEmptyEducation, createEmptyExperience, createEmptyResume, resumeTitle } from '@/data/resume'
import { getTemplate } from '@/data/templates'
import { resumeStore } from '@/services/resumeStore'
import { createId } from '@/utils/id'

// Espera após a última alteração antes de gravar: evita regravar a foto a cada tecla.
const SAVE_DELAY = 400

/**
 * Com `id`, abre aquele currículo (record null = não encontrado). Sem `id`, abre o mais recente;
 * sem nenhum salvo, um novo, gravado só na primeira alteração. `persisted` indica se já está salvo.
 */
function loadRecord(id) {
  if (id) {
    const record = resumeStore.getResume(id)
    return { record, persisted: Boolean(record) }
  }
  const recent = resumeStore.listResumes()[0]
  const record = recent ? resumeStore.getResume(recent.id) : null
  if (record) return { record, persisted: true }
  return { record: resumeStore.getUnmigratedLegacy() ?? resumeStore.newRecord(), persisted: false }
}

/**
 * Estado do currículo em edição. É salvo automaticamente no navegador deste dispositivo
 * (localStorage, via `resumeStore`) — não há envio para servidor.
 */
// Sessão de edição: o currículo pedido, como foi carregado (`loaded`) e como está agora (`record`).
function openSession(id) {
  const { record, persisted } = loadRecord(id)
  return { requestedId: id, loaded: record, record, persisted }
}

export function useResumeDraft(id) {
  const [session, setSession] = useState(() => openSession(id))
  const [storageAvailable, setStorageAvailable] = useState(true)
  const pending = useRef(null)

  // Outro currículo pedido pela URL (/editor/:id): troca durante a renderização, sem efeito extra.
  // /editor → /editor/<id do aberto> não conta como troca.
  if (id && id !== session.requestedId && id !== session.record?.id) {
    setSession(openSession(id))
  }

  const draft = session.record

  // Grava a versão pendente, se houver. Também chamada ao sair da página, ao trocar de currículo e ao desmontar.
  const flush = useCallback(() => {
    const record = pending.current
    if (!record) return
    pending.current = null
    const saved = resumeStore.saveResume(record)
    setStorageAvailable(Boolean(saved))
    if (saved) {
      setSession((current) =>
        current.record?.id === record.id && !current.persisted ? { ...current, persisted: true } : current,
      )
    }
  }, [])

  useEffect(() => {
    // Trocou de currículo com alteração pendente no anterior: grava antes de seguir.
    if (pending.current && pending.current.id !== draft?.id) flush()
    // Abrir (ou reabrir, no StrictMode) um currículo não é alteração: nada a gravar.
    if (!draft || draft === session.loaded) return undefined
    pending.current = draft
    const timer = setTimeout(flush, SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [draft, session.loaded, flush])

  useEffect(() => {
    const flushWhenHidden = () => document.visibilityState === 'hidden' && flush()
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flushWhenHidden)
      flush()
    }
  }, [flush])

  // Todas as ações ignoram o caso "não encontrado" (record null).
  const updateDraft = useCallback((updater) => {
    setSession((current) =>
      current.record ? { ...current, record: updater(current.record) } : current,
    )
  }, [])

  const updateResume = useCallback(
    (updater) => updateDraft((current) => ({ ...current, resume: updater(current.resume) })),
    [updateDraft],
  )

  const setTitle = useCallback(
    (title) => updateDraft((current) => ({ ...current, title })),
    [updateDraft],
  )

  const setTemplateId = useCallback(
    (templateId) => {
      if (!getTemplate(templateId)) return
      updateDraft((current) =>
        current.templateId === templateId ? current : { ...current, templateId },
      )
    },
    [updateDraft],
  )

  const setPersonalField = useCallback(
    (field, value) =>
      updateResume((resume) => ({ ...resume, personal: { ...resume.personal, [field]: value } })),
    [updateResume],
  )

  const setField = useCallback(
    (field, value) => updateResume((resume) => ({ ...resume, [field]: value })),
    [updateResume],
  )

  const addItem = useCallback(
    (section) => {
      const factory = section === 'experience' ? createEmptyExperience : createEmptyEducation
      updateResume((resume) => ({ ...resume, [section]: [...resume[section], factory()] }))
    },
    [updateResume],
  )

  const updateItem = useCallback(
    (section, itemId, field, value) =>
      updateResume((resume) => ({
        ...resume,
        [section]: resume[section].map((item) =>
          item.id === itemId ? { ...item, [field]: value } : item,
        ),
      })),
    [updateResume],
  )

  const removeItem = useCallback(
    (section, itemId) =>
      updateResume((resume) => ({
        ...resume,
        [section]: resume[section].filter((item) => item.id !== itemId),
      })),
    [updateResume],
  )

  const moveItem = useCallback(
    (section, itemId, direction) =>
      updateResume((resume) => {
        const items = [...resume[section]]
        const index = items.findIndex((item) => item.id === itemId)
        const target = index + direction
        if (index < 0 || target < 0 || target >= items.length) return resume
        ;[items[index], items[target]] = [items[target], items[index]]
        return { ...resume, [section]: items }
      }),
    [updateResume],
  )

  const replaceResume = useCallback(
    (resume) => {
      // Gera novos ids para que o conteúdo copiado seja independente da origem.
      const withIds = (items) => items.map((item) => ({ ...item, id: createId() }))
      updateResume(() => ({
        ...resume,
        experience: withIds(resume.experience),
        education: withIds(resume.education),
      }))
    },
    [updateResume],
  )

  // Esvazia o currículo aberto (ele continua salvo, sem conteúdo).
  const resetDraft = useCallback(() => updateResume(() => createEmptyResume()), [updateResume])

  return {
    notFound: !draft,
    resumeId: draft?.id,
    persisted: session.persisted,
    title: draft?.title ?? '',
    autoTitle: draft ? resumeTitle(draft.resume) : '',
    templateId: draft?.templateId,
    resume: draft?.resume,
    storageAvailable,
    setTitle,
    setTemplateId,
    setPersonalField,
    setField,
    addItem,
    updateItem,
    removeItem,
    moveItem,
    replaceResume,
    resetDraft,
  }
}
