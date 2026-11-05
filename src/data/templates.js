// Catálogo de modelos. O `id` é usado na URL (/editor?modelo=id) e no rascunho salvo.
export const TEMPLATES = [
  {
    id: 'classico',
    name: 'Clássico',
    description:
      'Uma coluna, títulos com serifa e separadores finos. Funciona bem em áreas tradicionais e concursos.',
    bestFor: 'Direito, administração, setor público',
  },
  {
    id: 'moderno',
    name: 'Moderno',
    description:
      'Coluna lateral em azul com contato e habilidades; experiência em destaque na área principal.',
    bestFor: 'Tecnologia, marketing, comercial',
  },
  {
    id: 'essencial',
    name: 'Essencial',
    description: 'Rótulos à esquerda e conteúdo à direita, sem cor. Direto e fácil de escanear.',
    bestFor: 'Primeiro emprego, estágio, operações',
  },
]

export const DEFAULT_TEMPLATE_ID = TEMPLATES[0].id

export function getTemplate(id) {
  return TEMPLATES.find((template) => template.id === id)
}
