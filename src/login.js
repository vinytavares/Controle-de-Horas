'use strict';

/**
 * Controle de Horas — login.js
 *
 * Responsabilidades:
 *  - Validação de e-mail (formato RFC 5322 simplificado)
 *  - Validação de senha (força e comprimento mínimo)
 *  - Indicador visual de força da senha (4 níveis)
 *  - Feedback inline por campo (erro / sucesso)
 *  - Autenticação via Supabase Auth (signUp / signInWithPassword)
 *  - Sessão persistida automaticamente pelo Supabase JS SDK
 *  - Redirecionamento para o app após login
 */

// ─── Referências DOM ──────────────────────────────────────────────
const form        = document.getElementById('login-form');
const emailInput  = document.getElementById('email');
const passInput   = document.getElementById('password');
const btnSubmit   = document.getElementById('btn-submit');
const btnText     = document.getElementById('btn-text');
const btnLoader   = document.getElementById('btn-loader');
const formAlert   = document.getElementById('form-alert');
const pwStrength  = document.getElementById('pw-strength');
const pwLabel     = document.getElementById('pw-label');
const toast       = document.getElementById('toast');

// ─── Verificar sessão existente ────────────────────────────────────
(async function checkSession() {
  if (window.API && await API.isLoggedIn()) {
    window.location.replace('/app');
  }
})();

// ─── Validação: e-mail ─────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validateEmail(value) {
  if (!value.trim()) return 'O e-mail é obrigatório.';
  if (!EMAIL_REGEX.test(value.trim())) return 'Informe um e-mail válido.';
  return null;
}

// ─── Validação: senha ──────────────────────────────────────────────
function validatePassword(value) {
  if (!value) return 'A senha é obrigatória.';
  if (value.length < 8) return 'A senha deve ter pelo menos 8 caracteres.';
  return null;
}

// ─── Força da senha ────────────────────────────────────────────────
const STRENGTH = [
  { label: 'Fraca',   cls: 'weak',   bars: 1 },
  { label: 'Regular', cls: 'fair',   bars: 2 },
  { label: 'Boa',     cls: 'good',   bars: 3 },
  { label: 'Forte',   cls: 'strong', bars: 4 },
];

function calcStrength(pw) {
  if (!pw) return -1;
  let score = 0;
  if (pw.length >= 8)              score++;
  if (pw.length >= 12)             score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw))            score++;
  if (/[^A-Za-z0-9]/.test(pw))    score++;
  return Math.min(Math.floor(score / 1.25), 3);
}

function renderStrength(pw) {
  const level = calcStrength(pw);
  const bars  = document.querySelectorAll('.pw-bar');

  if (level < 0 || !pw) {
    pwStrength.classList.remove('visible');
    bars.forEach(b => { b.className = 'pw-bar'; });
    pwLabel.textContent = '';
    return;
  }

  pwStrength.classList.add('visible');
  const { label, cls, bars: filled } = STRENGTH[level];
  bars.forEach((b, i) => {
    b.className = 'pw-bar' + (i < filled ? ` ${cls}` : '');
  });
  pwLabel.textContent = label;
  pwLabel.style.color = { weak: '#E24B4A', fair: '#EF9F27', good: '#1D9E75', strong: '#639922' }[cls];
}

// ─── Feedback inline ──────────────────────────────────────────────
function setFieldState(fieldId, errorMsg) {
  const fg    = document.getElementById(`fg-${fieldId}`);
  const errEl = document.getElementById(`${fieldId}-error`);

  if (errorMsg) {
    fg.classList.add('error');
    fg.classList.remove('success');
    errEl.textContent = '⚠ ' + errorMsg;
  } else {
    fg.classList.remove('error');
    fg.classList.add('success');
    errEl.textContent = '';
  }
}

function clearFieldState(fieldId) {
  const fg    = document.getElementById(`fg-${fieldId}`);
  const errEl = document.getElementById(`${fieldId}-error`);
  fg.classList.remove('error', 'success');
  errEl.textContent = '';
}

