# Controle de Horas — Documento de Negócio

**Versão:** 2.0  
**Data:** Maio de 2025  
**Status:** Em desenvolvimento

---

## 1. Visão Geral do Negócio

### 1.1 Descrição do Produto

O **Controle de Horas** é uma aplicação web voltada para profissionais e equipes que precisam registrar, categorizar e acompanhar o tempo dedicado às suas atividades de trabalho. A ferramenta permite classificar o tempo entre reuniões, atividades produtivas e pausas, gerando relatórios automáticos diários e mensais.

### 1.2 Problema que Resolve

Profissionais de tecnologia, consultores e gestores frequentemente perdem o controle de como distribuem seu tempo de trabalho. Sem visibilidade sobre quanto tempo é gasto em reuniões versus atividades de produção, torna-se difícil:

- Identificar gargalos de produtividade
- Justificar horas para clientes ou gestores
- Equilibrar a agenda entre trabalho estratégico e operacional
- Gerar relatórios precisos para faturamento ou avaliação de desempenho

### 1.3 Público-Alvo

| Perfil | Descrição |
|--------|-----------|
| Desenvolvedores | Precisam registrar horas por projeto para controle de sprint |
| Consultores | Necessitam de relatório de horas para faturamento ao cliente |
| Gestores | Querem visibilidade do tempo da equipe em reuniões vs. produção |
| Freelancers | Precisam comprovar horas trabalhadas para cobrar clientes |

### 1.4 Proposta de Valor

> *"Saiba exatamente onde seu tempo vai — em segundos, sem fricção."*

- Registro rápido: início + fim + tipo + descrição em uma linha
- Cálculo automático sem configuração
- Calendário visual com histórico de horas por dia
- Resumo mensal integrado ao dashboard

---

## 2. Requisitos Funcionais

### RF-01 — Autenticação
| ID | Requisito |
|----|-----------|
| RF-01.1 | O sistema deve exibir uma tela de login com campos de e-mail e senha |
| RF-01.2 | O sistema deve validar o formato do e-mail antes de enviar o formulário |
| RF-01.3 | O sistema deve validar que a senha possui no mínimo 8 caracteres |
| RF-01.4 | O sistema deve exibir indicador visual de força da senha em tempo real |
| RF-01.5 | O sistema deve manter a sessão do usuário por 8 horas via localStorage |
| RF-01.6 | O sistema deve redirecionar para login ao detectar sessão expirada |
| RF-01.7 | O sistema deve permitir logout com limpeza da sessão |
| RF-01.8 | O sistema deve exibir o nome e iniciais do usuário logado no topo do app |

### RF-02 — Gestão de Dias
| ID | Requisito |
|----|-----------|
| RF-02.1 | O usuário deve poder adicionar novos dias de trabalho |
| RF-02.2 | O sistema deve sugerir a próxima data disponível ao adicionar um dia |
| RF-02.3 | O usuário deve poder remover dias através de seleção interativa no card |
| RF-02.4 | O sistema deve exibir confirmação antes de remover um dia |
| RF-02.5 | Os dias devem ser exibidos em ordem cronológica crescente |
| RF-02.6 | O usuário deve poder alterar a data de um dia diretamente no card |

### RF-03 — Registro de Entradas
| ID | Requisito |
|----|-----------|
| RF-03.1 | Cada entrada deve conter: horário de início, horário de fim, tipo e descrição |
| RF-03.2 | O tipo de entrada deve ser selecionável entre: Reunião, Atividade ou Pausa |
| RF-03.3 | O sistema deve calcular e exibir a duração automaticamente ao preencher início e fim |
| RF-03.4 | Ao adicionar nova entrada, o horário de início deve ser pré-preenchido com o fim da entrada anterior |
| RF-03.5 | O usuário deve poder remover entradas individualmente |
| RF-03.6 | As colunas Tipo e Descrição devem ser exibidas separadamente na grade |

### RF-04 — Calendário
| ID | Requisito |
|----|-----------|
| RF-04.1 | O sistema deve exibir um calendário mensal acessível por botão na topbar |
| RF-04.2 | O calendário deve exibir barras de horas por dia (reunião, atividade, pausa) |
| RF-04.3 | O tamanho das barras deve ser proporcional ao maior total do mês |
| RF-04.4 | O usuário deve poder navegar entre meses pelo calendário |
| RF-04.5 | Clicar em um dia no calendário deve criar esse dia (se não existir) e rolar até ele |
| RF-04.6 | O dia atual deve ser destacado visualmente no calendário |

