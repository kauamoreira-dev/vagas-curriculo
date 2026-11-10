import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { LANGUAGE_LEVELS, STATES } from '@/data/resume'
import { errorSeverity, formatPhone, formatZip, splitBySeverity } from '@/utils/validation'
import {
  ChoiceField,
  FieldRow,
  FormSection,
  RepeatableItem,
  SelectField,
  SubGroup,
  TagField,
  TextField,
} from './fields'
import { PhotoField } from './PhotoField'
import { SectionIndex } from './SectionIndex'
import { ValidationSummary } from './ValidationSummary'
import styles from './fields.module.css'

/*
 * Grupos do formulário, na ordem em que aparecem. A chave é o prefixo das chaves de erro
 * (`experience.<id>.role`) e do conteúdo no currículo.
 * `level`: 'required' (tem campos obrigatórios), 'recommended' (esperado num currículo, mas pode
 * ficar vazio) ou 'optional'. Os dois primeiros níveis começam abertos; os opcionais, fechados,
 * a não ser que já tenham conteúdo.
 */
const GROUPS = {
  personal: { id: 'secao-dados', title: 'Dados pessoais', level: 'required' },
  objective: { id: 'secao-objetivo', title: 'Objetivo profissional', level: 'optional' },
  summary: { id: 'secao-resumo', title: 'Resumo', level: 'recommended' },
  experience: { id: 'secao-experiencia', title: 'Experiência', level: 'recommended' },
  education: { id: 'secao-formacao', title: 'Formação', level: 'recommended' },
  courses: { id: 'secao-cursos', title: 'Cursos complementares', level: 'optional' },
  certifications: { id: 'secao-certificacoes', title: 'Certificações', level: 'optional' },
  projects: { id: 'secao-projetos', title: 'Projetos', level: 'optional' },
  skills: { id: 'secao-habilidades', title: 'Habilidades', level: 'recommended' },
  languages: { id: 'secao-idiomas', title: 'Idiomas', level: 'optional' },
  additionalInfo: { id: 'secao-adicionais', title: 'Informações adicionais', level: 'optional' },
}

const LEVEL_LABEL = { required: 'Obrigatório', recommended: 'Recomendado', optional: 'Opcional' }

// Nome de cada item repetível na interface: o campo principal ou, vazio, "Experiência 2".
const ITEM_NAMES = {
  experience: { noun: 'Experiência', label: (item) => item.role || item.company },
  education: { noun: 'Formação', label: (item) => item.course || item.institution },
  courses: { noun: 'Curso', label: (item) => item.name },
  certifications: { noun: 'Certificação', label: (item) => item.name },
  projects: { noun: 'Projeto', label: (item) => item.name },
  languages: { noun: 'Idioma', label: (item) => item.language },
}

function itemTitle(section, item, index) {
  const { noun, label } = ITEM_NAMES[section]
  return label(item)?.trim() || `${noun} ${index + 1}`
}

const hasText = (value) => typeof value === 'string' && Boolean(value.trim())
const hasItems = (items) => items.some((item) => Object.entries(item).some(([key, value]) => key !== 'id' && hasText(value)))

function groupHasContent(group, resume) {
  if (group === 'personal') {
    return Object.entries(resume.personal).some(
      ([field, value]) => !['photoVisible', 'addressDisplay'].includes(field) && hasText(value),
    )
  }
  if (group === 'skills') return resume.skills.length > 0 || resume.softSkills.length > 0
  const value = resume[group]
  return Array.isArray(value) ? hasItems(value) : hasText(value)
}

function initialOpenGroups(resume) {
  return new Set(
    Object.keys(GROUPS).filter((group) => GROUPS[group].level !== 'optional' || groupHasContent(group, resume)),
  )
}

const groupOfError = (key) => key.split('.')[0]

// Rótulo do grupo fechado: "1 item", "3 cursos"; nada quando vazio.
const countLabel = (count, singular, plural) =>
  count === 0 ? undefined : count === 1 ? `1 ${singular}` : `${count} ${plural}`

