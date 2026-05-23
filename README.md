# ⏱ Controle de Horas Trabalhadas

Sistema web para registrar e totalizar horas de trabalho por tipo — **reuniões**, **atividades** e **pausas** — com calendário mensal e resumo automático.

![Static Site](https://img.shields.io/badge/site-static-blue?style=flat-square)
![Vercel](https://img.shields.io/badge/deploy-vercel-black?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## Funcionalidades

- Registro de entradas com horário início/fim, tipo e descrição
- Colunas separadas para **Tipo** e **Descrição**
- Cálculo automático de duração por entrada e por dia
- Múltiplos dias com ordenação cronológica
- **Calendário mensal** com barras de horas por dia (reunião · atividade · pausa)
- Adicionar / remover dias com seleção interativa por clique no card
- **Resumo geral** com:
  - Card hero de total em destaque
  - Métricas de reuniões e atividades
  - **Resumo mensal** (substituindo "Pausas")
  - Barras comparativas
- Tema claro e escuro automático (`prefers-color-scheme`)
- Layout responsivo — funciona em mobile
- Zero dependências — HTML + CSS + JS puro

---

## Estrutura

```
controle-horas/
├── index.html          ← entrada da aplicação
├── src/
│   ├── app.js          ← toda a lógica (estado, render, ações)
│   └── style.css       ← estilos com tokens e dark mode
├── public/
│   └── favicon.svg     ← ícone SVG
├── vercel.json         ← configuração de deploy
├── package.json        ← scripts de dev/build
├── .gitignore
└── README.md
```

---

## Rodar localmente

```bash
# Clone
git clone https://github.com/seu-usuario/controle-horas.git
cd controle-horas

# Sem servidor (abre direto)
open index.html

# Com servidor local (recomendado)
npx serve . -p 3000
# → http://localhost:3000
```

---

## Deploy no Vercel

### Opção 1 — Via CLI (recomendado)

```bash
npm i -g vercel   # instalar uma vez
vercel            # faz login e pergunta o projeto
vercel --prod     # deploy em produção
```

### Opção 2 — Via GitHub (automático)

1. Suba o repositório no GitHub
2. Acesse [vercel.com/new](https://vercel.com/new)
3. Importe o repositório
4. Deixe tudo padrão e clique **Deploy**
5. Cada `git push` fará deploy automático

### Opção 3 — Drag & Drop

1. Acesse [app.netlify.com/drop](https://app.netlify.com/drop) ou [vercel.com/new](https://vercel.com/new)
2. Arraste a pasta do projeto
3. URL pública gerada na hora

---

## Subir para o GitHub

```bash
git init
git add .
git commit -m "feat: controle de horas v2.0"

# Crie o repositório no GitHub e então:
git remote add origin https://github.com/seu-usuario/controle-horas.git
git branch -M main
git push -u origin main
```

---

## Tecnologias

| Camada | Tecnologia |
|--------|-----------|
| Estrutura | HTML5 semântico |
| Estilos | CSS3 com custom properties e `@media prefers-color-scheme` |
| Lógica | JavaScript ES2020 (vanilla, sem bundler) |
| Deploy | Vercel (static) |

---

## Licença

MIT — use, modifique e distribua livremente.