// ─── Alert global ─────────────────────────────────────────────────
function showAlert(msg, type = 'error') {
  formAlert.textContent = msg;
  formAlert.className   = `form-alert ${type} visible`;
}

function hideAlert() {
  formAlert.className = 'form-alert';
}

// ─── Toast ────────────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// ─── Toggle de senha ──────────────────────────────────────────────
function togglePassword() {
  const isHidden = passInput.type === 'password';
  passInput.type  = isHidden ? 'text' : 'password';

  const btn = document.getElementById('toggle-pw');
  btn.setAttribute('aria-label', isHidden ? 'Ocultar senha' : 'Mostrar senha');
  btn.innerHTML = isHidden
    ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
         <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
         <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
         <line x1="1" y1="1" x2="23" y2="23"/>
       </svg>`
    : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
         <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>
       </svg>`;
}

// ─── Eventos de input ─────────────────────────────────────────────
emailInput.addEventListener('input', () => {
  hideAlert();
  const err = validateEmail(emailInput.value);
  if (emailInput.value) setFieldState('email', err);
  else clearFieldState('email');
});

emailInput.addEventListener('blur', () => {
  if (emailInput.value) setFieldState('email', validateEmail(emailInput.value));
});

passInput.addEventListener('input', () => {
  hideAlert();
  renderStrength(passInput.value);
  const err = validatePassword(passInput.value);
  if (passInput.value) setFieldState('password', err);
  else clearFieldState('password');
});

passInput.addEventListener('blur', () => {
  if (passInput.value) setFieldState('password', validatePassword(passInput.value));
});

// ─── Loading do botão ─────────────────────────────────────────────
function setLoading(on) {
  btnSubmit.disabled = on;
  btnText.hidden     = on;
  btnLoader.hidden   = !on;
  const arrow = document.getElementById('btn-arrow');
  if (arrow) arrow.hidden = on;
}

// ─── Submit ───────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const email    = emailInput.value.trim();
  const password = passInput.value;

  // Validação de ambos os campos
  const emailErr = validateEmail(email);
  const passErr  = validatePassword(password);

  setFieldState('email',    emailErr);
  setFieldState('password', passErr);

  if (emailErr || passErr) return;

  setLoading(true);

  try {
    const { user } = await API.login(email, password);

    showAlert(`Bem-vindo, ${user.name}!`, 'success');
    showToast('Redirecionando…');

    setTimeout(() => { window.location.replace('/app'); }, 700);

  } catch (err) {
    showAlert(err.message || 'Não foi possível entrar.', 'error');
    passInput.value = '';
    renderStrength('');
    clearFieldState('password');
    passInput.focus();
    setLoading(false);
  }
});

// ─── Ações de navegação ───────────────────────────────────────────
function showForgot() {
  showToast('Funcionalidade disponível em breve.');
}

async function showRegister() {
  const email = emailInput.value.trim();
  const password = passInput.value;

  // Precisa de e-mail e senha válidos preenchidos
  const emailErr = validateEmail(email);
  const passErr  = validatePassword(password);
  setFieldState('email', emailErr);
  setFieldState('password', passErr);
  if (emailErr || passErr) {
    showAlert('Preencha e-mail e senha (mín. 8 caracteres) para criar sua conta.', 'error');
    return;
  }

  // Nome derivado do e-mail (parte antes do @), capitalizado
  const name = email.split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  hideAlert();
  setLoading(true);
  try {
    const { user } = await API.signup(name, email, password);
    showAlert(`Conta criada! Bem-vindo, ${user.name}.`, 'success');
    showToast('Redirecionando…');
    setTimeout(() => { window.location.replace('/app'); }, 700);
  } catch (err) {
    showAlert(err.message || 'Não foi possível criar a conta.', 'error');
    setLoading(false);
  }
}
