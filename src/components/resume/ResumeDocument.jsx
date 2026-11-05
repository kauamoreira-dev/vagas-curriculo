import { ClassicTemplate } from './templates/ClassicTemplate'
import { EssentialTemplate } from './templates/EssentialTemplate'
import { ModernTemplate } from './templates/ModernTemplate'

const TEMPLATE_COMPONENTS = {
  classico: ClassicTemplate,
  moderno: ModernTemplate,
  essencial: EssentialTemplate,
}

// Renderiza o currículo em tamanho real (A4) no modelo escolhido.
export function ResumeDocument({ templateId, resume }) {
  const Template = TEMPLATE_COMPONENTS[templateId] ?? ClassicTemplate
  return <Template resume={resume} />
}
