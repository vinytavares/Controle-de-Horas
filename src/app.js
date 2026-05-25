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
  days: [
    {
      id: 1,
      date: TODAYSTR,
      entries: [
        { id: 1, start: '09:00', end: '10:30', type: 'meeting',  desc: 'Daily + planejamento' },
        { id: 2, start: '10:30', end: '12:00', type: 'activity', desc: 'Desenvolvimento de feature' },
        { id: 3, start: '13:00', end: '17:00', type: 'activity', desc: 'Revisão de código' },
      ],
    },
  ],
  nextDayId:   2,
  nextEntryId: 10,
};

// ─────────────────────────────────────────────────────────────────
// Utilitários
// ─────────────────────────────────────────────────────────────────

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

/** Totais de um dia. */
function getDayTotals(day) {
  let meeting = 0, activity = 0, brk = 0;
  day.entries.forEach(e => {
    const d = timeDiff(e.start, e.end);
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

// ─────────────────────────────────────────────────────────────────
// Ações: dias
// ─────────────────────────────────────────────────────────────────

function addDay() {
  const used = new Set(state.days.map(d => d.date));
  let dt = new Date(TODAYSTR + 'T12:00:00');

  for (let i = 0; i < 365; i++) {
    const s = dt.toISOString().slice(0, 10);
    if (!used.has(s)) {
      state.days.push({ id: state.nextDayId++, date: s, entries: [] });
      state.days.sort((a, b) => a.date.localeCompare(b.date));
      render();
      setTimeout(() => {
        const idx = state.days.findIndex(d => d.date === s);
        document.querySelectorAll('.day-card')[idx]
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 80);
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
  state.removingId = state.removingId === dayId ? null : dayId;
  render();
}

function confirmRemove() {
  if (!state.removingId) return;
  state.days = state.days.filter(d => d.id !== state.removingId);
  state.removingId = null;
  if (state.days.length === 0) state.removeMode = false;
  render();
}

function cancelRemoveMode() {
  state.removeMode = false;
  state.removingId = null;
  render();
}

// ─────────────────────────────────────────────────────────────────
// Ações: entradas
// ─────────────────────────────────────────────────────────────────

function updateEntry(dayId, entryId, field, value) {
  const day   = state.days.find(d => d.id === dayId);
  const entry = day.entries.find(e => e.id === entryId);
  entry[field] = value;
  render();
}

function removeEntry(dayId, entryId) {
  const day = state.days.find(d => d.id === dayId);
  day.entries = day.entries.filter(e => e.id !== entryId);
  render();
}

function addEntry(dayId) {
  const day  = state.days.find(d => d.id === dayId);
  const last = day.entries[day.entries.length - 1];
  day.entries.push({
    id:    state.nextEntryId++,
    start: last?.end || '09:00',
    end:   '',
    type:  'activity',
    desc:  '',
  });
  render();
}

function updateDay(dayId, field, value) {
  const day = state.days.find(d => d.id === dayId);
  day[field] = value;
  state.days.sort((a, b) => a.date.localeCompare(b.date));
  render();
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

function calDayClick(ds) {
  if (!state.days.find(d => d.date === ds)) {
    state.days.push({ id: state.nextDayId++, date: ds, entries: [] });
    state.days.sort((a, b) => a.date.localeCompare(b.date));
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
      if (inf.meeting)  bars += `<div class="cal-bar" style="width:${pct(inf.meeting,  maxTotal)}%;background:#0E9594"></div>`;
      if (inf.activity) bars += `<div class="cal-bar" style="width:${pct(inf.activity, maxTotal)}%;background:#11686A"></div>`;
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
        <div class="cal-leg-item"><div class="cal-leg-dot" style="background:#0E9594"></div>Reunião</div>
        <div class="cal-leg-item"><div class="cal-leg-dot" style="background:#11686A"></div>Atividade</div>
        <div class="cal-leg-item"><div class="cal-leg-dot" style="background:var(--bd-mid)"></div>Pausa</div>
      </div>
    </div>`;
}

// ─────────────────────────────────────────────────────────────────
// Render: corpo principal (day cards + summary)
// ─────────────────────────────────────────────────────────────────

function renderBody() {
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

  // ── Day cards ───────────────────────────────────────────────────
  let html = '';

  state.days.forEach(day => {
    const t          = getDayTotals(day);
    const isRemoving = state.removingId === day.id;
    const cardCls    = state.removeMode
      ? (isRemoving ? 'day-card removing' : 'day-card remove-mode')
      : 'day-card';

    html += `
      <div class="${cardCls}"
           onclick="${state.removeMode ? `selectForRemoval(${day.id})` : 'void(0)'}">

        <div class="day-header">
          <div class="day-header-left">
            ${isRemoving ? `<span aria-hidden="true" style="font-size:15px;color:var(--tx-danger)">&#10004;</span>` : ''}
            <input type="date" value="${day.date}"
              style="width:auto"
              onclick="event.stopPropagation()"
              onchange="updateDay(${day.id},'date',this.value)">
            <span class="total-badge">${formatMins(t.total)} trabalhados</span>
            ${isRemoving ? `<span class="removing-badge">&#128465; para remoção</span>` : ''}
          </div>
        </div>

        <div class="entry-header-row">
          <span>Início</span>
          <span>Fim</span>
          <span>Tipo</span>
          <span>Descrição</span>
          <span style="text-align:right;padding-right:4px">Duração</span>
          <span></span>
        </div>
        <div class="sep"></div>

        <div class="entries-list">`;

    day.entries.forEach(entry => {
      const dur = timeDiff(entry.start, entry.end);
      html += `
          <div class="entry-row">
            <input type="time" value="${entry.start}"
              onclick="event.stopPropagation()"
              onchange="updateEntry(${day.id},${entry.id},'start',this.value)">
            <input type="time" value="${entry.end}"
              onclick="event.stopPropagation()"
              onchange="updateEntry(${day.id},${entry.id},'end',this.value)">
            <select onclick="event.stopPropagation()"
              onchange="updateEntry(${day.id},${entry.id},'type',this.value)">
              <option value="meeting"  ${entry.type === 'meeting'  ? 'selected' : ''}>Reunião</option>
              <option value="activity" ${entry.type === 'activity' ? 'selected' : ''}>Atividade</option>
              <option value="break"    ${entry.type === 'break'    ? 'selected' : ''}>Pausa</option>
            </select>
            <input type="text" value="${entry.desc}" placeholder="Descrição…"
              onclick="event.stopPropagation()"
              onchange="updateEntry(${day.id},${entry.id},'desc',this.value)">
            <div class="duration-cell">${formatMins(dur)}</div>
            <button class="btn-remove-entry" title="Remover entrada"
              onclick="event.stopPropagation();removeEntry(${day.id},${entry.id})">&#x2715;</button>
          </div>`;
    });

    html += `
        </div>

        <button class="btn-add-entry"
          onclick="event.stopPropagation();addEntry(${day.id})">
          + adicionar entrada
        </button>

        <div class="sep" style="margin-top:12px"></div>
        <div class="pills">
          <span class="pill pill-meeting">Reuniões: ${formatMins(t.meeting)}</span>
          <span class="pill pill-activity">Atividades: ${formatMins(t.activity)}</span>
          ${t.brk > 0 ? `<span class="pill pill-break">Pausas: ${formatMins(t.brk)}</span>` : ''}
          <span class="pill pill-total">Total: ${formatMins(t.total)}</span>
        </div>
      </div>`;
  });

  // ── Resumo geral ────────────────────────────────────────────────
  html += `
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
          <div class="metric-value" style="color:#0E9594">${formatMins(gMeeting)}</div>
          <div class="metric-sub">${timePct(gMeeting)}% do tempo</div>
        </div>

        <div class="metric-card">
          <div class="metric-label">Atividades</div>
          <div class="metric-value" style="color:#11686A">${formatMins(gActivity)}</div>
          <div class="metric-sub">${timePct(gActivity)}% do tempo</div>
        </div>

        <div class="metric-card month-card">
          <div class="metric-label">Resumo mensal</div>
          <div class="metric-value">${formatMins(mTotal)}</div>
          <div class="metric-sub">${mDays.length} dia${mDays.length !== 1 ? 's' : ''} em ${monthName}</div>
          <div class="month-items">
            <div class="month-row">
              <div style="display:flex;align-items:center;gap:5px">
                <div class="month-dot" style="background:#0E9594"></div>
                <span style="color:var(--tx-secondary)">Reuniões</span>
              </div>
              <span style="font-weight:500">${formatMins(mMeeting)}</span>
            </div>
            <div class="month-row">
              <div style="display:flex;align-items:center;gap:5px">
                <div class="month-dot" style="background:#11686A"></div>
                <span style="color:var(--tx-secondary)">Atividades</span>
              </div>
              <span style="font-weight:500">${formatMins(mActivity)}</span>
            </div>
          </div>
        </div>

      </div>

      <div class="bar-row">
        <span class="bar-label">Reuniões</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(gMeeting,maxBar)}%;background:#0E9594"></div></div>
        <span class="bar-val">${formatMins(gMeeting)}</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">Atividades</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(gActivity,maxBar)}%;background:#11686A"></div></div>
        <span class="bar-val">${formatMins(gActivity)}</span>
      </div>
      <div class="bar-row">
        <span class="bar-label">Pausas</span>
        <div class="bar-track"><div class="bar-fill" style="width:${pct(gBreak,maxBar)}%;background:#8A6F5C"></div></div>
        <span class="bar-val">${formatMins(gBreak)}</span>
      </div>

    </div>`;

  document.getElementById('app-body').innerHTML = html;
}

// ─────────────────────────────────────────────────────────────────
// Render principal
// ─────────────────────────────────────────────────────────────────

function render() {
  renderHint();
  renderCal();
  renderBody();
  scheduleSave();   // persiste no MongoDB após cada alteração
}

// ─────────────────────────────────────────────────────────────────
// Persistência no MongoDB (auto-save com debounce)
// ─────────────────────────────────────────────────────────────────

let saveTimer = null;
let suppressSave = true;   // não salva durante o carregamento inicial

function scheduleSave() {
  if (suppressSave) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(async () => {
    try {
      await API.saveEntries(state.days, state.nextDayId, state.nextEntryId);
      showSaveStatus('Salvo');
    } catch (err) {
      console.error('[save]', err);
      showSaveStatus('Erro ao salvar', true);
    }
  }, 800);
}

function showSaveStatus(text, isError = false) {
  const el = document.getElementById('save-status');
  if (!el) return;
  el.textContent = isError ? '⚠ ' + text : '✓ ' + text;
  el.style.color = isError ? 'var(--tx-danger)' : 'var(--cyan-lt)';
  el.style.opacity = '1';
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.style.opacity = '0'; }, 2000);
}

async function loadFromServer() {
  try {
    const data = await API.loadEntries();
    if (data.days && data.days.length) {
      state.days        = data.days;
      state.nextDayId   = data.nextDayId   || state.days.length + 1;
      state.nextEntryId = data.nextEntryId || 100;
    }
    // se não houver dados salvos, mantém o exemplo inicial (será salvo na 1ª edição)
  } catch (err) {
    console.error('[load]', err);
    showSaveStatus('Erro ao carregar', true);
  } finally {
    suppressSave = false;   // libera auto-save após o carregamento
    render();
  }
}

// ─────────────────────────────────────────────────────────────────
// Init
// ─────────────────────────────────────────────────────────────────

loadFromServer();

// ─── Autenticação ──────────────────────────────────────────────────

(function guardAuth() {
  if (!window.API || !API.isLoggedIn()) {
    window.location.replace('/');
    return;
  }
  const user = API.getUser();
  const el = document.getElementById('topbar-user');
  if (el && user) {
    const initials = (user.name || user.email).split(' ')
      .map(w => w[0]).join('').slice(0, 2).toUpperCase();
    el.innerHTML = `
      <div class="user-avatar" aria-hidden="true">${initials}</div>
      <span>${user.name || user.email}</span>`;
  }
})();

function logout() {
  API.clearSession();
  window.location.replace('/');
}
