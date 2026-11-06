import { useCallback, useEffect, useRef, useState } from 'react'
import { createEmptyEducation, createEmptyExperience, createEmptyResume } from '@/data/resume'
import { getTemplate } from '@/data/templates'
import { resumeStore } from '@/services/resumeStore'
import { createId } from '@/utils/id'

// Espera após a última alteração antes de gravar: evita regravar a foto a cada tecla.
const SAVE_DELAY = 400

// Abre o currículo mais recente; sem nenhum salvo, um novo (gravado só na primeira alteração).
function loadDraft() {
  const recent = resumeStore.listResumes()[0]
  const record = recent ? resumeStore.getResume(recent.id) : null
  return record ?? resumeStore.getUnmigratedLegacy() ?? resumeStore.newRecord()
}

/**
 * Estado do currículo em edição. É salvo automaticamente no navegador deste dispositivo
 * (localStorage, via `resumeStore`) — não há envio para servidor.
 */
export function useResumeDraft() {
  const [draft, setDraft] = useState(loadDraft)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const lastSaved = useRef(draft)
  const pending = useRef(null)

  // Grava a versão pendente, se houver. Também chamada ao sair da página e ao desmontar.
  const flush = useCallback(() => {
    const record = pending.current
    if (!record) return
    pending.current = null
    const saved = resumeStore.saveResume(record)
    lastSaved.current = record
    setStorageAvailable(Boolean(saved))
  }, [])

  useEffect(() => {
    if (draft === lastSaved.current) return undefined
    pending.current = draft
    const timer = setTimeout(flush, SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [draft, flush])

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

  const updateResume = useCallback((updater) => {
    setDraft((current) => ({ ...current, resume: updater(current.resume) }))
  }, [])

  const setTemplateId = useCallback((templateId) => {
    if (!getTemplate(templateId)) return
    setDraft((current) =>
      current.templateId === templateId ? current : { ...current, templateId },
    )
  }, [])

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
    (section, id, field, value) =>
      updateResume((resume) => ({
        ...resume,
        [section]: resume[section].map((item) =>
          item.id === id ? { ...item, [field]: value } : item,
        ),
      })),
    [updateResume],
  )

  const removeItem = useCallback(
    (section, id) =>
      updateResume((resume) => ({
        ...resume,
        [section]: resume[section].filter((item) => item.id !== id),
      })),
    [updateResume],
  )

  const moveItem = useCallback(
    (section, id, direction) =>
      updateResume((resume) => {
        const items = [...resume[section]]
        const index = items.findIndex((item) => item.id === id)
        const target = index + direction
        if (index < 0 || target < 0 || target >= items.length) return resume
        ;[items[index], items[target]] = [items[target], items[index]]
        return { ...resume, [section]: items }
      }),
    [updateResume],
  )

  const replaceResume = useCallback((resume) => {
    // Gera novos ids para que o conteúdo copiado seja independente da origem.
    const withIds = (items) => items.map((item) => ({ ...item, id: createId() }))
    setDraft((current) => ({
      ...current,
      resume: {
        ...resume,
        experience: withIds(resume.experience),
        education: withIds(resume.education),
      },
    }))
  }, [])

  // Esvazia o currículo aberto (ele continua salvo, sem conteúdo).
  const resetDraft = useCallback(() => {
    setDraft((current) => ({ ...current, resume: createEmptyResume() }))
  }, [])

  return {
    templateId: draft.templateId,
    resume: draft.resume,
    storageAvailable,
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
