import { useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { BACKUP_ERRORS, BACKUP_MAX_BYTES, backupFileName, parseBackup } from '@/services/backup'
import styles from './BackupPanel.module.css'

const plural = (count, singular, many) => (count === 1 ? `1 ${singular}` : `${count} ${many}`)
const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

// Baixa um arquivo gerado no próprio navegador (nada é enviado a servidores).
function downloadJson(data, fileName) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

// Resumo do que restaurar faria: quantos entram, quantos são iguais, quantos viram cópia.
function countPlan(plan) {
  return {
    added: plan.filter((item) => item.action === 'new').length,
    same: plan.filter((item) => item.action === 'same').length,
    copies: plan.filter((item) => item.action === 'copy').length,
  }
}

/**
 * Cópia de segurança: baixar todos os currículos num arquivo .json e restaurá-los a partir dele.
 * Restaurar mostra antes o que vai acontecer e nunca substitui um currículo daqui: iguais são
 * ignorados e diferentes (mesmo currículo, outra versão) entram como cópia.
 * `onExport()` → conteúdo do backup; `onPlan(records)` → plano; `onImport(plan)` → { imported, failed }.
 */
export function BackupPanel({ resumeCount, onExport, onPlan, onImport }) {
  const inputRef = useRef(null)
  // Arquivo lido e validado, esperando a confirmação: { plan, counts, skipped, exportedAt, fileName }.
  const [preview, setPreview] = useState(null)
  const [message, setMessage] = useState({ text: '', error: false })

  function download() {
    const backup = onExport()
    downloadJson(backup, backupFileName())
    setMessage({
      // O site não sabe se o arquivo foi mesmo salvo (no iPhone, a pessoa pode cancelar a tela de salvar).
      text: `Cópia com ${plural(backup.resumes.length, 'currículo', 'currículos')} gerada. Confira se o arquivo foi salvo no aparelho e guarde-o num lugar seguro.`,
      error: false,
    })
  }

  async function readFile(event) {
    const file = event.target.files?.[0]
    // Limpa a escolha: escolher o mesmo arquivo de novo também dispara a leitura.
    event.target.value = ''
    if (!file) return
    setPreview(null)
    if (file.size > BACKUP_MAX_BYTES) {
      setMessage({ text: BACKUP_ERRORS.tooLarge, error: true })
      return
    }
    const result = parseBackup(await file.text())
    if (result.error) {
      setMessage({ text: result.error, error: true })
      return
    }
    const plan = onPlan(result.records)
    setMessage({ text: '', error: false })
    setPreview({ plan, counts: countPlan(plan), skipped: result.skipped, exportedAt: result.exportedAt, fileName: file.name })
  }

  function restore() {
    const { counts, plan } = preview
    const toRestore = counts.added + counts.copies
    const { imported, failed } = onImport(plan)
    setPreview(null)
    if (failed) {
      setMessage({
        text: `Restaurados ${imported} de ${toRestore}. Não há espaço neste navegador para o restante: exclua currículos que não usa e restaure o arquivo de novo (os que já entraram serão ignorados).`,
        error: true,
      })
      return
    }
    const parts = [`${plural(imported, 'currículo restaurado', 'currículos restaurados')}.`]
    if (counts.copies) parts.push(`${plural(counts.copies, 'entrou', 'entraram')} como cópia, sem substituir os daqui.`)
    if (counts.same) parts.push(`${plural(counts.same, 'já existia igual e foi ignorado', 'já existiam iguais e foram ignorados')}.`)
    setMessage({ text: parts.join(' '), error: false })
  }

  const nothingToRestore = preview && preview.counts.added + preview.counts.copies === 0

  return (
    <section className={styles.panel} aria-labelledby="backup-titulo">
      <h2 id="backup-titulo" className={styles.title}>
        Cópia de segurança
      </h2>
      <p className={styles.text}>
        Seus currículos ficam só neste navegador e podem ser apagados se os dados dele forem limpos (no
        iPhone, também depois de alguns dias sem abrir o site). Baixe uma cópia de vez em quando: o
        arquivo fica no seu aparelho e serve para restaurar aqui ou em outro aparelho.
      </p>

      <div className={styles.actions}>
        <Button variant="secondary" size="sm" onClick={download} disabled={!resumeCount}>
          Baixar cópia de segurança
        </Button>
        <Button variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
          Restaurar de um arquivo
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          className={styles.fileInput}
          onChange={readFile}
          aria-label="Arquivo da cópia de segurança"
          tabIndex={-1}
        />
      </div>

      {preview ? (
        <div className={styles.preview} role="region" aria-label="Prévia da restauração">
          <p className={styles.previewTitle}>
            {preview.fileName}
            {preview.exportedAt ? ` · de ${dateFormat.format(new Date(preview.exportedAt))}` : ''}
          </p>
          <ul className={styles.previewList}>
            {preview.counts.added ? <li>{plural(preview.counts.added, 'currículo novo', 'currículos novos')} para restaurar</li> : null}
            {preview.counts.copies ? (
              <li>
                {plural(preview.counts.copies, 'currículo diferente', 'currículos diferentes')} de um que você já tem: entra
                como cópia, sem substituir
              </li>
            ) : null}
            {preview.counts.same ? <li>{plural(preview.counts.same, 'já está aqui igual', 'já estão aqui iguais')} (será ignorado)</li> : null}
            {preview.skipped ? <li>{plural(preview.skipped, 'item inválido', 'itens inválidos')} no arquivo (será ignorado)</li> : null}
          </ul>
          <div className={styles.actions}>
            {nothingToRestore ? (
              <p className={styles.text}>Todos os currículos deste arquivo já estão aqui.</p>
            ) : (
              <Button size="sm" onClick={restore}>
                Restaurar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setPreview(null)}>
              {nothingToRestore ? 'Fechar' : 'Cancelar'}
            </Button>
          </div>
        </div>
      ) : null}

      <p className={styles.message} data-error={message.error || undefined} role="status" aria-live="polite">
        {message.text}
      </p>
    </section>
  )
}
