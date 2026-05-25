# ⏱ Controle de Horas Trabalhadas

Sistema web para registrar e totalizar horas de trabalho por tipo — **reuniões**, **atividades** e **pausas** — com calendário mensal, resumo automático e autenticação.

[![Deploy](https://img.shields.io/badge/vercel-deployed-black?style=flat-square&logo=vercel)](https://controle-de-horas-6ppskgvj0-vinytavares-projects.vercel.app)
[![GitHub](https://img.shields.io/badge/github-repo-181717?style=flat-square&logo=github)](https://github.com/vinytavares/Controle-de-Horas)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

## 🌐 Demo ao vivo

**[controle-de-horas-6ppskgvj0-vinytavares-projects.vercel.app](https://controle-de-horas-6ppskgvj0-vinytavares-projects.vercel.app)**

### Credenciais de acesso

| E-mail | Senha |
|--------|-------|
| `admin@horas.app` | `Admin@2025` |
| `demo@horas.app` | `Demo@1234` |

---

## Funcionalidades

- Tela de login com validação de e-mail e senha em tempo real
- Indicador de força de senha em 4 níveis (Fraca / Regular / Boa / Forte)
- Sessão autenticada com expiração de 8 horas
- Registro de entradas por dia (reunião, atividade, pausa)
- Colunas Tipo e Descrição separadas na grade
- Cálculo automático de duração por entrada e por dia
- Múltiplos dias com ordenação cronológica
- Calendário mensal com barras de horas por dia
- Adicionar / remover dias com seleção interativa por clique no card
- Resumo geral com card hero de total em destaque
- Resumo mensal no lugar de "Pausas" nos cards de métricas
- Barras comparativas por categoria
- Tema claro e escuro automático (`prefers-color-scheme`)
- Layout responsivo — mobile, tablet e desktop
- Zero dependências — HTML + CSS + JS puro

---

## Estrutura

```
controle-horas/
├── index.html              ← tela de login (home)
├── app.html                ← dashboard principal
├── src/
│   ├── app.js              ← lógica do dashboard (estado, render, ações)
│   ├── login.js            ← autenticação, validação e guard de sessão
│   ├── style.css           ← estilos do dashboard com dark mode
│   └── login.css           ← estilos do login — responsivo com clamp/dvh/env()
├── public/
│   └── favicon.svg
├── docs/
│   ├── requisitos.md                     ← documentação em Markdown
│   └── documentacao-controle-horas.docx  ← documentação completa em Word
├── vercel.json             ← rotas, headers de segurança e cache
├── package.json
├── .gitignore
└── README.md
```

---

## Rodar localmente

```bash
git clone https://github.com/vinytavares/Controle-de-Horas.git
cd Controle-de-Horas

# Abre direto no navegador
open index.html

# Com servidor local (recomendado)
npx serve . -p 3000
# → http://localhost:3000
```

---

## Deploy

O projeto está publicado na Vercel com deploy automático a cada `git push` na branch `main`.

```bash
# Instalar Vercel CLI
npm i -g vercel

# Deploy manual
vercel --prod
```

---

## Documentação

A documentação completa do projeto está em `/docs/` e inclui:

- Visão geral do negócio e proposta de valor
- 48 requisitos funcionais em 5 módulos
- Requisitos não funcionais (usabilidade, performance, segurança)
- 18 regras de negócio com IDs rastreáveis
- 10 histórias de usuário com critérios de aceite
- Fluxo de navegação e arquitetura de arquivos
- Glossário e roadmap futuro

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Estrutura | HTML5 semântico |
| Estilos | CSS3 com custom properties e `prefers-color-scheme` |
| Lógica | JavaScript ES2020 vanilla (sem bundler) |
| Auth | localStorage com TTL de 8h |
| Deploy | Vercel (static) com CI/CD via GitHub |

---

## Licença

MIT — use, modifique e distribua livremente.
