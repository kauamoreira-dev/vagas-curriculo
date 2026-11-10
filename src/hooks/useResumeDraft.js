import { useCallback, useEffect, useRef, useState } from 'react'
import { ITEM_FACTORIES, LIST_SECTIONS, createEmptyResume, normalizeSkillList, resumeTitle } from '@/data/resume'
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
/*
 * Sessão de edição: o currículo pedido, como foi carregado (`loaded`) e como está agora (`record`).
 * `save` é a última gravação no localStorage deste navegador (não há nuvem): `status` 'saved'
 * (aceita pelo navegador), 'unsaved' (currículo novo, nunca gravado) ou 'error' (recusada: sem
 * espaço ou bloqueado; a alteração segue pendente); `savedAt` é o horário e `record`, a versão.
 */
function openSession(id) {
  const { record, persisted } = loadRecord(id)
  const save = persisted
    ? { status: 'saved', savedAt: record.updatedAt, record }
    : { status: 'unsaved', savedAt: null, record }
  return { requestedId: id, loaded: record, record, persisted, save }
}

export function useResumeDraft(id) {
  const [session, setSession] = useState(() => openSession(id))
  const pending = useRef(null)

  // Outro currículo pedido pela URL (/editor/:id): troca durante a renderização, sem efeito extra.
  // /editor → /editor/<id do aberto> não conta como troca.
  if (id && id !== session.requestedId && id !== session.record?.id) {
    setSession(openSession(id))
  }

  const draft = session.record
  /*
   * 'pending' quando a versão atual ainda não foi gravada (alteração esperando o salvamento).
   * Uma falha continua visível até uma gravação dar certo.
   */
  const unsavedChanges = Boolean(draft) && draft !== session.loaded && draft !== session.save.record
  const saveStatus = session.save.status === 'error' ? 'error' : unsavedChanges ? 'pending' : session.save.status

  /*
   * Grava a versão pendente, se houver. Também chamada ao sair da página, ao trocar de currículo,
   * ao desmontar e por "Tentar de novo". Só marca como salvo depois que o navegador aceitou a
   * gravação; se recusar, a versão continua pendente para a próxima tentativa.
   */
  const flush = useCallback(() => {
    const record = pending.current
    if (!record) return
    const saved = resumeStore.saveResume(record)
    if (saved && pending.current === record) pending.current = null
    setSession((current) => {
      if (current.record?.id !== record.id) return current
      if (!saved) return { ...current, save: { ...current.save, status: 'error' } }
      return { ...current, persisted: true, save: { status: 'saved', savedAt: saved.updatedAt, record } }
    })
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
      const factory = ITEM_FACTORIES[section]
      if (!factory) return
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

  // Habilidades (`skills` ou `softSkills`): texto colado com vírgulas vira vários itens.
  const addSkills = useCallback(
    (list, value) => {
      const added = normalizeSkillList(value)
      if (!added.length) return
      updateResume((resume) => ({ ...resume, [list]: [...resume[list], ...added] }))
    },
    [updateResume],
  )

  const removeSkill = useCallback(
    (list, index) =>
      updateResume((resume) => ({ ...resume, [list]: resume[list].filter((_, position) => position !== index) })),
    [updateResume],
  )

  /**
   * Desfaz uma remoção: devolve o item, com todos os dados, à posição em que estava. Mantém as
   * edições feitas depois da remoção; se a lista encolheu, o item vai para o fim. Não duplica.
   */
  const restoreItem = useCallback(
    (section, item, index) =>
      updateResume((resume) => {
        const items = resume[section]
        if (!Array.isArray(items) || items.some((current) => current.id === item.id)) return resume
        const position = Math.min(Math.max(index, 0), items.length)
        return { ...resume, [section]: [...items.slice(0, position), item, ...items.slice(position)] }
      }),
    [updateResume],
  )

  const replaceResume = useCallback(
    (resume) => {
      // Gera novos ids para que o conteúdo copiado seja independente da origem.
      const withIds = (items) => items.map((item) => ({ ...item, id: createId() }))
      updateResume(() => ({
        ...resume,
        ...Object.fromEntries(LIST_SECTIONS.map((section) => [section, withIds(resume[section])])),
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
    saveStatus,
    savedAt: session.save.savedAt,
    storageAvailable: session.save.status !== 'error',
    retrySave: flush,
    setTitle,
    setTemplateId,
    setPersonalField,
    setField,
    addItem,
    updateItem,
    removeItem,
    restoreItem,
    moveItem,
    addSkills,
    removeSkill,
    replaceResume,
    resetDraft,
  }
}
