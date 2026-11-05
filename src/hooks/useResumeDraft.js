import { useCallback, useEffect, useRef, useState } from 'react'
import { createEmptyEducation, createEmptyExperience, createEmptyResume } from '@/data/resume'
import { DEFAULT_TEMPLATE_ID, getTemplate } from '@/data/templates'
import { createId } from '@/utils/id'
import { readJSON, removeKey, writeJSON } from '@/utils/storage'

const STORAGE_KEY = 'vagas-curriculo:rascunho:v1'

function loadDraft() {
  const saved = readJSON(STORAGE_KEY)
  if (!saved || typeof saved !== 'object' || !saved.resume) {
    return { templateId: DEFAULT_TEMPLATE_ID, resume: createEmptyResume() }
  }
  const empty = createEmptyResume()
  return {
    templateId: getTemplate(saved.templateId) ? saved.templateId : DEFAULT_TEMPLATE_ID,
    resume: {
      ...empty,
      ...saved.resume,
      personal: { ...empty.personal, ...saved.resume.personal },
    },
  }
}

/**
 * Estado do currículo em edição. O rascunho é salvo automaticamente
 * no navegador deste dispositivo (localStorage) — não há envio para servidor.
 */
export function useResumeDraft() {
  const [draft, setDraft] = useState(loadDraft)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const isFirstRender = useRef(true)

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    setStorageAvailable(writeJSON(STORAGE_KEY, draft))
  }, [draft])

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

  const resetDraft = useCallback(() => {
    removeKey(STORAGE_KEY)
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
