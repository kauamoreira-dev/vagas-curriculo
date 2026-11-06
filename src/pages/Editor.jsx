import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ResumeForm } from '@/components/editor/ResumeForm'
import { TextField } from '@/components/editor/fields'
import { Logo } from '@/components/layout/Logo'
import { ResumeDocument } from '@/components/resume/ResumeDocument'
import { ScaledSheet } from '@/components/resume/ScaledSheet'
import { Button } from '@/components/ui/Button'
import { SAMPLE_RESUME, hasResumeContent } from '@/data/resume'
import { TEMPLATES, getTemplate } from '@/data/templates'
import { useResumeDraft } from '@/hooks/useResumeDraft'
import { isInAppBrowser } from '@/utils/browser'
import { validateResume } from '@/utils/validation'
import styles from './Editor.module.css'

// Rota /editor/:id? — escolhe o currículo e mostra a área de edição.
export function Editor() {
  const { id } = useParams()
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

  function chooseTemplate(id) {
    setTemplateId(id)
    setSearchParams({ modelo: id }, { replace: true })
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
    setFormKey((key) => key + 1)
  }

  // Pendências não impedem o PDF: a pessoa vê o que revisar e decide se gera mesmo assim.
  function savePdf() {
    if (errorCount > 0) {
      setShowAllErrors(true)
      const message =
        errorCount === 1
          ? 'Há 1 campo para revisar no currículo. Gerar o PDF mesmo assim?'
          : `Há ${errorCount} campos para revisar no currículo. Gerar o PDF mesmo assim?`
      if (!window.confirm(message)) {
        showView('form')
        // Espera o formulário exibir as mensagens antes de levar a pessoa ao primeiro campo.
        requestAnimationFrame(() => {
          document.querySelector('[aria-invalid="true"]')?.focus()
        })
        return
      }
    }
    window.print()
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

          <div className={styles.templatePicker} role="radiogroup" aria-label="Modelo do currículo">
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                type="button"
                role="radio"
                aria-checked={template.id === templateId}
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
              Salvar PDF
            </Button>
          </div>
        </header>

        <div className={styles.viewTabs} role="tablist" aria-label="Alternar visualização">
          <button
            type="button"
            role="tab"
            aria-selected={view === 'form'}
            className={styles.viewTab}
            onClick={() => showView('form')}
          >
            Editar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'preview'}
            className={styles.viewTab}
            onClick={() => showView('preview')}
          >
            Visualizar
          </button>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.formPane} data-active={view === 'form'}>
          <div className={styles.formInner}>
            {inAppBrowser ? (
              <p className={styles.inAppNotice} role="note">
                <strong>Abra no Chrome ou no Safari.</strong> No navegador deste aplicativo, o PDF pode
                não ser gerado e o currículo fica salvo só aqui. Use o menu (⋯ ou ⋮) e escolha “Abrir no
                navegador” antes de começar.
              </p>
            ) : null}
            <p className={styles.saveStatus} data-warning={!draft.storageAvailable}>
              {draft.storageAvailable
                ? 'Rascunho salvo automaticamente neste navegador.'
                : 'Não foi possível salvar o rascunho neste navegador. Salve em PDF antes de sair.'}
            </p>
            <div className={styles.titleField}>
              <TextField
                label="Nome deste currículo"
                value={draft.title}
                onChange={draft.setTitle}
                placeholder={draft.autoTitle}
                hint="Aparece só na sua lista de currículos. Em branco, usamos seu nome e cargo."
              />
            </div>
            <ResumeForm
              key={formKey}
              resume={resume}
              actions={draft}
              errors={errors}
              showAllErrors={showAllErrors}
            />
            <div className={styles.mobileActions}>
              <Button variant="secondary" size="sm" onClick={fillWithSample}>
                Usar exemplo
              </Button>
              <Button variant="danger" size="sm" onClick={clearAll} disabled={isEmpty}>
                Limpar
              </Button>
            </div>
            <p className={styles.formFooter}>
              <Link to="/curriculos">Ver meus currículos</Link> · Precisa de outro visual?{' '}
              <Link to="/modelos">Compare os modelos</Link>.
            </p>
          </div>
        </div>

        <div className={styles.previewPane} data-active={view === 'preview'}>
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
