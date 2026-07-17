/**
 * Controle de Horas Trabalhadas — app.js
 * v2.0.0
 *
 * Funcionalidades:
 *  - Registro de entradas por dia (reunião / atividade / pausa)
 *  - Cálculo automático de duração por entrada e por dia
 *  - Calendário mensal com barras de horas por dia
 *  - Adicionar / remover dias com seleção interativa
 *  - Resumo geral: total hero + métricas + resumo mensal + barras
 */

'use strict';

// ─────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────

const TODAY    = new Date();
const TODAYSTR = TODAY.toISOString().slice(0, 10);

const MONTHS = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro',
];

const DOWS_SHORT = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

// ─────────────────────────────────────────────────────────────────
// Estado global
// ─────────────────────────────────────────────────────────────────

const state = {
  showCal:    false,
  removeMode: false,
  removingId: null,
  calYear:    TODAY.getFullYear(),
  calMonth:   TODAY.getMonth(),
  days:       [],   // populado por loadFromServer()
  draft:      null, // rascunho de nova entrada: { dayId, start, end, type, desc, durMode, mins, minsRaw }
};

// ─────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────

/** Converte string "1.5", "1,5" ou "1:30" em minutos inteiros. Retorna null se inválido. */
function parseHours(val) {
  if (!val) return null;
  const v = String(val).trim().replace(',', '.');
  if (v.includes(':')) {
    const [h, m] = v.split(':').map(n => parseInt(n, 10) || 0);
    const total = h * 60 + m;
    return total > 0 ? total : null;
  }
  const h = parseFloat(v);
  return !isNaN(h) && h > 0 ? Math.round(h * 60) : null;
}

/** Converte minutos → string "H:MM" para exibir no input de duração. */
function minsToHoursInput(mins) {
  if (!mins || mins <= 0) return '';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

/** Diferença em minutos entre dois horários HH:MM. */
function timeDiff(start, end) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const mins = (eh * 60 + em) - (sh * 60 + sm);
  return mins > 0 ? mins : 0;
}

/** Formata minutos → "Xh YYm". */
function formatMins(m) {
  if (m <= 0) return '0h 00m';
  const h   = Math.floor(m / 60);
  const min = m % 60;
  return h > 0 ? `${h}h ${String(min).padStart(2, '0')}m` : `${min}m`;
}

/** Totais de um dia. Usa duration_mins quando disponível (modo só-duração). */
function getDayTotals(day) {
  let meeting = 0, activity = 0, brk = 0;
  day.entries.forEach(e => {
    const d = e.mins != null ? e.mins : timeDiff(e.start, e.end);
    if      (e.type === 'meeting')  meeting  += d;
    else if (e.type === 'activity') activity += d;
    else                            brk      += d;
  });
  return { meeting, activity, brk, total: meeting + activity + brk };
}

/** Formata "YYYY-MM-DD" → "DD Mmm YYYY". */
function fmtDate(ds) {
  if (!ds) return '—';
  const [y, m, d] = ds.split('-');
  return `${d} ${MONTHS[+m - 1].slice(0, 3)} ${y}`;
}

/** Percentagem segura (0–100). */
function pct(val, max) {
  return max > 0 ? Math.round(val / max * 100) : 0;
}

/** Escapa texto para uso seguro em atributos/conteúdo HTML. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * IDs vêm do Postgres como UUID (string). Comparação sempre por String
 * para funcionar com qualquer tipo de chave.
 */
function findDay(dayId) {
  return state.days.find(d => String(d.id) === String(dayId));
}
function findEntry(day, entryId) {
  return day ? day.entries.find(e => String(e.id) === String(entryId)) : null;
}

// ─────────────────────────────────────────────────────────────────
// Ações: dias
// ─────────────────────────────────────────────────────────────────

