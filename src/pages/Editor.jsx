import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { ResumeForm } from '@/components/editor/ResumeForm'
import { Logo } from '@/components/layout/Logo'
import { ResumeDocument } from '@/components/resume/ResumeDocument'
import { ScaledSheet } from '@/components/resume/ScaledSheet'
import { Button } from '@/components/ui/Button'
import { SAMPLE_RESUME } from '@/data/resume'
import { TEMPLATES, getTemplate } from '@/data/templates'
import { useResumeDraft } from '@/hooks/useResumeDraft'
import { hasEducationContent, hasExperienceContent } from '@/utils/resumeText'
import { validateResume } from '@/utils/validation'
import styles from './Editor.module.css'

function hasContent(resume) {
  const { personal } = resume
  return Boolean(
    // Só campos de texto contam (ex.: `photoVisible` é booleano).
    Object.values(personal).some((value) => typeof value === 'string' && value.trim()) ||
    resume.summary.trim() ||
    resume.skills.trim() ||
    resume.experience.some(hasExperienceContent) ||
    resume.education.some(hasEducationContent),
  )
}

export function Editor() {
  const draft = useResumeDraft()
  const { resume, templateId, setTemplateId } = draft
  const [searchParams, setSearchParams] = useSearchParams()
  const [view, setView] = useState('form')
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
    document.title = 'Editor · Vagas Currículo'
    return () => {
      document.title = 'Vagas Currículo'
    }
  }, [])

  function chooseTemplate(id) {
    setTemplateId(id)
    setSearchParams({ modelo: id }, { replace: true })
  }

  function fillWithSample() {
    if (hasContent(resume) && !window.confirm('Substituir o conteúdo atual pelo exemplo fictício?'))
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
        setView('form')
        // Espera o formulário exibir as mensagens antes de levar a pessoa ao primeiro campo.
        requestAnimationFrame(() => {
          document.querySelector('[aria-invalid="true"]')?.focus()
        })
        return
      }
    }
    window.print()
  }

  const isEmpty = !hasContent(resume)

  return (
    <div className={styles.app}>
      <div className={styles.chrome}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            <Logo />
            <span className={styles.crumb}>Editor</span>
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
            onClick={() => setView('form')}
          >
            Editar
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'preview'}
            className={styles.viewTab}
            onClick={() => setView('preview')}
          >
            Visualizar
          </button>
        </div>
      </div>

      <div className={styles.workspace}>
        <div className={styles.formPane} data-active={view === 'form'}>
          <div className={styles.formInner}>
            <p className={styles.saveStatus} data-warning={!draft.storageAvailable}>
              {draft.storageAvailable
                ? 'Rascunho salvo automaticamente neste navegador.'
                : 'Não foi possível salvar o rascunho neste navegador. Salve em PDF antes de sair.'}
            </p>
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
              Precisa de outro visual? <Link to="/modelos">Compare os modelos</Link>.
            </p>
          </div>
        </div>

        <div className={styles.previewPane} data-active={view === 'preview'}>
          <div className={styles.previewInner}>
            <ScaledSheet className={styles.sheet}>
              <ResumeDocument templateId={templateId} resume={resume} />
            </ScaledSheet>
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
