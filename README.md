# ⏱ Controle de Horas Trabalhadas

Sistema web para registrar e totalizar horas de trabalho por tipo — **reuniões**, **atividades** e **pausas** — com calendário mensal, resumo automático e autenticação real.

[![Netlify](https://img.shields.io/badge/netlify-deployed-00C7B7?style=flat-square&logo=netlify)](https://app.netlify.com)
[![Supabase](https://img.shields.io/badge/supabase-postgres%20%2B%20auth-3FCF8E?style=flat-square&logo=supabase)](https://supabase.com)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Arquitetura

```
Navegador  ─────────────────►  Supabase
(HTML/CSS/JS estático)         ├── Auth        (signup, login, sessão)
                               └── Postgres    (3 tabelas com RLS)
```

**Zero backend custom.** O front-end conversa direto com o Supabase via `supabase-js`. Toda segurança vem das **Row Level Security (RLS) policies** no Postgres — cada usuário só enxerga e edita os próprios dados.

## Funcionalidades

- Cadastro e login com e-mail/senha via Supabase Auth
- Validação de e-mail e senha em tempo real, indicador de força (4 níveis)
- Sessão persistida automaticamente pelo SDK
- Registro de entradas por dia: início, fim, tipo, descrição
- Cálculo automático de duração por entrada e por dia
- Calendário mensal com barras de horas por dia
- Adicionar / remover dias com seleção interativa
- Resumo geral com total em destaque + resumo mensal
- Tema unificado terracotta / teal / espresso
- Layout responsivo mobile / tablet / desktop
- Tema dark com fontes Syne (display) + DM Sans (body)

## Estrutura

```
controle-horas/
├── index.html              ← tela de login (home)
├── app.html                ← dashboard principal
├── src/
│   ├── api.js              ← cliente Supabase (auth + CRUD)
│   ├── login.js            ← form de login/cadastro
│   ├── app.js              ← dashboard, calendário, resumo
│   ├── login.css           ← estilos do login
│   └── style.css           ← estilos do dashboard
├── public/favicon.svg
├── docs/
│   ├── requisitos.md
│   └── documentacao-controle-horas.docx
├── netlify.toml            ← config de deploy
├── package.json
└── README.md
```

## Schema do banco

| Tabela | Colunas principais | RLS |
|--------|--------------------|-----|
| `profiles` | id (FK → auth.users), name, email | usuário só lê/edita o próprio |
| `days` | id, user_id, date, unique(user_id,date) | CRUD restrito ao próprio user_id |
| `entries` | id, day_id, user_id, start_time, end_time, type, description, position | CRUD restrito ao próprio user_id |

Tipo `entry_type` enum: `meeting | activity | break`.
Triggers automáticos: criação de profile no signup, `updated_at` em updates.

## Rodar localmente

```bash
git clone https://github.com/vinytavares/Controle-de-Horas.git
cd Controle-de-Horas
npx serve . -p 3000
# → http://localhost:3000
```

Sem build step, sem dependências Node a instalar. O `supabase-js` é carregado via CDN.

## Deploy

O projeto é estático puro — funciona em qualquer CDN: Netlify, Vercel, GitHub Pages, Cloudflare Pages, S3+CloudFront, etc.

Cada `git push` na branch `main` dispara deploy automático na plataforma conectada.

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Estrutura | HTML5 semântico |
| Estilos | CSS3 com custom properties, prefers-color-scheme |
| Lógica | JavaScript ES2020 vanilla, sem bundler |
| Auth | Supabase Auth |
| Banco | Supabase Postgres + Row Level Security |
| Fontes | Syne + DM Sans (Google Fonts) |
| Hospedagem | Netlify (estático) |

## Licença

MIT — use, modifique e distribua livremente.
