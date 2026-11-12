import { useCallback, useEffect, useState } from 'react'
import { createBackup } from '@/services/backup'
import { INDEX_KEY, resumeStore } from '@/services/resumeStore'

/**
 * Lista de currículos salvos, do mais recente para o mais antigo. Atualiza quando outra aba
 * altera os currículos (evento `storage`) e depois de cada ação feita por esta página.
 */
export function useResumeList() {
  const [items, setItems] = useState(() => resumeStore.listResumes())
  const refresh = useCallback(() => setItems(resumeStore.listResumes()), [])

  useEffect(() => {
    const onStorage = (event) => {
      if (event.key === null || event.key === INDEX_KEY) refresh()
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [refresh])

  const createResume = useCallback(() => {
    const saved = resumeStore.saveResume(resumeStore.newRecord())
    refresh()
    return saved
  }, [refresh])

  const duplicateResume = useCallback(
    (id) => {
      const copy = resumeStore.duplicateResume(id)
      refresh()
      return copy
    },
    [refresh],
  )

  const deleteResume = useCallback(
    (id) => {
      const removed = resumeStore.deleteResume(id)
      refresh()
      return removed
    },
    [refresh],
  )

  // Cópia de segurança: conteúdo do arquivo, plano de restauração (sem gravar) e restauração.
  const exportBackup = useCallback(() => createBackup(resumeStore.exportRecords()), [])
  const planImport = useCallback((records) => resumeStore.planImport(records), [])
  const importBackup = useCallback(
    (plan) => {
      const result = resumeStore.importPlan(plan)
      refresh()
      return result
    },
    [refresh],
  )

  return { items, createResume, duplicateResume, deleteResume, exportBackup, planImport, importBackup }
}
