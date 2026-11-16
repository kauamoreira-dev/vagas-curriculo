# Currículo Tapajós

Gerador de currículos gratuito, sem cadastro, que funciona direto no navegador.

**Demo:** https://curriculo-tapajos.vercel.app

Montar um currículo apresentável costuma exigir um editor de texto, um modelo pago ou um cadastro
em algum site. O Currículo Tapajós resolve isso no celular ou no computador: a pessoa preenche os
dados, vê a folha A4 tomando forma e salva em PDF, sem criar conta e sem enviar dados a servidores.

## Funcionalidades

- Editor com prévia da folha A4 em tempo real e três modelos (Clássico, Moderno e Essencial)
- Estimativa do número de páginas enquanto o currículo é editado
- PDF pela janela de impressão do navegador, com quebras de página que não deixam seções isoladas
- Vários currículos salvos no armazenamento local do navegador, sem cadastro
- Backup e restauração dos currículos em arquivo, inclusive com foto
- Tratamento de conflito quando o mesmo currículo está aberto em duas abas, sem perda silenciosa de edições
- Resumo dos campos que ainda precisam ser corrigidos
- Layout pensado para telas de toque, a partir de 320 px de largura

## Stack

- React 19, React Router 7 e Vite
- CSS Modules, com tokens de design em `src/index.css`
- Vitest e Testing Library (testes unitários e de componentes)
- Playwright (testes E2E em perfil de celular e de desktop)
- Oxlint, GitHub Actions (lint, testes, build e E2E a cada push) e Vercel

Projeto independente: não compartilha código nem dependências com o Vagas Tapajós.

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
| `npm test`        | Roda os testes uma vez (Vitest)            |
| `npm run test:watch` | Roda os testes a cada alteração         |
| `npm run test:e2e` | Roda os testes E2E (Playwright) em celular e desktop |

Antes do primeiro `npm run test:e2e`, instale o navegador: `npx playwright install chromium`.

## Estrutura

```
public/brand/         logo oficial (não editar o arquivo)
e2e/                  testes E2E (Playwright)
src/
  components/
    layout/           Header, Footer, Logo e layouts das páginas
    ui/               componentes básicos (Button)
    resume/           folha A4 e os modelos de currículo (templates/)
    editor/           formulário do editor
    backup/           painel de backup e restauração
  data/               catálogo de modelos, currículo vazio e exemplo fictício
  hooks/              rascunho local, lista de currículos, medidas e media queries
  pages/              Home, Templates (/modelos), Curriculos (/curriculos), Editor (/editor), NotFound
  services/           armazenamento dos currículos e backup em arquivo
  utils/              funções auxiliares (texto, ids, localStorage, validação) e seus testes (*.test.js)
  index.css           tokens de design (cores, tipografia, espaços) e estilos globais
```

Rotas: `/` (início), `/modelos`, `/curriculos` (currículos salvos) e `/editor/:id?`
(sem `id`, cria um currículo novo; aceita `?modelo=classico|moderno|essencial`).

Importações podem usar o alias `@` para `src/` (ex.: `import { Button } from '@/components/ui/Button'`).

Para adicionar um modelo: crie o componente e o CSS em `src/components/resume/templates/`,
registre-o em `ResumeDocument.jsx` e adicione os metadados em `src/data/templates.js`.

## Variáveis de ambiente

Copie `.env.example` para `.env.local`. Apenas variáveis com prefixo `VITE_` ficam disponíveis no navegador.