### RF-05 — Resumo e Relatórios
| ID | Requisito |
|----|-----------|
| RF-05.1 | O sistema deve exibir o total geral de horas em um card hero de destaque |
| RF-05.2 | O sistema deve exibir o total de horas de reuniões com percentual do tempo |
| RF-05.3 | O sistema deve exibir o total de horas de atividades com percentual do tempo |
| RF-05.4 | O sistema deve exibir um resumo mensal com total, reuniões e atividades do mês atual |
| RF-05.5 | O sistema deve exibir barras comparativas entre os três tipos de entrada |
| RF-05.6 | Cada card de dia deve exibir subtotais em pills coloridos por tipo |

---

## 3. Requisitos Não Funcionais

### RNF-01 — Usabilidade
- A interface deve ser operável sem treinamento em até 2 minutos
- O feedback de validação deve ser exibido em tempo real (< 100ms)
- Todas as ações destrutivas devem exigir confirmação explícita

### RNF-02 — Performance
- A aplicação deve carregar em menos de 2 segundos em conexão 4G
- O recálculo de totais deve ocorrer em menos de 50ms
- A animação do calendário deve ser fluída (60fps)

### RNF-03 — Compatibilidade
- Suporte a Chrome, Firefox, Safari e Edge (últimas 2 versões)
- Layout responsivo para telas a partir de 320px de largura
- Suporte completo a tema claro e escuro via `prefers-color-scheme`

### RNF-04 — Segurança
- Sessão com expiração automática em 8 horas
- Senhas nunca armazenadas em texto puro (em produção, usar hash bcrypt)
- Headers de segurança configurados no deploy (X-Frame-Options, X-Content-Type-Options)
- Token de autenticação não exposto em URL

### RNF-05 — Manutenibilidade
- Zero dependências de terceiros no frontend
- JavaScript organizado em funções puras e estado centralizado
- CSS com design tokens via custom properties (fácil re-tema)
- Código documentado com comentários de seção

### RNF-06 — Deploy
- Suporte a deploy estático no Vercel e Netlify
- Cache de assets estáticos com `max-age=31536000`
- Arquivo `vercel.json` com rotas, headers e cache configurados

---

## 4. Regras de Negócio

### RN-01 — Cálculo de Tempo
- **RN-01.1:** A duração de uma entrada é calculada como `fim - início` em minutos. Entradas com `fim ≤ início` resultam em duração zero e não são contabilizadas.
- **RN-01.2:** O total de um dia é a soma de todas as entradas, independente do tipo.
- **RN-01.3:** O total geral é a soma de todos os dias cadastrados.
- **RN-01.4:** O resumo mensal considera apenas dias cuja data pertence ao mês e ano atuais.

### RN-02 — Tipos de Entrada
- **RN-02.1:** Somente três tipos são permitidos: `meeting` (Reunião), `activity` (Atividade), `break` (Pausa).
- **RN-02.2:** O tipo padrão de uma nova entrada é `activity`.
- **RN-02.3:** Pausas são contabilizadas no total do dia mas não aparecem nos cards de métricas do resumo geral — apenas nas barras comparativas.

### RN-03 — Datas
- **RN-03.1:** Não é permitido ter dois dias com a mesma data.
- **RN-03.2:** Ao adicionar um dia, o sistema busca a primeira data disponível a partir do dia atual.
- **RN-03.3:** Alterar a data de um dia reordena automaticamente a lista cronologicamente.

### RN-04 — Sessão e Acesso
- **RN-04.1:** Usuários não autenticados são redirecionados para `/login.html`.
- **RN-04.2:** A sessão expira após 8 horas da autenticação, independente de atividade.
- **RN-04.3:** O logout limpa a sessão do localStorage e redireciona para login.
- **RN-04.4:** O sistema exibe nome e iniciais do usuário logado em todas as páginas protegidas.

### RN-05 — Validação de Senha
- **RN-05.1:** Comprimento mínimo de 8 caracteres.
- **RN-05.2:** A força é calculada em 4 níveis (Fraca, Regular, Boa, Forte) com base em comprimento, uso de maiúsculas/minúsculas, números e caracteres especiais.
- **RN-05.3:** Senhas com menos de 8 caracteres são classificadas como Fraca e bloqueiam o envio.

