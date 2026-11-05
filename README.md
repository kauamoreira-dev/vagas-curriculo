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
src/
  assets/       imagens e arquivos estáticos importados no código
  components/   componentes reutilizáveis
  pages/        telas da aplicação
  hooks/        hooks customizados
  services/     acesso a APIs e integrações
  utils/        funções auxiliares
  App.jsx       componente raiz
  main.jsx      ponto de entrada
```

Importações podem usar o alias `@` para `src/` (ex.: `import Botao from '@/components/Botao'`).

## Variáveis de ambiente

Copie `.env.example` para `.env.local`. Apenas variáveis com prefixo `VITE_` ficam disponíveis no navegador.
