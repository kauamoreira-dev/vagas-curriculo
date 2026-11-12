import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ITEM_FACTORIES, LIST_SECTIONS, createEmptyResume, normalizeSkillList, resumeTitle } from '@/data/resume'
import { getTemplate } from '@/data/templates'
import { RESUME_PREFIX, displayTitle, resumeStore } from '@/services/resumeStore'
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
  return { requestedId: id, loaded: record, record, persisted, save, ...versionState(record, persisted) }
}

/*
 * Várias abas (ou janelas) com o mesmo currículo. Cada sessão guarda:
 * - `base`: o `updatedAt` da versão gravada que esta aba conhece (null se nunca foi gravado);
 * - `conflict`: { external, recoveryId } quando outra aba gravou (ou excluiu) o currículo enquanto
 *   esta tinha alterações não salvas. `external` é a versão gravada (null se excluída);
 *   `recoveryId`, a cópia onde as alterações desta aba foram guardadas ao sair sem escolher;
 * - `synced`: esta aba adotou a versão de outra aba (não havia nada pendente aqui).
 * Nada grava por cima de uma versão que esta aba não conhece: a pessoa escolhe o que fazer.
 */
function versionState(record, persisted) {
  return { base: persisted ? record.updatedAt : null, conflict: null, synced: false }
}

// A sessão passa a mostrar a versão gravada `record` (de outra aba), sem nada pendente.
function adopt(current, record) {
  return {
    ...current,
    loaded: record,
    record,
    persisted: true,
    save: { status: 'saved', savedAt: record.updatedAt, record },
    ...versionState(record, true),
  }
}

// Há alteração nesta aba que ainda não foi gravada.
const hasLocalChanges = (current) =>
  Boolean(current.record) && current.record !== current.loaded && current.record !== current.save.record

