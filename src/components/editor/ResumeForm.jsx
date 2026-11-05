import { Button } from '@/components/ui/Button'
import { FieldRow, FormSection, RepeatableItem, TextField } from './fields'

// Formulário do currículo. Recebe o estado e as ações de `useResumeDraft`.
export function ResumeForm({ resume, actions }) {
  const { personal } = resume
  const { setPersonalField, setField, addItem, updateItem, removeItem, moveItem } = actions

  return (
    <form onSubmit={(event) => event.preventDefault()} noValidate>
      <FormSection id="secao-dados" title="Dados pessoais">
        <TextField
          label="Nome completo"
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
            value={personal.email}
            onChange={(value) => setPersonalField('email', value)}
            autoComplete="email"
          />
          <TextField
            label="Telefone"
            type="tel"
            value={personal.phone}
            onChange={(value) => setPersonalField('phone', value)}
            autoComplete="tel"
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
                value={item.role}
                onChange={(value) => updateItem('experience', item.id, 'role', value)}
              />
              <TextField
                label="Empresa"
                value={item.company}
                onChange={(value) => updateItem('experience', item.id, 'company', value)}
              />
            </FieldRow>
            <FieldRow>
              <TextField
                label="Início"
                value={item.start}
                onChange={(value) => updateItem('experience', item.id, 'start', value)}
                placeholder="mar/2022"
              />
              <TextField
                label="Fim"
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
              value={item.course}
              onChange={(value) => updateItem('education', item.id, 'course', value)}
            />
            <TextField
              label="Instituição"
              value={item.institution}
              onChange={(value) => updateItem('education', item.id, 'institution', value)}
            />
            <FieldRow>
              <TextField
                label="Início"
                value={item.start}
                onChange={(value) => updateItem('education', item.id, 'start', value)}
                placeholder="2019"
              />
              <TextField
                label="Conclusão"
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
