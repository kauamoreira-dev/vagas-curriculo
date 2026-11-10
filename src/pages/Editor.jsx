import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ResumeForm } from '@/components/editor/ResumeForm'
import { SUMMARY_HEADING_ID } from '@/components/editor/ValidationSummary'
import { TextField } from '@/components/editor/fields'
import { Logo } from '@/components/layout/Logo'
import { ResumeDocument } from '@/components/resume/ResumeDocument'
import { ScaledSheet } from '@/components/resume/ScaledSheet'
import { Button } from '@/components/ui/Button'
import { SAMPLE_RESUME, hasResumeContent } from '@/data/resume'
import { TEMPLATES, getTemplate } from '@/data/templates'
import { useResumeDraft } from '@/hooks/useResumeDraft'
import { resumeStore } from '@/services/resumeStore'
import { isInAppBrowser } from '@/utils/browser'
import { splitBySeverity, validateResume } from '@/utils/validation'
import styles from './Editor.module.css'

/*
 * Rota /editor/:id? — escolhe o currículo e mostra a área de edição.
 * /editor?modelo=<id> (vindo da página inicial ou de /modelos) cria um currículo novo com o
 * modelo escolhido: nunca troca o modelo de um currículo que já existe.
 */
export function Editor() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const templateForNew = id ? null : searchParams.get('modelo')
  if (templateForNew && getTemplate(templateForNew)) return <NewFromTemplate templateId={templateForNew} />
  return <EditorRoute id={id} />
}

/*
 * Grava um currículo novo e vazio com o modelo pedido e abre o editor nele. Se o navegador não
 * deixar salvar, volta para "Meus currículos", que mostra o aviso (como em "Novo currículo").
 */
function NewFromTemplate({ templateId }) {
  const navigate = useNavigate()
  // No StrictMode o efeito roda duas vezes: o currículo é criado uma vez só.
  const created = useRef(false)

  useEffect(() => {
    if (created.current) return
    created.current = true
    const saved = resumeStore.saveResume(resumeStore.newRecord({ templateId }))
    if (saved) navigate(`/editor/${saved.id}`, { replace: true })
    else navigate('/curriculos', { replace: true, state: { createFailed: true } })
  }, [templateId, navigate])

  return null
}

function EditorRoute({ id }) {
  const draft = useResumeDraft(id)
  const navigate = useNavigate()
  const location = useLocation()

  // /editor (sem id) passa a apontar para o currículo aberto assim que ele estiver salvo.
  useEffect(() => {
    if (!id && draft.persisted && draft.resumeId) {
      navigate({ pathname: `/editor/${draft.resumeId}`, search: location.search }, { replace: true })
    }
  }, [id, draft.persisted, draft.resumeId, navigate, location.search])

  if (draft.notFound) return <MissingResume />
  // A chave recria a área de edição (validação, aba ativa) ao trocar de currículo.
  return <EditorWorkspace key={draft.resumeId} draft={draft} />
}

function MissingResume() {
  return (
    <div className={styles.missing}>
      <Logo />
      <h1 className={styles.missingTitle}>Currículo não encontrado</h1>
      <p>Ele pode ter sido excluído ou foi salvo em outro navegador.</p>
      <div className={styles.missingActions}>
        <Button to="/curriculos">Ver meus currículos</Button>
        <Button to="/editor" variant="secondary">
          Abrir o mais recente
        </Button>
      </div>
    </div>
  )
}

/**
 * Abre o diálogo de impressão do navegador ("Salvar como PDF").
 * O título da página vira o nome sugerido do arquivo no Chrome e no Edge: durante a impressão,
 * usa o nome da pessoa. O cabeçalho e o rodapé automáticos são evitados pelo @page sem margem.
 */