export function useResumeDraft(id) {
  const [session, setSession] = useState(() => openSession(id))
  const pending = useRef(null)
  // Versão gravada conhecida quando a alteração pendente foi feita (para conferir antes de gravar).
  const pendingBase = useRef(null)
  // Sessão mais recente, para as funções estáveis (gravação, eventos de outras abas) consultarem.
  const sessionRef = useRef(session)
  useLayoutEffect(() => {
    sessionRef.current = session
  }, [session])

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
  const unsavedChanges = hasLocalChanges(session)
  const saveStatus = session.conflict
    ? 'conflict'
    : session.save.status === 'error'
      ? 'error'
      : unsavedChanges
        ? 'pending'
        : session.save.status

  /*
   * Em conflito, as alterações desta aba vão para uma cópia (sempre a mesma), nunca por cima da
   * versão da outra aba. Usada ao sair da página sem escolher o que fazer.
   */
  const saveRecovery = useCallback(() => {
    const current = sessionRef.current
    if (!current.conflict || !hasLocalChanges(current)) return null
    const { record, conflict } = current
    const existing = conflict.recoveryId ? resumeStore.getResume(conflict.recoveryId) : null
    const saved = existing
      ? resumeStore.saveResume({ ...existing, templateId: record.templateId, resume: record.resume })
      : resumeStore.saveCopy(record, '(alterações não salvas)')
    if (saved) {
      const next = { ...current, conflict: { ...conflict, recoveryId: saved.id } }
      // Atualiza a referência já: ao sair, pagehide e desmontagem podem chamar isto em seguida.
      sessionRef.current = next
      setSession((latest) => (latest.conflict ? { ...latest, conflict: { ...latest.conflict, recoveryId: saved.id } } : latest))
    }
    return saved
  }, [])

  /*
   * Grava a versão pendente, se houver. Também chamada ao sair da página, ao trocar de currículo,
   * ao desmontar e por "Tentar de novo". Só marca como salvo depois que o navegador aceitou a
   * gravação; se recusar, a versão continua pendente para a próxima tentativa.
   * Antes de gravar, confere se a versão gravada ainda é a que esta aba conhece: se outra aba
   * gravou ou excluiu o currículo nesse meio-tempo, não sobrescreve e abre um conflito.
   * `leaving`: a página pode não voltar (oculta, fechada ou o editor desmontado). Em conflito, as
   * alterações daqui vão para a cópia de recuperação: no celular, uma aba oculta pode ser encerrada
   * pelo sistema sem disparar pagehide, então ficar oculta já conta.
   */
  const flush = useCallback(
    (options) => {
      const leaving = options?.leaving === true
      const current = sessionRef.current
      const record = pending.current
      const sameSession = !record || current.record?.id === record.id
      if (current.conflict && sameSession) {
        if (leaving) saveRecovery()
        return
      }
      if (!record) return
      const stored = resumeStore.getResume(record.id)
      if ((stored?.updatedAt ?? null) !== pendingBase.current) {
        if (!sameSession) {
          // Currículo que já saiu da tela mudou em outra aba: as alterações daqui vão para uma cópia.
          pending.current = null
          resumeStore.saveCopy(record, '(alterações não salvas)')
          return
        }
        const conflict = { external: stored, recoveryId: null }
        sessionRef.current = { ...current, conflict }
        setSession((latest) => (latest.record?.id === record.id ? { ...latest, conflict } : latest))
        if (leaving) saveRecovery()
        return
      }
      const saved = resumeStore.saveResume(record)
      if (saved && pending.current === record) pending.current = null
      if (saved) {
        pendingBase.current = saved.updatedAt
        if (sameSession) sessionRef.current = { ...sessionRef.current, base: saved.updatedAt }
      }
      setSession((latest) => {
        if (latest.record?.id !== record.id) return latest
        if (!saved) return { ...latest, save: { ...latest.save, status: 'error' } }
        return {
          ...latest,
          persisted: true,
          base: saved.updatedAt,
          synced: false,
          save: { status: 'saved', savedAt: saved.updatedAt, record },
        }
      })
    },
    [saveRecovery],
  )

  useEffect(() => {
    // Trocou de currículo com alteração pendente no anterior: grava antes de seguir.
    if (pending.current && pending.current.id !== draft?.id) flush()
    // Abrir (ou reabrir, no StrictMode) um currículo não é alteração: nada a gravar.
    if (!draft || draft === session.loaded) return undefined
    pending.current = draft
    pendingBase.current = sessionRef.current.base
    const timer = setTimeout(flush, SAVE_DELAY)
    return () => clearTimeout(timer)
  }, [draft, session.loaded, flush])

  useEffect(() => {
    const flushWhenLeaving = () => flush({ leaving: true })
    const flushWhenHidden = () => document.visibilityState === 'hidden' && flush({ leaving: true })
    window.addEventListener('pagehide', flushWhenLeaving)
    document.addEventListener('visibilitychange', flushWhenHidden)
    return () => {
      window.removeEventListener('pagehide', flushWhenLeaving)
      document.removeEventListener('visibilitychange', flushWhenHidden)
      flush({ leaving: true })
    }
  }, [flush])

  /*
   * Outra aba gravou ou excluiu este currículo. Sem nada pendente aqui, esta aba passa a mostrar a
   * versão nova (as edições das duas se somam). Com alterações pendentes, abre um conflito.
   */
  useEffect(() => {
    const onStorage = (event) => {
      const current = sessionRef.current
      const id = current.record?.id
      if (!id || !current.persisted) return
      if (event.key !== null && event.key !== RESUME_PREFIX + id) return
      const stored = resumeStore.getResume(id)
      if ((stored?.updatedAt ?? null) === current.base) return
      if (current.conflict) {
        setSession((latest) => (latest.conflict ? { ...latest, conflict: { ...latest.conflict, external: stored } } : latest))
      } else if (hasLocalChanges(current) || !stored) {
        setSession((latest) => (latest.record?.id === id ? { ...latest, conflict: { external: stored, recoveryId: null } } : latest))
      } else {
        pending.current = null
        setSession((latest) => (latest.record?.id === id ? { ...adopt(latest, stored), synced: true } : latest))
      }
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const markSaveError = () => setSession((latest) => ({ ...latest, save: { ...latest.save, status: 'error' } }))

  // Conflito: grava as alterações desta aba por cima da outra versão. Retorna false se não deu.
  const keepMine = useCallback(() => {
    const current = sessionRef.current
    if (!current.conflict || !current.record) return false
    const saved = resumeStore.saveResume(current.record)
    if (!saved) {
      markSaveError()
      return false
    }
    pending.current = null
    if (current.conflict.recoveryId) resumeStore.deleteResume(current.conflict.recoveryId)
    sessionRef.current = { ...current, base: saved.updatedAt, conflict: null }
    setSession((latest) => ({
      ...latest,
      persisted: true,
      base: saved.updatedAt,
      conflict: null,
      synced: false,
      save: { status: 'saved', savedAt: saved.updatedAt, record: current.record },
    }))
    return true
  }, [])

  /*
   * Conflito: descarta as alterações desta aba e mostra a versão gravada pela outra — a que está
   * gravada agora, não a do aviso (outra gravação pode ter chegado sem evento, de aba congelada).
   * Se o currículo foi excluído lá, só descarta (quem chama leva a pessoa para a lista).
   */
  const acceptOther = useCallback(() => {
    const current = sessionRef.current
    if (!current.conflict) return
    const { recoveryId } = current.conflict
    const external = resumeStore.getResume(current.record.id)
    pending.current = null
    if (recoveryId) resumeStore.deleteResume(recoveryId)
    const next = external
      ? adopt(current, external)
      : { ...current, loaded: current.record, save: { ...current.save, record: current.record }, conflict: null }
    sessionRef.current = next
    setSession(next)
  }, [])

  /*
   * Conflito: guarda as alterações desta aba num currículo novo (cópia) e deixa o original com a
   * versão da outra aba. Retorna o id da cópia (para abri-la) ou null se não deu para gravar.
   */
  const saveMineAsCopy = useCallback(() => {
    const current = sessionRef.current
    if (!current.conflict || !current.record) return null
    const { record, conflict } = current
    const existing = conflict.recoveryId ? resumeStore.getResume(conflict.recoveryId) : null
    const copy = existing
      ? resumeStore.saveResume({
          ...existing,
          title: `${displayTitle(record)} (minha versão)`,
          templateId: record.templateId,
          resume: record.resume,
        })
      : resumeStore.saveCopy(record, '(minha versão)')
    if (!copy) {
      markSaveError()
      return null
    }
    pending.current = null
    const external = resumeStore.getResume(record.id)
    const next = external
      ? adopt(current, external)
      : { ...current, loaded: current.record, save: { ...current.save, record: current.record }, conflict: null }
    sessionRef.current = next
    setSession(next)
    return copy.id
  }, [])

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
    // Outra aba gravou (ou excluiu) este currículo com alterações pendentes aqui.
    conflict: session.conflict
      ? {
          deleted: !session.conflict.external,
          otherSavedAt: session.conflict.external?.updatedAt ?? null,
          // As alterações daqui já foram guardadas na cópia "(alterações não salvas)" ao sair da aba.
          recoverySaved: Boolean(session.conflict.recoveryId),
        }
      : null,
    syncedFromOtherTab: session.synced,
    keepMine,
    acceptOther,
    saveMineAsCopy,
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