### RN-06 — Remoção de Dados
- **RN-06.1:** A remoção de um dia exige dois gestos: ativar o modo de remoção + clicar no card desejado + confirmar.
- **RN-06.2:** Não é possível remover o último dia restante (deve haver pelo menos 1 dia).
- **RN-06.3:** A remoção de uma entrada dentro de um dia é imediata (sem confirmação adicional), por ser reversível recriando a entrada.

---

## 5. Histórias de Usuário

### Épico 1 — Autenticação

---

**US-01 — Login com e-mail e senha**

> *Como usuário registrado, quero entrar no sistema com meu e-mail e senha para acessar meus registros de horas.*

**Critérios de Aceite:**
- [ ] Exibe campos de e-mail e senha com ícones representativos
- [ ] Valida o formato do e-mail em tempo real ao digitar
- [ ] Valida que a senha tem mínimo 8 caracteres
- [ ] Exibe mensagens de erro claras abaixo de cada campo com problema
- [ ] Exibe indicador de carregamento durante a autenticação
- [ ] Redireciona para o dashboard ao autenticar com sucesso
- [ ] Exibe mensagem de erro se credenciais forem incorretas
- [ ] Não armazena a senha em nenhum momento no cliente

---

**US-02 — Indicador de força de senha**

> *Como usuário, quero ver a força da minha senha enquanto a digito para saber se ela é segura o suficiente.*

**Critérios de Aceite:**
- [ ] Exibe 4 barras de progresso coloridas abaixo do campo de senha
- [ ] Atualiza em tempo real a cada tecla digitada
- [ ] Classifica em: Fraca (vermelho), Regular (âmbar), Boa (verde), Forte (verde escuro)
- [ ] Exibe o rótulo textual correspondente ao nível
- [ ] Some quando o campo está vazio

---

**US-03 — Persistência de sessão**

> *Como usuário, quero permanecer logado por 8 horas para não precisar autenticar a cada visita.*

**Critérios de Aceite:**
- [ ] Após login, a sessão persiste ao fechar e reabrir o browser na mesma sessão
- [ ] Após 8 horas, o sistema redireciona automaticamente para o login
- [ ] O nome do usuário é exibido no topo do app enquanto logado
- [ ] O botão "Sair" encerra a sessão imediatamente

---

### Épico 2 — Registro de Horas

---

**US-04 — Registrar entrada de trabalho**

> *Como colaborador, quero registrar o horário de início e fim de uma atividade para controlar quanto tempo dediquei a ela.*

**Critérios de Aceite:**
- [ ] Posso selecionar horário de início e fim com seletor de hora nativo
- [ ] A duração é calculada e exibida automaticamente em "Xh YYm"
- [ ] Posso escolher o tipo: Reunião, Atividade ou Pausa
- [ ] Posso adicionar uma descrição textual livre
- [ ] Tipo e Descrição ficam em colunas separadas e visualmente distintas
- [ ] Posso remover qualquer entrada clicando no botão ✕

---

**US-05 — Adicionar múltiplos dias**

> *Como usuário, quero registrar horas de diferentes dias sem perder o histórico anterior.*

**Critérios de Aceite:**
- [ ] O botão "Adicionar dia" cria um novo card com a próxima data disponível
- [ ] Os dias são exibidos em ordem cronológica
- [ ] Cada dia exibe seu total de horas trabalhadas
- [ ] Posso alterar a data de qualquer dia e a lista se reordena automaticamente

---

**US-06 — Remover um dia**

> *Como usuário, quero remover um dia incorreto ou duplicado do meu registro.*

**Critérios de Aceite:**
- [ ] O botão "Remover dia" ativa um modo de seleção com feedback visual
- [ ] No modo de remoção, os cards ficam clicáveis e mostram hover em vermelho
- [ ] Ao clicar em um card, ele é marcado como "selecionado para remoção" com ícone de confirmação
- [ ] Um botão "Confirmar remoção" aparece na barra de hint
- [ ] O botão "Remover dia" fica desabilitado quando há apenas 1 dia

---

### Épico 3 — Calendário

---

**US-07 — Visualizar horas no calendário mensal**

> *Como usuário, quero ver um calendário com indicadores visuais de horas por dia para identificar rapidamente meus dias mais carregados.*

**Critérios de Aceite:**
- [ ] O botão "Calendário" abre/fecha o painel do calendário com animação
- [ ] Cada dia com registro exibe barras coloridas (azul = reunião, verde = atividade, cinza = pausa)
- [ ] O tamanho das barras é proporcional ao maior total do mês
- [ ] O dia atual é destacado com círculo azul no número
- [ ] Dias com registros têm borda sutil para se destacar dos vazios
- [ ] Tooltip exibe o detalhamento ao passar o mouse sobre o dia

