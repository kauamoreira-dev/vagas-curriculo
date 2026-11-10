import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { LANGUAGE_LEVELS, STATES } from '@/data/resume'
import { formatPhone, formatZip } from '@/utils/validation'
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
import styles from './fields.module.css'

/*
 * Grupos do formulário. A chave é o prefixo das chaves de erro (`experience.<id>.role`) e do
 * conteúdo no currículo. `open`: começa aberto mesmo vazio (as seções de sempre); as opcionais
 * começam fechadas, a não ser que já tenham conteúdo.
 */
const GROUPS = {
  personal: { id: 'secao-dados', open: true },
  objective: { id: 'secao-objetivo' },
  summary: { id: 'secao-resumo', open: true },
  experience: { id: 'secao-experiencia', open: true },
  education: { id: 'secao-formacao', open: true },
  courses: { id: 'secao-cursos' },
  certifications: { id: 'secao-certificacoes' },
  projects: { id: 'secao-projetos' },
  skills: { id: 'secao-habilidades', open: true },
  languages: { id: 'secao-idiomas' },
  additionalInfo: { id: 'secao-adicionais' },
}

const hasText = (value) => typeof value === 'string' && Boolean(value.trim())
const hasItems = (items) => items.some((item) => Object.entries(item).some(([key, value]) => key !== 'id' && hasText(value)))

function groupHasContent(group, resume) {
  if (group === 'personal') return true
  if (group === 'skills') return resume.skills.length > 0 || resume.softSkills.length > 0
  const value = resume[group]
  return Array.isArray(value) ? hasItems(value) : hasText(value)
}

function initialOpenGroups(resume) {
  return new Set(Object.keys(GROUPS).filter((group) => GROUPS[group].open || groupHasContent(group, resume)))
}

const groupOfError = (key) => key.split('.')[0]

// Rótulo do grupo fechado: "1 item", "3 cursos"; nada quando vazio.
const countLabel = (count, singular, plural) =>
  count === 0 ? undefined : count === 1 ? `1 ${singular}` : `${count} ${plural}`

/**
 * Formulário do currículo. Recebe o estado e as ações de `useResumeDraft`.
 * `errors` vem de `validateResume`; cada mensagem só aparece depois que a pessoa sai do campo
 * ou quando `showAllErrors` está ativo (tentativa de gerar o PDF).
 * Cada mudança em `revealErrors` (um contador) abre os grupos que têm pendências.
 */
export function ResumeForm({ resume, actions, errors = {}, showAllErrors = false, revealErrors = 0 }) {
  const { personal } = resume
  const { setPersonalField, setField, addItem, updateItem, removeItem, moveItem, addSkills, removeSkill } = actions
  const [touched, setTouched] = useState(() => new Set())
  const [openGroups, setOpenGroups] = useState(() => initialOpenGroups(resume))
  const [revealed, setRevealed] = useState(revealErrors)

  // Nova tentativa de gerar o PDF com pendências: abre os grupos onde elas estão.
  if (revealed !== revealErrors) {
    setRevealed(revealErrors)
    setOpenGroups((current) => new Set([...current, ...Object.keys(errors).map(groupOfError)]))
  }

  const groupsWithErrors = new Set(Object.keys(errors).map(groupOfError))

  // `alsoShownAfter`: outros campos cuja visita também revela a mensagem deste.
  function validation(key, alsoShownAfter = []) {
    const visited = [key, ...alsoShownAfter].some((name) => touched.has(name))
    return {
      error: showAllErrors || visited ? errors[key] : undefined,
      onBlur: () => setTouched((current) => (current.has(key) ? current : new Set(current).add(key))),
    }
  }

  // Propriedades comuns de um grupo expansível; `count` mostra quantos itens ele tem.
  function group(name, count) {
    const open = openGroups.has(name)
    const alert = showAllErrors && groupsWithErrors.has(name)
    return {
      id: GROUPS[name].id,
      open,
      onToggle: () =>
        setOpenGroups((current) => {
          const next = new Set(current)
          if (next.has(name)) next.delete(name)
          else next.add(name)
          return next
        }),
      alert,
      status: alert ? 'Revisar' : !open && count ? count : undefined,
    }
  }

  function itemProps(section, item, index, fallbackTitle) {
    const items = resume[section]
    return {
      title: fallbackTitle,
      index,
      total: items.length,
      onMoveUp: () => moveItem(section, item.id, -1),
      onMoveDown: () => moveItem(section, item.id, 1),
      onRemove: () => removeItem(section, item.id),
    }
  }

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
    <form onSubmit={(event) => event.preventDefault()} noValidate>
      <FormSection
        {...group('personal')}
        title="Dados pessoais"
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
        title="Objetivo profissional"
        description="Opcional. A vaga ou área que você busca, em uma ou duas frases."
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
        title="Resumo"
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
        title="Experiência"
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
            {...itemProps('experience', item, index, item.role || item.company || `Experiência ${index + 1}`)}
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
        title="Formação"
        action={
          <Button variant="secondary" size="sm" onClick={() => addItem('education')}>
            Adicionar formação
          </Button>
        }
      >
        {resume.education.map((item, index) => (
          <RepeatableItem
            key={item.id}
            {...itemProps('education', item, index, item.course || item.institution || `Formação ${index + 1}`)}
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
        title="Cursos complementares"
        description="Opcional. Cursos livres, técnicos ou online."
        action={
          <Button variant="secondary" size="sm" onClick={() => addItem('courses')}>
            Adicionar curso
          </Button>
        }
      >
        {resume.courses.length === 0 ? <p className={styles.emptyList}>Nenhum curso adicionado.</p> : null}
        {resume.courses.map((item, index) => (
          <RepeatableItem key={item.id} {...itemProps('courses', item, index, item.name || `Curso ${index + 1}`)}>
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
        title="Certificações"
        description="Opcional. Certificados profissionais, com validade e link quando houver."
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
            {...itemProps('certifications', item, index, item.name || `Certificação ${index + 1}`)}
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
        title="Projetos"
        description="Opcional. Trabalhos pessoais, acadêmicos ou voluntários que mostram o que você sabe fazer."
        action={
          <Button variant="secondary" size="sm" onClick={() => addItem('projects')}>
            Adicionar projeto
          </Button>
        }
      >
        {resume.projects.length === 0 ? <p className={styles.emptyList}>Nenhum projeto adicionado.</p> : null}
        {resume.projects.map((item, index) => (
          <RepeatableItem key={item.id} {...itemProps('projects', item, index, item.name || `Projeto ${index + 1}`)}>
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
        title="Habilidades"
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
        title="Idiomas"
        description="Opcional."
        action={
          <Button variant="secondary" size="sm" onClick={() => addItem('languages')}>
            Adicionar idioma
          </Button>
        }
      >
        {resume.languages.length === 0 ? <p className={styles.emptyList}>Nenhum idioma adicionado.</p> : null}
        {resume.languages.map((item, index) => (
          <RepeatableItem key={item.id} {...itemProps('languages', item, index, item.language || `Idioma ${index + 1}`)}>
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
        title="Informações adicionais"
        description="Opcional. Disponibilidade, CNH, trabalho voluntário e outras qualificações."
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
  )
}
