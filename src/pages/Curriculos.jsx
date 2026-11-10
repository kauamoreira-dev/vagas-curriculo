import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { getTemplate } from '@/data/templates'
import { useResumeList } from '@/hooks/useResumeList'
import styles from './Curriculos.module.css'

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' })

function formatUpdatedAt(value) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormat.format(date)
}

const STORAGE_ERROR = 'Não foi possível salvar neste navegador. Libere espaço ou saia do modo privado.'

export function Curriculos() {
  const { items, createResume, duplicateResume, deleteResume } = useResumeList()
  const navigate = useNavigate()
  const location = useLocation()
  // Resultado da última ação, anunciado para leitores de tela. Chega pronto quando o editor não
  // conseguiu criar o currículo a partir de um modelo (/editor?modelo=…).
  const [status, setStatus] = useState(() =>
    location.state?.createFailed ? { text: STORAGE_ERROR, error: true } : { text: '', error: false },
  )

  useEffect(() => {
    document.title = 'Meus currículos · Currículo Tapajós'
    return () => {
      document.title = 'Currículo Tapajós'
    }
  }, [])

  function create() {
    const saved = createResume()
    if (saved) navigate(`/editor/${saved.id}`)
    else setStatus({ text: STORAGE_ERROR, error: true })
  }

  function duplicate(item) {
    setStatus(
      duplicateResume(item.id)
        ? { text: `Cópia de “${item.title}” criada.`, error: false }
        : { text: STORAGE_ERROR, error: true },
    )
  }

  function remove(item) {
    if (!window.confirm(`Excluir “${item.title}”? Essa ação não pode ser desfeita.`)) return
    setStatus(
      deleteResume(item.id)
        ? { text: `“${item.title}” foi excluído.`, error: false }
        : { text: STORAGE_ERROR, error: true },
    )
  }

  return (
    <div className={styles.page}>
      <header className={`container ${styles.intro}`}>
        <div>
          <h1 className={styles.title}>Meus currículos</h1>
          <p className={styles.lede}>
            Ficam salvos só neste navegador. Para levar a outro dispositivo, gere o PDF.
          </p>
        </div>
        {/* Com a lista vazia, o cartão abaixo já oferece criar: o botão não se repete aqui */}
        {items.length ? (
          <Button onClick={create} className={styles.newButton}>
            Novo currículo
          </Button>
        ) : null}
      </header>

      <div className="container">
        {/* Região sempre presente para que leitores de tela anunciem as mudanças */}
        <p
          className={status.text ? styles.status : undefined}
          data-error={status.error}
          role="status"
          aria-live="polite"
        >
          {status.text}
        </p>

        {items.length === 0 ? (
          <div className={styles.empty}>
            <h2 className={styles.emptyTitle}>Nenhum currículo salvo ainda</h2>
            <p>Comece do zero ou escolha antes um dos modelos.</p>
            <div className={styles.emptyActions}>
              <Button onClick={create}>Criar meu primeiro currículo</Button>
              <Button to="/modelos" variant="secondary">
                Ver os modelos
              </Button>
            </div>
          </div>
        ) : (
          <ul className={styles.list}>
            {items.map((item) => (
              <li key={item.id} className={styles.item}>
                <div className={styles.info}>
                  <h2 className={styles.itemTitle}>
                    <Link to={`/editor/${item.id}`}>{item.title}</Link>
                  </h2>
                  <p className={styles.meta}>
                    <span>Atualizado em {formatUpdatedAt(item.updatedAt)}</span>
                    <span>Modelo {getTemplate(item.templateId)?.name ?? '—'}</span>
                    <span className={styles.photo} data-has-photo={item.hasPhoto}>
                      {item.hasPhoto ? 'Com foto' : 'Sem foto'}
                    </span>
                  </p>
                </div>
                <div className={styles.actions}>
                  <Button to={`/editor/${item.id}`} size="sm" aria-label={`Abrir “${item.title}”`}>
                    Abrir
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => duplicate(item)}
                    aria-label={`Duplicar “${item.title}”`}
                  >
                    Duplicar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={styles.delete}
                    onClick={() => remove(item)}
                    aria-label={`Excluir “${item.title}”`}
                  >
                    Excluir
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