---

**US-08 — Navegar entre meses no calendário**

> *Como usuário, quero visualizar meses anteriores e futuros no calendário para verificar meu histórico.*

**Critérios de Aceite:**
- [ ] Botões ‹ e › navegam para o mês anterior e próximo respectivamente
- [ ] O nome do mês e ano são exibidos centralmente
- [ ] A navegação atualiza o grid instantaneamente

---

**US-09 — Criar dia a partir do calendário**

> *Como usuário, quero clicar em um dia no calendário para criar rapidamente uma entrada nessa data.*

**Critérios de Aceite:**
- [ ] Clicar em um dia sem registro cria o card correspondente
- [ ] Clicar em um dia já registrado rola a página até o card existente
- [ ] Após a ação, o dia fica marcado como "selecionado" no calendário

---

### Épico 4 — Relatórios

---

**US-10 — Ver total geral em destaque**

> *Como usuário, quero ver o total de horas trabalhadas de forma proeminente no resumo para ter uma visão rápida do meu desempenho.*

**Critérios de Aceite:**
- [ ] O card "Total geral" ocupa a largura completa da seção de resumo
- [ ] O número de horas é exibido em fonte grande (≥ 34px)
- [ ] O card tem fundo azul info e contrasta visualmente dos demais cards
- [ ] Exibe quantidade de dias registrados no card

---

**US-11 — Acompanhar resumo mensal**

> *Como usuário, quero ver quanto tempo dediquei a reuniões e atividades no mês atual para monitorar minha produtividade mensal.*

**Critérios de Aceite:**
- [ ] O card "Resumo mensal" exibe total, número de dias e nome do mês
- [ ] Exibe sub-breakdown de reuniões e atividades do mês com ícones coloridos
- [ ] Considera apenas os dias do mês e ano atual
- [ ] Atualiza em tempo real conforme novos registros são adicionados

---

**US-12 — Comparar categorias com barras**

> *Como usuário, quero ver graficamente a proporção entre reuniões, atividades e pausas para entender como distribuo meu tempo.*

**Critérios de Aceite:**
- [ ] Exibe três barras horizontais (reuniões, atividades, pausas)
- [ ] A barra mais longa ocupa 100% da largura disponível
- [ ] As outras barras são proporcionais à maior
- [ ] O valor em horas é exibido ao lado de cada barra
- [ ] As barras têm animação suave ao carregar/atualizar

---

## 6. Fluxo de Navegação

```
[Acessar URL]
     │
     ▼
[Verificar sessão]
     │
     ├── Sessão válida ──────────► [Dashboard principal]
     │                                      │
     └── Sem sessão / expirada ──► [Tela de Login]
                                            │
                               ┌────────────┴───────────────┐
                               │                            │
                         [Credenciais OK]           [Credenciais inválidas]
                               │                            │
                        [Salvar sessão]            [Exibir erro inline]
                               │
                        [Dashboard principal]
                               │
              ┌────────────────┼────────────────┐
              │                │                │
        [Registrar]      [Calendário]       [Resumo]
         entradas          mensal             geral
```

---

## 7. Glossário

| Termo | Definição |
|-------|-----------|
| **Entrada** | Um bloco de tempo com início, fim, tipo e descrição |
| **Dia** | Agrupamento de entradas de uma mesma data |
| **Reunião** | Tipo de entrada para encontros, calls e alinhamentos |
| **Atividade** | Tipo de entrada para trabalho produtivo, desenvolvimento, análise |
| **Pausa** | Tipo de entrada para intervalos, almoço, descanso |
| **Resumo mensal** | Agregação de horas dos dias do mês e ano correntes |
| **Total geral** | Soma de todas as horas de todos os dias registrados |
| **Sessão** | Estado de autenticação armazenado em localStorage com TTL de 8h |

---

## 8. Roadmap Futuro

| Prioridade | Funcionalidade |
|-----------|---------------|
| Alta | Persistência de dados em banco (backend API) |
| Alta | Cadastro e recuperação de senha |
| Média | Exportação de relatório em PDF / CSV |
| Média | Múltiplos usuários com workspaces |
| Média | Integração com Google Calendar |
| Baixa | App mobile (PWA) |
| Baixa | Notificações de lembrete de registro |
| Baixa | Metas de horas por categoria |
