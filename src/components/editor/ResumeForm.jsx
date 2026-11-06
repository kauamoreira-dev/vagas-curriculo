import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { formatPhone } from '@/utils/validation'
import { FieldRow, FormSection, RepeatableItem, TextField } from './fields'
import { PhotoField } from './PhotoField'

/**
 * Formulário do currículo. Recebe o estado e as ações de `useResumeDraft`.
 * `errors` vem de `validateResume`; cada mensagem só aparece depois que a pessoa sai do campo
 * ou quando `showAllErrors` está ativo (tentativa de gerar o PDF).
 */
export function ResumeForm({ resume, actions, errors = {}, showAllErrors = false }) {
  const { personal } = resume
  const { setPersonalField, setField, addItem, updateItem, removeItem, moveItem } = actions
  const [touched, setTouched] = useState(() => new Set())

  // `alsoShownAfter`: outros campos cuja visita também revela a mensagem deste.
  function validation(key, alsoShownAfter = []) {
    const visited = [key, ...alsoShownAfter].some((name) => touched.has(name))
    return {
      error: showAllErrors || visited ? errors[key] : undefined,
      onBlur: () => setTouched((current) => (current.has(key) ? current : new Set(current).add(key))),
    }
  }

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate>
      <FormSection
        id="secao-dados"
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
        <FieldRow>
          <TextField
            label="Cidade"
            value={personal.location}
            onChange={(value) => setPersonalField('location', value)}
            placeholder="Ex.: Santarém, PA"
          />
          <TextField
            label="LinkedIn ou site"
            value={personal.link}
            onChange={(value) => setPersonalField('link', value)}
            placeholder="linkedin.com/in/seu-nome"
          />
        </FieldRow>
      </FormSection>

      <FormSection
        id="secao-resumo"
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
        id="secao-experiencia"
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
            title={item.role || item.company || `Experiência ${index + 1}`}
            index={index}
            total={resume.experience.length}
            onMoveUp={() => moveItem('experience', item.id, -1)}
            onMoveDown={() => moveItem('experience', item.id, 1)}
            onRemove={() => removeItem('experience', item.id)}
          >
            <FieldRow>
              <TextField
                label="Cargo"
                required
                {...validation(`experience.${item.id}.role`)}
                value={item.role}
                onChange={(value) => updateItem('experience', item.id, 'role', value)}
              />
              <TextField
                label="Empresa"
                required
                {...validation(`experience.${item.id}.company`)}
                value={item.company}
                onChange={(value) => updateItem('experience', item.id, 'company', value)}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                label="Início"
                {...validation(`experience.${item.id}.start`)}
                value={item.start}
                onChange={(value) => updateItem('experience', item.id, 'start', value)}
                placeholder="mar/2022"
              />
              <TextField
                label="Fim"
                {...validation(`experience.${item.id}.end`)}
                value={item.end}
                onChange={(value) => updateItem('experience', item.id, 'end', value)}
                placeholder="Atual"
              />
            </FieldRow>
            <TextField
              label="Atividades e resultados"
              multiline
              rows={4}
              value={item.description}
              onChange={(value) => updateItem('experience', item.id, 'description', value)}
              hint="Uma atividade por linha. Cada linha vira um tópico no currículo."
            />
          </RepeatableItem>
        ))}
      </FormSection>

      <FormSection
        id="secao-formacao"
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
            title={item.course || item.institution || `Formação ${index + 1}`}
            index={index}
            total={resume.education.length}
            onMoveUp={() => moveItem('education', item.id, -1)}
            onMoveDown={() => moveItem('education', item.id, 1)}
            onRemove={() => removeItem('education', item.id)}
          >
            <TextField
              label="Curso"
              required
              {...validation(`education.${item.id}.course`)}
              value={item.course}
              onChange={(value) => updateItem('education', item.id, 'course', value)}
            />
            <TextField
              label="Instituição"
              required
              {...validation(`education.${item.id}.institution`)}
              value={item.institution}
              onChange={(value) => updateItem('education', item.id, 'institution', value)}
            />
            <FieldRow>
              <TextField
                label="Início"
                {...validation(`education.${item.id}.start`)}
                value={item.start}
                onChange={(value) => updateItem('education', item.id, 'start', value)}
                placeholder="2019"
              />
              <TextField
                label="Conclusão"
                {...validation(`education.${item.id}.end`)}
                value={item.end}
                onChange={(value) => updateItem('education', item.id, 'end', value)}
                placeholder="2023 ou Em andamento"
              />
            </FieldRow>
          </RepeatableItem>
        ))}
      </FormSection>

      <FormSection id="secao-habilidades" title="Habilidades">
        <TextField
          label="Habilidades"
          multiline
          rows={3}
          value={resume.skills}
          onChange={(value) => setField('skills', value)}
          hint="Separe por vírgula. Ex.: Excel, Atendimento ao cliente, Inglês intermediário"
        />
      </FormSection>
    </form>
  )
}