async function addDay() {
  const used = new Set(state.days.map(d => d.date));
  let dt = new Date(TODAYSTR + 'T12:00:00');

  for (let i = 0; i < 365; i++) {
    const s = dt.toISOString().slice(0, 10);
    if (!used.has(s)) {
      try {
        const newDay = await API.createDay(s);
        state.days.push(newDay);
        state.days.sort((a, b) => a.date.localeCompare(b.date));
        render();
        setTimeout(() => {
          const idx = state.days.findIndex(d => d.date === s);
          document.querySelectorAll('.day-card')[idx]
            ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 80);
        showSaveStatus('Dia adicionado');
      } catch (err) {
        showSaveStatus('Erro ao adicionar dia', true);
        console.error(err);
      }
      return;
    }
    dt.setDate(dt.getDate() + 1);
  }
}

function toggleRemoveMode() {
  state.removeMode = !state.removeMode;
  state.removingId = null;
  render();
}

function selectForRemoval(dayId) {
  if (!state.removeMode) return;
  state.removingId = String(state.removingId) === String(dayId) ? null : dayId;
  render();
}

async function confirmRemove() {
  if (!state.removingId) return;
  const dayId = state.removingId;
  try {
    await API.deleteDay(dayId);
    state.days = state.days.filter(d => String(d.id) !== String(dayId));
    state.removingId = null;
    if (state.days.length === 0) state.removeMode = false;
    render();
    showSaveStatus('Dia removido');
  } catch (err) {
    showSaveStatus('Erro ao remover dia', true);
    console.error(err);
  }
}

function cancelRemoveMode() {
  state.removeMode = false;
  state.removingId = null;
  render();
}

// ─────────────────────────────────────────────────────────────────
// Ações: entradas (otimista — UI imediata, persistência em background)
// ─────────────────────────────────────────────────────────────────

/**
 * Edição de campo NÃO re-renderiza o DOM — só atualiza os totais em vez
 * de reconstruir os inputs. Reconstruir destruía o input no meio da
 * digitação (o browser comita <input type="time"> a cada segmento) e o
 * usuário perdia o foco antes de terminar de digitar os minutos.
 */
async function updateEntry(dayId, entryId, field, value) {
  const day   = findDay(dayId);
  const entry = findEntry(day, entryId);
  if (!entry) { console.error('[app] updateEntry: entrada não encontrada', dayId, entryId); return; }
  entry[field] = value;
  refreshTotals(dayId);
  try {
    await API.updateEntry(entryId, { [field]: value });
    showSaveStatus('Salvo');
  } catch (err) {
    showSaveStatus('Erro ao salvar', true);
    console.error(err);
  }
}

/** Campo de duração: valida o formato antes de salvar; inválido → mantém valor anterior. */
async function updateEntryMins(dayId, entryId, rawValue) {
  const mins = parseHours(rawValue);
  const day   = findDay(dayId);
  const entry = findEntry(day, entryId);
  if (!entry) return;
  const input = document.querySelector(`.entry-row[data-entry-id="${entryId}"] .hrs-field`);
  if (mins == null) {
    showSaveStatus('Formato inválido — use H:MM ou decimal (ex: 1:30 ou 1.5)', true);
    if (input) input.value = minsToHoursInput(entry.mins);
    return;
  }
  if (input) input.value = minsToHoursInput(mins);
  await updateEntry(dayId, entryId, 'mins', mins);
}

async function removeEntry(dayId, entryId) {
  const day = findDay(dayId);
  if (!day) return;
  day.entries = day.entries.filter(e => String(e.id) !== String(entryId));
  render();
  try {
    await API.deleteEntry(entryId);
    showSaveStatus('Removido');
  } catch (err) {
    showSaveStatus('Erro ao remover', true);
    console.error(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// Rascunho de nova entrada (Adicionar Horário → Salvar / Cancelar)
//
// Nada é persistido até o usuário clicar em Salvar. Cancelar descarta
// o rascunho sem tocar no banco nem nas entradas existentes.
// ─────────────────────────────────────────────────────────────────

function openDraft(dayId) {
  const day = findDay(dayId);
  if (!day) return;
  const last = day.entries[day.entries.length - 1];
  state.draft = {
    dayId:   String(day.id),
    start:   (last && last.mins == null && last.end) ? last.end : '',
    end:     '',
    type:    'activity',
    desc:    '',
    durMode: false,
    mins:    null,
    minsRaw: '',
  };
  render();
  setTimeout(() => document.getElementById('draft-start')?.focus(), 30);
}

function updateDraft(field, value) {
  if (!state.draft) return;
  state.draft[field] = value;
  hideDraftError();
  refreshDraftTotal();
}

function updateDraftMins(value) {
  if (!state.draft) return;
  state.draft.minsRaw = value;
  state.draft.mins = parseHours(value);
  hideDraftError();
  refreshDraftTotal();
}

function refreshDraftTotal() {
  const el = document.getElementById('draft-total');
  if (!el || !state.draft) return;
  const d = state.draft;
  const mins = d.durMode ? (d.mins || 0) : timeDiff(d.start, d.end);
  el.textContent = mins > 0 ? formatMins(mins) : '—';
}

function draftToggleMode() {
  const d = state.draft;
  if (!d) return;
  d.durMode = !d.durMode;
  if (d.durMode && d.mins == null) {
    const calc = timeDiff(d.start, d.end);
    if (calc > 0) { d.mins = calc; d.minsRaw = minsToHoursInput(calc); }
  }
  render();
  setTimeout(() => document.getElementById('draft-start')?.focus(), 30);
}

/** Enter salva, Escape cancela — navegação por teclado no rascunho. */
function draftKeys(ev) {
  if (ev.key === 'Enter')  { ev.preventDefault(); saveDraft(); }
  if (ev.key === 'Escape') { cancelDraft(); }
}

function validateDraft(day, d) {
  if (d.durMode) {
    if (d.mins == null || d.mins <= 0)
      return 'Informe a duração no formato H:MM ou decimal (ex: 1:30 ou 1.5).';
    return null;
  }
  if (!d.start && !d.end) return 'Informe o horário inicial e final.';
  if (!d.start) return 'Informe o horário inicial.';
  if (!d.end)   return 'Informe o horário final.';
  if (d.start >= d.end) return 'O horário inicial deve ser menor que o horário final.';
  for (const e of day.entries) {
    if (e.mins != null || !e.start || !e.end) continue;
    if (e.start === d.start && e.end === d.end)
      return `Horário duplicado: já existe uma entrada ${e.start}–${e.end}.`;
    if (d.start < e.end && d.end > e.start)
      return `Conflito de horário com a entrada ${e.start}–${e.end}.`;
  }
  return null;
}

async function saveDraft() {
  const d = state.draft;
  if (!d) return;
  const day = findDay(d.dayId);
  if (!day) return;

  const err = validateDraft(day, d);
  if (err) { showDraftError(err); return; }

  const entry = {
    start: d.durMode ? '' : d.start,
    end:   d.durMode ? '' : d.end,
    type:  d.type,
    desc:  d.desc.trim(),
    mins:  d.durMode ? d.mins : null,
  };

  const btn = document.getElementById('draft-save');
  if (btn) { btn.disabled = true; btn.textContent = 'Salvando…'; }

  try {
    const id = await API.createEntry(day.id, entry, day.entries.length);
    day.entries.push({ id, ...entry });
    state.draft = null;
    render();
    showSaveStatus('Entrada adicionada');
  } catch (e2) {
    console.error(e2);
    if (btn) { btn.disabled = false; btn.textContent = '✓ Salvar'; }
    showDraftError('Não foi possível salvar. Verifique sua conexão e tente novamente.');
    showSaveStatus('Erro ao adicionar', true);
  }
}

function cancelDraft() {
  state.draft = null;
  render();
}

function showDraftError(msg) {
  const el = document.getElementById('draft-error');
  if (el) { el.textContent = '⚠ ' + msg; el.style.display = 'block'; }
}

function hideDraftError() {
  const el = document.getElementById('draft-error');
  if (el) { el.textContent = ''; el.style.display = 'none'; }
}

async function toggleEntryMode(dayId, entryId) {
  const day   = findDay(dayId);
  const entry = findEntry(day, entryId);
  if (!entry) { console.error('[app] toggleEntryMode: entrada não encontrada', dayId, entryId); return; }

  if (entry.mins != null) {
    // Voltar para modo horário
    entry.mins = null;
  } else {
    // Mudar para modo só-duração: aproveita o intervalo já preenchido
    const calc = timeDiff(entry.start, entry.end);
    entry.mins = calc > 0 ? calc : 60;
  }

  render();
  try {
    await API.updateEntry(entryId, { mins: entry.mins, start: entry.start, end: entry.end });
    showSaveStatus('Salvo');
  } catch (err) {
    showSaveStatus('Erro ao salvar', true);
    console.error(err);
  }
}

async function updateDay(dayId, field, value) {
  const day = findDay(dayId);
  if (!day) { console.error('[app] updateDay: dia não encontrado', dayId); return; }
  day[field] = value;
  state.days.sort((a, b) => a.date.localeCompare(b.date));
  render();
  try {
    await API.updateDay(dayId, { [field]: value });
    showSaveStatus('Salvo');
  } catch (err) {
    showSaveStatus('Erro ao salvar', true);
    console.error(err);
  }
}

// ─────────────────────────────────────────────────────────────────
// Ações: calendário
// ─────────────────────────────────────────────────────────────────

function toggleCal() {
  state.showCal = !state.showCal;
  renderCal();
}

function shiftMonth(dir) {
  state.calMonth += dir;
  if (state.calMonth > 11) { state.calMonth = 0;  state.calYear++; }
  if (state.calMonth < 0)  { state.calMonth = 11; state.calYear--; }
  renderCal();
}

async function calDayClick(ds) {
  if (!state.days.find(d => d.date === ds)) {
    try {
      const newDay = await API.createDay(ds);
      state.days.push(newDay);
      state.days.sort((a, b) => a.date.localeCompare(b.date));
      showSaveStatus('Dia adicionado');
    } catch (err) {
      showSaveStatus('Erro ao adicionar', true);
      console.error(err);
      return;
    }
  }
  renderCal();
  renderBody();
  setTimeout(() => {
    const idx = state.days.findIndex(d => d.date === ds);
    document.querySelectorAll('.day-card')[idx]
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 60);
}

// ─────────────────────────────────────────────────────────────────
// Render: hint bar
// ─────────────────────────────────────────────────────────────────

function renderHint() {
  const wrap  = document.getElementById('hint-wrap');
  const btnRm = document.getElementById('btn-rem');

  if (btnRm) {
    btnRm.disabled = state.days.length <= 1 && !state.removeMode;
    btnRm.classList.toggle('active', state.removeMode);
  }

  if (!state.removeMode) { wrap.innerHTML = ''; return; }

  const selDay = state.removingId
    ? state.days.find(d => d.id === state.removingId)
    : null;

  const msg = selDay
    ? `<strong>${fmtDate(selDay.date)}</strong> selecionado —`
    : 'Clique no card do dia que deseja remover.';

  wrap.innerHTML = `
    <div class="hint-bar">
      <span>${msg}</span>
      ${state.removingId
        ? `<button class="btn-confirm-rm" onclick="confirmRemove()">🗑 Confirmar remoção</button>`
        : ''}
      <button class="btn-cancel-rm" onclick="cancelRemoveMode()">Cancelar</button>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// Render: calendário
// ─────────────────────────────────────────────────────────────────

function renderCal() {
  const wrap   = document.getElementById('cal-wrap');
  const btnCal = document.getElementById('btn-cal');
  if (btnCal) btnCal.classList.toggle('active', state.showCal);
  if (!state.showCal) { wrap.innerHTML = ''; return; }

  const { calYear: year, calMonth: month } = state;
  const first     = new Date(year, month, 1);
  const last      = new Date(year, month + 1, 0);
  const startDow  = first.getDay();
  const totalDays = last.getDate();

  // mapa data → totais
  const dataMap = {};
  state.days.forEach(d => {
    const t = getDayTotals(d);
    dataMap[d.date] = t;
  });
  const maxTotal = Math.max(1, ...Object.values(dataMap).map(v => v.total));

  let cells = '';

  // dias do mês anterior
  for (let i = 0; i < startDow; i++) {
    const d = new Date(year, month, -(startDow - 1 - i));
    cells += `<div class="cal-day other-month"><div class="cal-day-num">${d.getDate()}</div></div>`;
  }

  // dias do mês atual
  for (let d = 1; d <= totalDays; d++) {
    const ds  = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const inf = dataMap[ds];
    const cls = [
      'cal-day',
      ds === TODAYSTR && 'today',
      inf?.total > 0  && 'has-data',
      state.days.some(dy => dy.date === ds) && 'selected',
    ].filter(Boolean).join(' ');

    let bars = '';
    if (inf?.total > 0) {
      if (inf.meeting)  bars += `<div class="cal-bar" style="width:${pct(inf.meeting,  maxTotal)}%;background:#3B82F6"></div>`;
      if (inf.activity) bars += `<div class="cal-bar" style="width:${pct(inf.activity, maxTotal)}%;background:#2563EB"></div>`;
      if (inf.brk)      bars += `<div class="cal-bar" style="width:${pct(inf.brk,      maxTotal)}%;background:var(--bd-mid)"></div>`;
    }

    const tip = inf ? `title="${formatMins(inf.meeting)} reunião · ${formatMins(inf.activity)} atividade · ${formatMins(inf.total)} total"` : '';
    cells += `
      <div class="${cls}" onclick="calDayClick('${ds}')" ${tip}>
        <div class="cal-day-num">${d}</div>
        <div class="cal-bars">${bars}</div>
      </div>`;
  }

  // dias do mês seguinte
  const trailing = (7 - ((startDow + totalDays) % 7)) % 7;
  for (let i = 1; i <= trailing; i++) {
    cells += `<div class="cal-day other-month"><div class="cal-day-num">${i}</div></div>`;
  }

  wrap.innerHTML = `
    <div class="cal-panel">
      <div class="cal-nav">
        <button class="cal-nav-btn" onclick="shiftMonth(-1)" aria-label="Mês anterior">&#8249;</button>
        <span class="cal-month-label">${MONTHS[month]} ${year}</span>
        <button class="cal-nav-btn" onclick="shiftMonth(1)"  aria-label="Próximo mês">&#8250;</button>
      </div>
      <div class="cal-grid">
        ${DOWS_SHORT.map(d => `<div class="cal-dow">${d}</div>`).join('')}
        ${cells}
      </div>
      <div class="cal-legend">
        <div class="cal-leg-item"><div class="cal-leg-dot" style="background:#3B82F6"></div>Reunião</div>
        <div class="cal-leg-item"><div class="cal-leg-dot" style="background:#2563EB"></div>Atividade</div>
        <div class="cal-leg-item"><div class="cal-leg-dot" style="background:var(--bd-mid)"></div>Pausa</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// Render: corpo principal (day cards + summary)
// ─────────────────────────────────────────────────────────────────

/** Pills de totais de um dia. */
function pillsHTML(t) {
  return `
    <span class="pill pill-meeting">Reuniões: ${formatMins(t.meeting)}</span>
    <span class="pill pill-activity">Atividades: ${formatMins(t.activity)}</span>
    ${t.brk > 0 ? `<span class="pill pill-break">Pausas: ${formatMins(t.brk)}</span>` : ''}
    <span class="pill pill-total">Total: ${formatMins(t.total)}</span>`;
}

/** Formulário de rascunho de nova entrada (Adicionar Horário). */
function draftHTML() {
  const d = state.draft;
  const modeIcon = d.durMode
    ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`
    : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2h14"/><path d="M5 22h14"/><path d="M5 2c0 9 14 9 14 0"/><path d="M5 22c0-9 14-9 14 0"/></svg>`;
  const modeTitle = d.durMode ? 'Usar horário de início e fim' : 'Registrar só a duração';

  const timeArea = d.durMode
    ? `<input type="text" class="hrs-field" id="draft-start" value="${esc(d.minsRaw)}"
          placeholder="ex: 1:30 ou 1.5" title="Horas no formato H:MM ou decimal"
          onclick="event.stopPropagation()"
          oninput="updateDraftMins(this.value)" onkeydown="draftKeys(event)">`
    : `<input type="time" class="time-field" id="draft-start" value="${d.start}"
          aria-label="Horário inicial"
          onclick="event.stopPropagation()"
          oninput="updateDraft('start',this.value)" onkeydown="draftKeys(event)">
        <span class="time-sep" aria-hidden="true">→</span>
        <input type="time" class="time-field" id="draft-end" value="${d.end}"
          aria-label="Horário final"
          onclick="event.stopPropagation()"
          oninput="updateDraft('end',this.value)" onkeydown="draftKeys(event)">`;

  const mins = d.durMode ? (d.mins || 0) : timeDiff(d.start, d.end);

  return `
    <div class="entry-row draft-row" onclick="event.stopPropagation()">
      <button class="btn-mode" title="${modeTitle}" aria-label="${modeTitle}"
        onclick="draftToggleMode()">${modeIcon}</button>
      <div class="entry-time-area">${timeArea}</div>
      <select aria-label="Tipo" onchange="updateDraft('type',this.value)">
        <option value="meeting"  ${d.type === 'meeting'  ? 'selected' : ''}>Reunião</option>
        <option value="activity" ${d.type === 'activity' ? 'selected' : ''}>Atividade</option>
        <option value="break"    ${d.type === 'break'    ? 'selected' : ''}>Pausa</option>
      </select>
      <input type="text" value="${esc(d.desc)}" placeholder="Descrição…"
        oninput="updateDraft('desc',this.value)" onkeydown="draftKeys(event)">
      <div class="duration-cell" id="draft-total">${mins > 0 ? formatMins(mins) : '—'}</div>
      <span></span>
    </div>
    <div class="draft-error" id="draft-error" role="alert" style="display:none"></div>
    <div class="draft-actions" onclick="event.stopPropagation()">
      <button class="btn-save-draft" id="draft-save" onclick="saveDraft()">✓ Salvar</button>
      <button class="btn-cancel-draft" onclick="cancelDraft()">Cancelar</button>
    </div>`;
}

/**
 * Atualiza apenas os totais (badge do dia, célula da entrada, pills,
 * resumo e calendário) sem reconstruir os inputs — preserva o foco
 * durante a digitação.
 */
function refreshTotals(dayId) {
  const day = findDay(dayId);
  if (day) {
    const card = document.querySelector(`.day-card[data-day-id="${day.id}"]`);
    if (card) {
      const t = getDayTotals(day);
      const badge = card.querySelector('.total-badge');
      if (badge) badge.textContent = `${formatMins(t.total)} trabalhados`;
      const pills = card.querySelector('.pills');
      if (pills) pills.innerHTML = pillsHTML(t);
      day.entries.forEach(e => {
        const cell = card.querySelector(`.entry-row[data-entry-id="${e.id}"] .duration-cell`);
        if (cell) cell.textContent = formatMins(e.mins != null ? e.mins : timeDiff(e.start, e.end));
      });
    }
  }
  renderSummary();
  if (state.showCal) renderCal();
}

/** Reconstrói somente o bloco de resumo geral. */
function renderSummary() {
  const wrap = document.getElementById('summary-wrap');
  if (wrap) wrap.innerHTML = summaryHTML();
}

function summaryHTML() {
  // ── Totais globais ──────────────────────────────────────────────
  let gMeeting = 0, gActivity = 0, gBreak = 0;
  state.days.forEach(d => {
    const t = getDayTotals(d);
    gMeeting  += t.meeting;
    gActivity += t.activity;
    gBreak    += t.brk;
  });
  const gTotal = gMeeting + gActivity + gBreak;
  const maxBar = Math.max(gMeeting, gActivity, gBreak, 1);
  const timePct = v => (gTotal > 0 ? Math.round(v / gTotal * 100) : 0);

  // ── Resumo do mês atual ─────────────────────────────────────────
  const curPrefix = `${TODAY.getFullYear()}-${String(TODAY.getMonth() + 1).padStart(2, '0')}`;
  const mDays     = state.days.filter(d => d.date.startsWith(curPrefix));
  let mMeeting = 0, mActivity = 0, mTotal = 0;
  mDays.forEach(d => {
    const t = getDayTotals(d);
    mMeeting  += t.meeting;
    mActivity += t.activity;
    mTotal    += t.total;
  });
  const monthName = MONTHS[TODAY.getMonth()];

  return `
    <div class="summary">
      <div class="summary-heading">Resumo geral</div>

      <div class="total-hero">
        <div class="hero-left">
          <span class="hero-label">Total geral</span>
          <span class="hero-value">${formatMins(gTotal)}</span>
        </div>
        <div class="hero-right">
          <div class="hero-days">
            ${state.days.length} dia${state.days.length !== 1 ? 's' : ''} registrado${state.days.length !== 1 ? 's' : ''}
          </div>
          <div class="hero-icon">&#9200;</div>
        </div>
      </div>

      <div class="metrics">

        <div class="metric-card">
          <div class="metric-label">Reuniões</div>
          <div class="metric-value" style="color:#3B82F6">${formatMins(gMeeting)}</div>
          <div class="metric-sub">${timePct(gMeeting)}% do tempo</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Atividades</div>
          <div class="metric-value" style="color:#2563EB">${formatMins(gActivity)}</div>
          <div class="metric-sub">${timePct(gActivity)}% do tempo</div>
        </div>

        <div class="metric-card month-card">
          <div class="metric-label">Resumo mensal</div>
          <div class="metric-value">${formatMins(mTotal)}</div>
          <div class="metric-sub">${mDays.length} dia${mDays.length !== 1 ? 's' : ''} em ${monthName}</div>
          <div class="month-items">
            <div class="month-row">
              <div style="display:flex;align-items:center;gap:5px">
                <div class="month-dot" style="background:#3B82F6"></div>
                <span style="color:var(--tx-secondary)">Reuniões</span>
              </div>
              <span style="font-weight:500">${formatMins(mMeeting)}</span>
            </div>
            <div class="month-row">
              <div style="display:flex;align-items:center;gap:5px">
                <div class="month-dot" style="background:#2563EB"></div>
                <span style="color:var(--tx-secondary)">Atividades</span>
              </div>
              <span style="font-weight:500">${formatMins(mActivity)}</span>
            </div>
          </div>
        </div>

      </div>

      <div class="bar-row">
        <span class="bar-label">Reuniões</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(gMeeting,maxBar)}%;background:#3B82F6"></div></div>
        <span class="bar-val">${formatMins(gMeeting)}</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">Atividades</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(gActivity,maxBar)}%;background:#2563EB"></div></div>
        <span class="bar-val">${formatMins(gActivity)}</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">Pausas</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(gBreak,maxBar)}%;background:#71717A"></div></div>
        <span class="bar-val">${formatMins(gBreak)}</span>
      </div>

    </div>`;
}

function renderBody() {
  let html = '';

  state.days.forEach(day => {
    const t          = getDayTotals(day);
    const isRemoving = String(state.removingId) === String(day.id);
    const cardCls    = state.removeMode
      ? (isRemoving ? 'day-card removing' : 'day-card remove-mode')
      : 'day-card';

    html += `
      <div class="${cardCls}" data-day-id="${day.id}"
           onclick="${state.removeMode ? `selectForRemoval('${day.id}')` : 'void(0)'}">

        <div class="day-header">
          <div class="day-header-left">
            ${isRemoving ? `<span aria-hidden="true" style="font-size:15px;color:var(--tx-danger)">&#10004;</span>` : ''}
            <input type="date" value="${day.date}"
              style="width:auto"
              onclick="event.stopPropagation()"
              onchange="updateDay('${day.id}','date',this.value)">
            <span class="total-badge">${formatMins(t.total)} trabalhados</span>
            ${isRemoving ? `<span class="removing-badge">&#128465; para remoção</span>` : ''}
          </div>
        </div>

        <div class="entry-header-row">
          <span></span>
          <span>Horário / Duração</span>
          <span>Tipo</span>
          <span>Descrição</span>
          <span style="text-align:right;padding-right:4px">Total</span>
          <span></span>
        </div>
        <div class="sep"></div>

        <div class="entries-list">`;

    day.entries.forEach(entry => {
      const isDur = entry.mins != null;
      const dur   = isDur ? entry.mins : timeDiff(entry.start, entry.end);

      // Ícone do botão de modo: mostra o modo ALTERNATIVO (o que você vai ganhar ao clicar)
      const modeIcon = isDur
        ? `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>`
        : `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 2h14"/><path d="M5 22h14"/><path d="M5 2c0 9 14 9 14 0"/><path d="M5 22c0-9 14-9 14 0"/></svg>`;
      const modeTitle = isDur ? 'Usar horário de início e fim' : 'Registrar só a duração';

      // Área de tempo: dois inputs de hora OU um input de duração
      const timeArea = isDur
        ? `<input type="text" class="hrs-field" value="${minsToHoursInput(entry.mins)}"
              placeholder="ex: 1:30 ou 1.5"
              title="Horas no formato H:MM ou decimal (ex: 1.5)"
              onclick="event.stopPropagation()"
              onchange="updateEntryMins('${day.id}','${entry.id}',this.value)">`
        : `<input type="time" class="time-field" value="${entry.start}"
              onclick="event.stopPropagation()"
              onchange="updateEntry('${day.id}','${entry.id}','start',this.value)">
            <span class="time-sep" aria-hidden="true">→</span>
            <input type="time" class="time-field" value="${entry.end}"
              onclick="event.stopPropagation()"
              onchange="updateEntry('${day.id}','${entry.id}','end',this.value)">`;

      html += `
          <div class="entry-row" data-entry-id="${entry.id}">
            <button class="btn-mode" title="${modeTitle}"
              onclick="event.stopPropagation();toggleEntryMode('${day.id}','${entry.id}')"
              aria-label="${modeTitle}">${modeIcon}</button>
            <div class="entry-time-area">${timeArea}</div>
            <select onclick="event.stopPropagation()"
              onchange="updateEntry('${day.id}','${entry.id}','type',this.value)">
              <option value="meeting"  ${entry.type === 'meeting'  ? 'selected' : ''}>Reunião</option>
              <option value="activity" ${entry.type === 'activity' ? 'selected' : ''}>Atividade</option>
              <option value="break"    ${entry.type === 'break'    ? 'selected' : ''}>Pausa</option>
            </select>
            <input type="text" value="${esc(entry.desc)}" placeholder="Descrição…"
              onclick="event.stopPropagation()"
              onchange="updateEntry('${day.id}','${entry.id}','desc',this.value)">
            <div class="duration-cell">${formatMins(dur)}</div>
            <button class="btn-remove-entry" title="Remover entrada"
              onclick="event.stopPropagation();removeEntry('${day.id}','${entry.id}')">&#x2715;</button>
          </div>`;
    });

    const hasDraft = state.draft && String(state.draft.dayId) === String(day.id);

    html += `
        </div>

        ${hasDraft ? draftHTML() : `
        <button class="btn-add-entry"
          onclick="event.stopPropagation();openDraft('${day.id}')">
          + Adicionar horário
        </button>`}

        <div class="sep" style="margin-top:12px"></div>
        <div class="pills">${pillsHTML(t)}</div>
      </div>`;
  });

  // ── Resumo geral (reconstruível isoladamente via renderSummary) ──
  html += `<div id="summary-wrap">${summaryHTML()}</div>`;

  document.getElementById('app-body').innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────
// Render principal
// ─────────────────────────────────────────────────────────────────

function render() {
  renderHint();
  renderCal();
  renderBody();
}

// ─────────────────────────────────────────────────────────────────
// Persistência (Supabase)
//
// Mutações usam UPDATE otimista: o estado local muda imediatamente
// e a chamada à API roda em paralelo. O indicador "✓ Salvo" /
// "⚠ Erro" aparece na topbar conforme o resultado.
// ─────────────────────────────────────────────────────────────────

function showSaveStatus(text, isError = false) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.textContent = isError ? '⚠ ' + text : '✓ ' + text;
  el.style.color = isError ? 'var(--tx-danger)' : 'var(--cyan-lt)';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 1800);
}

async function loadFromServer() {
  try {
    const days = await API.loadDays();
    state.days = days;
    render();
  } catch (err) {
    console.error('[load]', err);
    showSaveStatus('Erro ao carregar dados', true);
    render();
  }
}

// ─────────────────────────────────────────────────────────────────
// Autenticação + Init
// ─────────────────────────────────────────────────────────────────

(async function bootstrap() {
  // Recupera o SDK dinamicamente se não carregou no primeiro paint
  try { await window.ensureAPI(); }
  catch { window.location.replace('/'); return; }

  // Guard: redireciona ao login se não autenticado
  if (!(await API.isLoggedIn())) {
    window.location.replace('/');
    return;
  }

  // Cabeçalho com nome do usuário
  const user = await API.getUser();
  const el = document.getElementById('topbar-user');
  if (el && user) {
    const initials = String(user.name || user.email || '?').split(' ')
      .map(w => w[0]).join('').slice(0, 2).toUpperCase();
    el.innerHTML = `
      <div class="user-avatar" aria-hidden="true">${initials}</div>
      <span>${user.name || user.email}</span>`;
  }

  // Carrega dados do banco
  await loadFromServer();
})();

async function logout() {
  await API.logout();
  window.location.replace('/');
}