// Leva o foco (e a rolagem) até o campo de uma pendência, depois que o grupo dele abrir.
function focusField(key) {
  requestAnimationFrame(() => document.querySelector(`[data-field="${key}"]`)?.focus())
}

/**
 * Formulário do currículo. Recebe o estado e as ações de `useResumeDraft`.
 * `errors` vem de `validateResume`; cada mensagem só aparece depois que a pessoa sai do campo
 * ou quando `showAllErrors` está ativo (tentativa de gerar o PDF). Erros ficam em vermelho;
 * avisos (itens opcionais incompletos, ver `errorSeverity`), em âmbar.
 * Cada mudança em `revealErrors` (um contador) abre os grupos que têm pendências.
 * `summaryOpen` mostra o resumo de pendências no topo; `onPrint` gera o PDF a partir dele.
 */
export function ResumeForm({
  resume,
  actions,
  errors = {},
  showAllErrors = false,
  revealErrors = 0,
  summaryOpen = false,
  onPrint,
  onCloseSummary,
}) {
  const { personal } = resume
  const { setPersonalField, setField, addItem, updateItem, removeItem, restoreItem, moveItem, addSkills, removeSkill } =
    actions
  const [touched, setTouched] = useState(() => new Set())
  const [openGroups, setOpenGroups] = useState(() => initialOpenGroups(resume))
  const [revealed, setRevealed] = useState(revealErrors)
  // Último item removido, para "Desfazer": { section, item, index, title }.
  const [removed, setRemoved] = useState(null)
  const undoRef = useRef(null)

  // Nova tentativa de gerar o PDF com pendências: abre os grupos onde elas estão.
  if (revealed !== revealErrors) {
    setRevealed(revealErrors)
    setOpenGroups((current) => new Set([...current, ...Object.keys(errors).map(groupOfError)]))
  }

  // Ao remover, o foco vai para "Desfazer" (o botão Remover sumiu junto com o item).
  useEffect(() => {
    if (removed) undoRef.current?.focus()
  }, [removed])

  const { blocking, warnings } = splitBySeverity(errors)
  const groupsWithErrors = new Set(blocking.map(groupOfError))
  const groupsWithWarnings = new Set(warnings.map(groupOfError))

  // Problema do grupo, só depois de uma tentativa de gerar o PDF: 'error', 'warning' ou nada.
  function groupIssue(name) {
    if (!showAllErrors) return undefined
    if (groupsWithErrors.has(name)) return 'error'
    return groupsWithWarnings.has(name) ? 'warning' : undefined
  }

  // `alsoShownAfter`: outros campos cuja visita também revela a mensagem deste.
  function validation(key, alsoShownAfter = []) {
    const visited = [key, ...alsoShownAfter].some((name) => touched.has(name))
    return {
      error: showAllErrors || visited ? errors[key] : undefined,
      tone: errorSeverity(key),
      'data-field': key,
      onBlur: () => setTouched((current) => (current.has(key) ? current : new Set(current).add(key))),
    }
  }

  function openGroup(name) {
    setOpenGroups((current) => (current.has(name) ? current : new Set(current).add(name)))
  }

  // Índice: abre a seção e leva até o título dela, com o foco no botão do grupo.
  function jumpTo(name) {
    openGroup(name)
    requestAnimationFrame(() => {
      const heading = document.getElementById(GROUPS[name].id)
      // A seção tem a margem de rolagem que a mantém abaixo do cabeçalho fixo.
      heading?.closest('section')?.scrollIntoView?.({ block: 'start' })
      heading?.querySelector('button')?.focus({ preventScroll: true })
    })
  }

  function goToIssue(key) {
    openGroup(groupOfError(key))
    focusField(key)
  }

  // Onde fica a pendência, para o resumo: "Experiência · Analista de Dados".
  function describe(key) {
    const [name, itemId] = key.split('.')
    const parts = [GROUPS[name]?.title ?? name]
    const items = ITEM_NAMES[name] ? resume[name] : null
    const index = items ? items.findIndex((item) => item.id === itemId) : -1
    if (index >= 0) parts.push(itemTitle(name, items[index], index))
    return { where: parts.join(' · '), message: errors[key] }
  }

  function removeWithUndo(section, item, index, title) {
    removeItem(section, item.id)
    setRemoved({ section, item, index, title })
  }

  // Devolve o item à posição original, com os dados de antes, e leva o foco ao primeiro campo dele.
  function undoRemove() {
    if (!removed) return
    const { section, item, index } = removed
    restoreItem(section, item, index)
    setRemoved(null)
    requestAnimationFrame(() => document.querySelector(`[data-field^="${section}.${item.id}."]`)?.focus())
  }

  // Propriedades comuns de um grupo expansível; `count` mostra quantos itens ele tem.
  function group(name, count) {
    const open = openGroups.has(name)
    const issue = groupIssue(name)
    return {
      id: GROUPS[name].id,
      title: GROUPS[name].title,
      badge: LEVEL_LABEL[GROUPS[name].level],
      open,
      onToggle: () =>
        setOpenGroups((current) => {
          const next = new Set(current)
          if (next.has(name)) next.delete(name)
          else next.add(name)
          return next
        }),
      statusTone: issue,
      status: issue === 'error' ? 'Corrigir' : issue === 'warning' ? 'Revisar' : !open && count ? count : undefined,
      notice:
        removed?.section === name ? (
          <div className={styles.undo} role="status">
            <span className={styles.undoText}>
              Removido: <strong>{removed.title}</strong>
            </span>
            <button ref={undoRef} type="button" className={styles.undoButton} onClick={undoRemove}>
              Desfazer
            </button>
            <button
              type="button"
              className={styles.undoClose}
              onClick={() => setRemoved(null)}
              aria-label="Fechar aviso de remoção"
            >
              ×
            </button>
          </div>
        ) : null,
    }
  }

  function itemProps(section, item, index) {
    const title = itemTitle(section, item, index)
    return {
      title,
      index,
      total: resume[section].length,
      onMoveUp: () => moveItem(section, item.id, -1),
      onMoveDown: () => moveItem(section, item.id, 1),
      onRemove: () => removeWithUndo(section, item, index, title),
    }
  }

  const indexSections = Object.entries(GROUPS).map(([name, config]) => {
    const filled = groupHasContent(name, resume)
    return {
      name,
      title: config.title,
      main: config.level !== 'optional',
      filled,
      state: groupIssue(name) ?? (filled ? 'filled' : 'empty'),
    }
  })

  // Campo de texto de um item repetível, já ligado à validação e à atualização.
  function itemField(section, item, field, props = {}) {
    return (
      <TextField
        {...validation(`${section}.${item.id}.${field}`)}
        value={item[field]}
        onChange={(value) => updateItem(section, item.id, field, value)}
        {...props}
      />
    )
  }

  const filledCount = (section) => resume[section].filter((item) => hasItems([item])).length
  const skillCount = resume.skills.length + resume.softSkills.length

  return (
    <>
      {summaryOpen ? (
        <ValidationSummary
          blocking={blocking}
          warnings={warnings}
          describe={describe}
          onGo={goToIssue}
          onPrint={onPrint}
          onClose={onCloseSummary}
        />
      ) : null}
      <SectionIndex sections={indexSections} onJump={jumpTo} />
      <form onSubmit={(event) => event.preventDefault()} noValidate>
        <FormSection
          {...group('personal')}
          description="Campos com * são obrigatórios. Informe ao menos um contato."
        >
          <PhotoField
            photo={personal.photo}
            visible={personal.photoVisible !== false}
            onPhotoChange={(value) => setPersonalField('photo', value)}
            onVisibleChange={(value) => setPersonalField('photoVisible', value)}
          />
          <TextField
            label="Nome completo"
            required
            {...validation('personal.name')}
            value={personal.name}
            onChange={(value) => setPersonalField('name', value)}
            autoComplete="name"
          />
          <TextField
            label="Cargo ou área"
            value={personal.title}
            onChange={(value) => setPersonalField('title', value)}
            placeholder="Ex.: Assistente administrativo"
            autoComplete="organization-title"
          />
          <FieldRow>
            <TextField
              label="E-mail"
              type="email"
              // O aviso "ao menos um contato" fica no e-mail, mas também aparece após visitar o telefone.
              {...validation('personal.email', ['personal.phone'])}
              value={personal.email}
              onChange={(value) => setPersonalField('email', value)}
              autoComplete="email"
            />
            <TextField
              label="Telefone"
              type="tel"
              inputMode="tel"
              mask={formatPhone}
              {...validation('personal.phone')}
              value={personal.phone}
              onChange={(value) => setPersonalField('phone', value)}
              autoComplete="tel"
              placeholder="(11) 91234-5678"
            />
          </FieldRow>
          <TextField
            label="LinkedIn ou site"
            value={personal.link}
            onChange={(value) => setPersonalField('link', value)}
            placeholder="linkedin.com/in/seu-nome"
          />
          <TextField
            label="Data de nascimento"
            type="date"
            {...validation('personal.birthDate')}
            value={personal.birthDate}
            onChange={(value) => setPersonalField('birthDate', value)}
            autoComplete="bday"
            hint="Opcional. O currículo mostra só a idade, calculada a partir desta data."
          />
          {personal.birthDate ? (
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={personal.ageVisible !== false}
                onChange={(event) => setPersonalField('ageVisible', event.target.checked)}
              />
              Mostrar idade no currículo
            </label>
          ) : null}

          <SubGroup title="Endereço">
            <div className={styles.cityRow}>
              <TextField
                label="Cidade"
                value={personal.city}
                onChange={(value) => setPersonalField('city', value)}
                placeholder="Ex.: Santarém"
                autoComplete="address-level2"
              />
              <SelectField
                label="Estado"
                value={personal.state}
                onChange={(value) => setPersonalField('state', value)}
                options={STATES}
                placeholder="UF"
                autoComplete="address-level1"
              />
            </div>
            <ChoiceField
              legend="No currículo, mostrar"
              value={personal.addressDisplay}
              onChange={(value) => setPersonalField('addressDisplay', value)}
              options={[
                { value: 'city', label: 'Só cidade e estado' },
                { value: 'full', label: 'Endereço completo' },
              ]}
            />
            {personal.addressDisplay === 'full' ? (
              <>
                <TextField
                  label="CEP"
                  inputMode="numeric"
                  mask={formatZip}
                  {...validation('personal.zip')}
                  value={personal.zip}
                  onChange={(value) => setPersonalField('zip', value)}
                  placeholder="66010-000"
                  autoComplete="postal-code"
                />
                <TextField
                  label="Rua"
                  value={personal.street}
                  onChange={(value) => setPersonalField('street', value)}
                  placeholder="Ex.: Rua das Flores"
                  autoComplete="address-line1"
                />
                <FieldRow>
                  <TextField
                    label="Número"
                    value={personal.number}
                    onChange={(value) => setPersonalField('number', value)}
                    inputMode="numeric"
                  />
                  <TextField
                    label="Complemento"
                    value={personal.complement}
                    onChange={(value) => setPersonalField('complement', value)}
                    placeholder="Apto, bloco (opcional)"
                    autoComplete="address-line2"
                  />
                </FieldRow>
                <TextField
                  label="Bairro"
                  value={personal.district}
                  onChange={(value) => setPersonalField('district', value)}
                  autoComplete="address-level3"
                />
                <p className={styles.hint}>Nenhum campo do endereço é obrigatório: só o que você preencher aparece.</p>
              </>
            ) : null}
          </SubGroup>
        </FormSection>

        <FormSection
          {...group('objective', hasText(resume.objective) ? 'Preenchido' : undefined)}
          description="A vaga ou área que você busca, em uma ou duas frases."
        >
          <TextField
            label="Objetivo"
            multiline
            rows={3}
            value={resume.objective}
            onChange={(value) => setField('objective', value)}
            placeholder="Ex.: Atuar como assistente administrativo, contribuindo com organização e atendimento."
          />
        </FormSection>

        <FormSection
          {...group('summary', hasText(resume.summary) ? 'Preenchido' : undefined)}
          description="Quem você é profissionalmente, em duas ou três linhas."
        >
          <TextField
            label="Resumo profissional"
            multiline
            rows={4}
            value={resume.summary}
            onChange={(value) => setField('summary', value)}
          />
        </FormSection>

        <FormSection
          {...group('experience', countLabel(filledCount('experience'), 'item', 'itens'))}
          description="Da mais recente para a mais antiga."
          action={
            <Button variant="secondary" size="sm" onClick={() => addItem('experience')}>
              Adicionar experiência
            </Button>
          }
        >
          {resume.experience.map((item, index) => (
            <RepeatableItem
              key={item.id}
              {...itemProps('experience', item, index)}
            >
              <FieldRow>
                {itemField('experience', item, 'role', { label: 'Cargo', required: true })}
                {itemField('experience', item, 'company', { label: 'Empresa', required: true })}
              </FieldRow>
              <FieldRow>
                {itemField('experience', item, 'start', { label: 'Início', placeholder: 'mar/2022' })}
                {itemField('experience', item, 'end', { label: 'Fim', placeholder: 'Atual' })}
              </FieldRow>
              {itemField('experience', item, 'description', {
                label: 'Atividades e resultados',
                multiline: true,
                rows: 4,
                hint: 'Uma atividade por linha. Cada linha vira um tópico no currículo.',
              })}
            </RepeatableItem>
          ))}
        </FormSection>

        <FormSection
          {...group('education', countLabel(filledCount('education'), 'item', 'itens'))}
          action={
            <Button variant="secondary" size="sm" onClick={() => addItem('education')}>
              Adicionar formação
            </Button>
          }
        >
          {resume.education.map((item, index) => (
            <RepeatableItem
              key={item.id}
              {...itemProps('education', item, index)}
            >
              {itemField('education', item, 'course', { label: 'Curso', required: true })}
              {itemField('education', item, 'institution', { label: 'Instituição', required: true })}
              <FieldRow>
                {itemField('education', item, 'start', { label: 'Início', placeholder: '2019' })}
                {itemField('education', item, 'end', { label: 'Conclusão', placeholder: '2023 ou Em andamento' })}
              </FieldRow>
            </RepeatableItem>
          ))}
        </FormSection>

        <FormSection
          {...group('courses', countLabel(filledCount('courses'), 'curso', 'cursos'))}
          description="Cursos livres, técnicos ou online."
          action={
            <Button variant="secondary" size="sm" onClick={() => addItem('courses')}>
              Adicionar curso
            </Button>
          }
        >
          {resume.courses.length === 0 ? <p className={styles.emptyList}>Nenhum curso adicionado.</p> : null}
          {resume.courses.map((item, index) => (
            <RepeatableItem key={item.id} {...itemProps('courses', item, index)}>
              {itemField('courses', item, 'name', { label: 'Nome do curso', required: true })}
              {itemField('courses', item, 'institution', { label: 'Instituição' })}
              <FieldRow>
                {itemField('courses', item, 'hours', { label: 'Carga horária (horas)', inputMode: 'numeric', placeholder: '40' })}
                {itemField('courses', item, 'year', { label: 'Ano de conclusão', inputMode: 'numeric', placeholder: '2024' })}
              </FieldRow>
            </RepeatableItem>
          ))}
        </FormSection>

        <FormSection
          {...group('certifications', countLabel(filledCount('certifications'), 'item', 'itens'))}
          description="Certificados profissionais, com validade e link quando houver."
          action={
            <Button variant="secondary" size="sm" onClick={() => addItem('certifications')}>
              Adicionar certificação
            </Button>
          }
        >
          {resume.certifications.length === 0 ? (
            <p className={styles.emptyList}>Nenhuma certificação adicionada.</p>
          ) : null}
          {resume.certifications.map((item, index) => (
            <RepeatableItem
              key={item.id}
              {...itemProps('certifications', item, index)}
            >
              {itemField('certifications', item, 'name', { label: 'Nome da certificação', required: true })}
              {itemField('certifications', item, 'issuer', { label: 'Instituição emissora' })}
              <FieldRow>
                {itemField('certifications', item, 'issued', { label: 'Data de emissão', placeholder: 'jun/2024' })}
                {itemField('certifications', item, 'expires', {
                  label: 'Validade',
                  placeholder: 'jun/2027',
                  hint: 'Deixe em branco se não expira.',
                })}
              </FieldRow>
              {itemField('certifications', item, 'url', {
                label: 'Link de verificação',
                type: 'url',
                inputMode: 'url',
                placeholder: 'Opcional',
              })}
            </RepeatableItem>
          ))}
        </FormSection>

        <FormSection
          {...group('projects', countLabel(filledCount('projects'), 'projeto', 'projetos'))}
          description="Trabalhos pessoais, acadêmicos ou voluntários que mostram o que você sabe fazer."
          action={
            <Button variant="secondary" size="sm" onClick={() => addItem('projects')}>
              Adicionar projeto
            </Button>
          }
        >
          {resume.projects.length === 0 ? <p className={styles.emptyList}>Nenhum projeto adicionado.</p> : null}
          {resume.projects.map((item, index) => (
            <RepeatableItem key={item.id} {...itemProps('projects', item, index)}>
              {itemField('projects', item, 'name', { label: 'Nome do projeto', required: true })}
              {itemField('projects', item, 'description', {
                label: 'Descrição',
                multiline: true,
                rows: 3,
                hint: 'Uma linha vira um parágrafo; várias linhas viram tópicos.',
              })}
              {itemField('projects', item, 'technologies', {
                label: 'Tecnologias utilizadas',
                placeholder: 'Ex.: React, Figma, Excel',
              })}
              {itemField('projects', item, 'url', { label: 'Link', type: 'url', inputMode: 'url', placeholder: 'Opcional' })}
            </RepeatableItem>
          ))}
        </FormSection>

        <FormSection
          {...group('skills', countLabel(skillCount, 'habilidade', 'habilidades'))}
          description="Adicione uma de cada vez. Com os dois tipos preenchidos, o currículo mostra cada grupo com um subtítulo."
        >
          <TagField
            label="Competências técnicas"
            items={resume.skills}
            onAdd={(value) => addSkills('skills', value)}
            onRemove={(index) => removeSkill('skills', index)}
            placeholder="Ex.: Excel"
            hint="Ferramentas e conhecimentos. Enter ou vírgula adiciona."
          />
          <TagField
            label="Competências comportamentais"
            items={resume.softSkills}
            onAdd={(value) => addSkills('softSkills', value)}
            onRemove={(index) => removeSkill('softSkills', index)}
            placeholder="Ex.: Trabalho em equipe"
            hint="Como você trabalha com as pessoas. Enter ou vírgula adiciona."
          />
        </FormSection>

        <FormSection
          {...group('languages', countLabel(filledCount('languages'), 'idioma', 'idiomas'))}
          action={
            <Button variant="secondary" size="sm" onClick={() => addItem('languages')}>
              Adicionar idioma
            </Button>
          }
        >
          {resume.languages.length === 0 ? <p className={styles.emptyList}>Nenhum idioma adicionado.</p> : null}
          {resume.languages.map((item, index) => (
            <RepeatableItem key={item.id} {...itemProps('languages', item, index)}>
              <FieldRow>
                {itemField('languages', item, 'language', { label: 'Idioma', required: true, placeholder: 'Ex.: Inglês' })}
                <SelectField
                  label="Nível"
                  value={item.level}
                  onChange={(value) => updateItem('languages', item.id, 'level', value)}
                  options={LANGUAGE_LEVELS}
                />
              </FieldRow>
            </RepeatableItem>
          ))}
        </FormSection>

        <FormSection
          {...group('additionalInfo', hasText(resume.additionalInfo) ? 'Preenchido' : undefined)}
          description="Disponibilidade, CNH, trabalho voluntário e outras qualificações."
        >
          <TextField
            label="Informações adicionais"
            multiline
            rows={4}
            value={resume.additionalInfo}
            onChange={(value) => setField('additionalInfo', value)}
            placeholder={'Ex.: CNH categoria B\nDisponibilidade para viagens'}
            hint="Uma informação por linha. Várias linhas viram tópicos no currículo."
          />
        </FormSection>
      </form>
    </>
  )
}
