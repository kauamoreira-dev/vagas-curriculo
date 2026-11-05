# Vagas Currículo

Projeto independente (React + Vite + JavaScript) para o desenvolvimento do Vagas Currículo.
Não compartilha código nem dependências com o Vagas Tapajós.

## Requisitos

- Node.js 20.19+ (ou 22.12+)
- npm

## Como executar

```bash
npm install
npm run dev
```

Acesse http://localhost:5174

## Scripts

| Comando           | Descrição                                  |
| ----------------- | ------------------------------------------ |
| `npm run dev`     | Servidor de desenvolvimento com HMR        |
| `npm run build`   | Build de produção em `dist/`               |
| `npm run preview` | Serve o build de produção localmente       |
| `npm run lint`    | Analisa o código com Oxlint                |

## Estrutura

```
public/brand/         logo oficial (não editar o arquivo)
src/
  components/
    layout/           Header, Footer, Logo e layouts das páginas
    ui/               componentes básicos (Button)
    resume/           folha A4 e os modelos de currículo (templates/)
    editor/           formulário do editor
  data/               catálogo de modelos, currículo vazio e exemplo fictício
  hooks/              useResumeDraft (rascunho local), useElementWidth
  pages/              Home, Templates (/modelos), Editor (/editor), NotFound
  utils/              funções auxiliares (texto, ids, localStorage)
  index.css           tokens de design (cores, tipografia, espaços) e estilos globais
```

Rotas: `/` (início), `/modelos`, `/editor` (aceita `?modelo=classico|moderno|essencial`).

Importações podem usar o alias `@` para `src/` (ex.: `import { Button } from '@/components/ui/Button'`).

Para adicionar um modelo: crie o componente e o CSS em `src/components/resume/templates/`,
registre-o em `ResumeDocument.jsx` e adicione os metadados em `src/data/templates.js`.

## Variáveis de ambiente

Copie `.env.example` para `.env.local`. Apenas variáveis com prefixo `VITE_` ficam disponíveis no navegador.