function printResume(resume) {
  const previousTitle = document.title
  const name = resume.personal.name.trim()
  document.title = name ? `Currículo - ${name}` : 'Currículo'
  // No celular a impressão não bloqueia: o título volta só quando o diálogo fecha.
  const restore = () => {
    document.title = previousTitle
    window.removeEventListener('afterprint', restore)
  }
  window.addEventListener('afterprint', restore)
  window.print()
}

// Horário da última gravação: "às 14:32" (hoje) ou "em 05/11/2026".
function formatSavedAt(iso) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const today = new Date()
  if (date.toDateString() === today.toDateString()) {
    return `às ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
  }
  return `em ${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
}

/**
 * Estado real da gravação neste navegador (localStorage), vindo de `useResumeDraft`.
 * "Salvo" só aparece depois que o navegador aceitou a gravação. Não há nuvem: o texto diz onde está.
 */
function SaveIndicator({ status, savedAt, onRetry }) {
  if (status === 'error') {
    return (
      <div className={styles.saveError} role="alert">
        <p>
          <strong>Não foi possível salvar neste navegador.</strong> O espaço pode estar cheio ou o
          armazenamento bloqueado. Salve em PDF antes de sair para não perder as últimas alterações.
        </p>
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Tentar de novo
        </Button>
      </div>
    )
  }
  const text = {
    unsaved: 'Ainda não salvo. O salvamento começa quando você editar.',
    pending: 'Salvando neste navegador…',
    saved: `Salvo neste navegador ${formatSavedAt(savedAt)}`.trim(),
  }[status]
  return (
    <p className={styles.saveStatus} data-status={status}>
      <span className={styles.saveDot} aria-hidden="true" />
      {text}
    </p>
  )
}

const VIEWS = ['form', 'preview']

// Setas, Home e End movem entre opções de um grupo (abas, modelos): devolve o índice do próximo.
function nextIndexForKey(key, current, total) {
  if (key === 'Home') return 0
  if (key === 'End') return total - 1
  if (key === 'ArrowRight' || key === 'ArrowDown') return (current + 1) % total
  if (key === 'ArrowLeft' || key === 'ArrowUp') return (current - 1 + total) % total
  return null
}

function EditorWorkspace({ draft }) {
  const { resume, templateId, setTemplateId } = draft
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState('form')
  // No celular as duas abas rolam a mesma página: cada uma volta para onde a pessoa estava.
  const scrollByView = useRef({ form: 0, preview: 0 })
  // Reduzida, a folha cabe na tela mas o texto fica ilegível no celular; em tamanho real, rola de lado.
  const [actualSize, setActualSize] = useState(false)
  const [inAppBrowser] = useState(() => isInAppBrowser(navigator.userAgent))
  const [showAllErrors, setShowAllErrors] = useState(false)
  // Incrementado a cada "Salvar PDF" com pendências: o formulário abre os grupos onde elas estão.
  const [revealErrors, setRevealErrors] = useState(0)
  // Resumo de pendências no topo do formulário, aberto por "Salvar PDF".
  const [summaryOpen, setSummaryOpen] = useState(false)
  // Trocar a chave recria o formulário e zera os campos marcados como visitados.
  const [formKey, setFormKey] = useState(0)
  const errors = useMemo(() => validateResume(resume), [resume])
  const errorCount = Object.keys(errors).length

  // O modelo pode chegar pela URL (/editor?modelo=moderno) a partir da página de modelos.
  const requestedTemplate = searchParams.get('modelo')
  useEffect(() => {
    if (requestedTemplate && getTemplate(requestedTemplate)) setTemplateId(requestedTemplate)
  }, [requestedTemplate, setTemplateId])

  useEffect(() => {
    document.title = 'Editor · Currículo Tapajós'
    return () => {
      document.title = 'Currículo Tapajós'
    }
  }, [])

  function showView(next) {
    if (next === view) return
    scrollByView.current[view] = window.scrollY
    setView(next)
  }

  useLayoutEffect(() => {
    window.scrollTo(0, scrollByView.current[view])
  }, [view])

  function handleTabKeys(event) {
    const next = nextIndexForKey(event.key, VIEWS.indexOf(view), VIEWS.length)
    if (next === null) return
    event.preventDefault()
    showView(VIEWS[next])
    document.getElementById(`aba-${VIEWS[next]}`)?.focus()
  }

  function chooseTemplate(id) {
    setTemplateId(id)
    // Num currículo ainda não salvo a URL é /editor, onde ?modelo= criaria um currículo novo.
    if (draft.persisted) setSearchParams({ modelo: id }, { replace: true })
  }

  function handleTemplateKeys(event) {
    const current = TEMPLATES.findIndex((template) => template.id === templateId)
    const next = nextIndexForKey(event.key, Math.max(current, 0), TEMPLATES.length)
    if (next === null) return
    event.preventDefault()
    chooseTemplate(TEMPLATES[next].id)
    document.getElementById(`modelo-${TEMPLATES[next].id}`)?.focus()
  }

  function fillWithSample() {
    if (hasResumeContent(resume) && !window.confirm('Substituir o conteúdo atual pelo exemplo fictício?'))
      return
    draft.replaceResume(SAMPLE_RESUME)
    restartValidation()
  }

  function clearAll() {
    if (!window.confirm('Apagar todo o conteúdo do currículo? Essa ação não pode ser desfeita.'))
      return
    draft.resetDraft()
    restartValidation()
  }

  function restartValidation() {
    setShowAllErrors(false)
    setSummaryOpen(false)
    setFormKey((key) => key + 1)
  }

  /*
   * Sem pendências, abre a impressão. Com pendências, volta ao formulário e mostra o resumo:
   * - erros (obrigatórios ou dados inválidos) impedem o PDF; o foco vai ao primeiro campo com erro;
   * - só avisos (itens opcionais incompletos): o resumo oferece "Gerar PDF mesmo assim".
   */
  function savePdf() {
    if (errorCount === 0) {
      setSummaryOpen(false)
      printResume(resume)
      return
    }
    const { blocking } = splitBySeverity(errors)
    setShowAllErrors(true)
    setRevealErrors((count) => count + 1)
    setSummaryOpen(true)
    showView('form')
    // Espera o formulário abrir os grupos e exibir as mensagens antes de mover o foco.
    requestAnimationFrame(() => {
      const target = blocking.length
        ? [...document.querySelectorAll('[data-field]')].find((field) => blocking.includes(field.dataset.field))
        : document.getElementById(SUMMARY_HEADING_ID)
      target?.focus()
    })
  }

  function printFromSummary() {
    setSummaryOpen(false)
    printResume(resume)
  }

  const isEmpty = !hasResumeContent(resume)

  return (
    <div className={styles.app} data-view={view}>
      <div className={styles.chrome}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <Logo />
            <Link to="/curriculos" className={styles.crumb}>
              Meus currículos
            </Link>
          </div>

          <div className={styles.viewTabs} role="tablist" aria-label="Alternar visualização" onKeyDown={handleTabKeys}>
            {[
              ['form', 'Editar', 'painel-editar'],
              ['preview', 'Visualizar', 'painel-visualizar'],
            ].map(([name, label, panel]) => (
              <button
                key={name}
                id={`aba-${name}`}
                type="button"
                role="tab"
                aria-selected={view === name}
                aria-controls={panel}
                tabIndex={view === name ? 0 : -1}
                className={styles.viewTab}
                onClick={() => showView(name)}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className={styles.templatePicker}
            role="radiogroup"
            aria-label="Modelo do currículo"
            onKeyDown={handleTemplateKeys}
          >
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                id={`modelo-${template.id}`}
                type="button"
                role="radio"
                aria-checked={template.id === templateId}
                tabIndex={template.id === templateId ? 0 : -1}
                className={styles.templateOption}
                onClick={() => chooseTemplate(template.id)}
              >
                {template.name}
              </button>
            ))}
          </div>

          <div className={styles.actions}>
            <Button variant="ghost" size="sm" onClick={fillWithSample}>
              Usar exemplo
            </Button>
            <Button variant="danger" size="sm" onClick={clearAll} disabled={isEmpty}>
              Limpar
            </Button>
            <Button size="sm" onClick={savePdf} disabled={isEmpty}>
              {/* Em telas estreitas só "PDF" aparece; o nome acessível continua "Salvar PDF" */}
              <span>
                <span className={styles.narrowHidden}>Salvar</span> PDF
              </span>
            </Button>
          </div>
        </header>
      </div>

      <div className={styles.workspace}>
        <div
          id="painel-editar"
          role="tabpanel"
          aria-labelledby="aba-form"
          className={styles.formPane}
          data-active={view === 'form'}
        >
          <div className={styles.formInner}>
            {inAppBrowser ? (
              <p className={styles.inAppNotice} role="note">
                <strong>Abra no Chrome ou no Safari.</strong> No navegador deste aplicativo, o PDF pode
                não ser gerado e o currículo fica salvo só aqui. Use o menu (⋯ ou ⋮) e escolha “Abrir no
                navegador” antes de começar.
              </p>
            ) : null}
            <SaveIndicator status={draft.saveStatus} savedAt={draft.savedAt} onRetry={draft.retrySave} />
            <ResumeForm
              key={formKey}
              resume={resume}
              actions={draft}
              errors={errors}
              showAllErrors={showAllErrors}
              revealErrors={revealErrors}
              summaryOpen={summaryOpen}
              onPrint={printFromSummary}
              onCloseSummary={() => setSummaryOpen(false)}
            />
            <section className={styles.settings} aria-labelledby="ajustes-titulo">
              <h2 id="ajustes-titulo" className={styles.settingsTitle}>
                Ajustes deste currículo
              </h2>
              <TextField
                label="Nome deste currículo"
                value={draft.title}
                onChange={draft.setTitle}
                placeholder={draft.autoTitle}
                hint="Aparece só na sua lista de currículos. Em branco, usamos seu nome e cargo."
              />
              <div className={styles.mobileActions}>
                <Button variant="secondary" size="sm" onClick={fillWithSample}>
                  Usar exemplo
                </Button>
                <Button variant="danger" size="sm" onClick={clearAll} disabled={isEmpty}>
                  Limpar
                </Button>
              </div>
            </section>
            <p className={styles.formFooter}>
              <Link to="/curriculos">Ver meus currículos</Link> · Precisa de outro visual?{' '}
              <Link to="/modelos">Compare os modelos</Link>.
            </p>
          </div>
        </div>

        <div
          id="painel-visualizar"
          role="tabpanel"
          aria-labelledby="aba-preview"
          className={styles.previewPane}
          data-active={view === 'preview'}
        >
          <div className={styles.previewInner}>
            <div className={styles.previewToolbar}>
              <Button
                variant="secondary"
                size="sm"
                aria-pressed={actualSize}
                onClick={() => setActualSize((current) => !current)}
              >
                {actualSize ? 'Ajustar à tela' : 'Ver em tamanho real'}
              </Button>
            </div>
            <div className={styles.sheetScroller} data-actual-size={actualSize}>
              <ScaledSheet className={styles.sheet} actualSize={actualSize}>
                <ResumeDocument templateId={templateId} resume={resume} />
              </ScaledSheet>
            </div>
            <p className={styles.previewNote}>
              Pré-visualização em A4. Se o conteúdo passar de uma página, o PDF terá mais de uma.
            </p>
          </div>
        </div>
      </div>

      {createPortal(
        <div className="print-only">
          <ResumeDocument templateId={templateId} resume={resume} />
        </div>,
        document.body,
      )}
    </div>
  )
}
