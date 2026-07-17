'use strict';

// ─── Referências DOM ──────────────────────────────────────────────
const form         = document.getElementById('register-form');
const emailInput   = document.getElementById('email');
const passInput    = document.getElementById('password');
const confirmInput = document.getElementById('confirm');
const btnSubmit    = document.getElementById('btn-submit');
const btnText      = document.getElementById('btn-text');
const btnLoader    = document.getElementById('btn-loader');
const formAlert    = document.getElementById('form-alert');
const pwStrength   = document.getElementById('pw-strength');
const pwLabel      = document.getElementById('pw-label');
const toast        = document.getElementById('toast');

// ─── Redireciona se já logado ──────────────────────────────────────
(async function checkSession() {
  if (window.API && await API.isLoggedIn()) {
    window.location.replace('/app');
  }
})();

// ─── Regras de negócio ─────────────────────────────────────────────
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const PASSWORD_RULES = {
  length: (pw) => pw.length >= 8,
  upper:  (pw) => /[A-Z]/.test(pw),
  lower:  (pw) => /[a-z]/.test(pw),
  number: (pw) => /[0-9]/.test(pw),
};

function validateEmail(value) {
  if (!value.trim()) return 'O e-mail é obrigatório.';
  if (!EMAIL_REGEX.test(value.trim())) return 'Informe um e-mail válido.';
  return null;
}

function validatePassword(value) {
  if (!value) return 'A senha é obrigatória.';
  if (!PASSWORD_RULES.length(value)) return 'A senha deve ter pelo menos 8 caracteres.';
  if (!PASSWORD_RULES.upper(value))  return 'A senha deve conter ao menos uma letra maiúscula.';
  if (!PASSWORD_RULES.lower(value))  return 'A senha deve conter ao menos uma letra minúscula.';
  if (!PASSWORD_RULES.number(value)) return 'A senha deve conter ao menos um número.';
  return null;
}

function validateConfirm(value, pw) {
  if (!value) return 'A confirmação de senha é obrigatória.';
  if (value !== pw) return 'As senhas não coincidem.';
  return null;
}

// ─── Indicador de regras em tempo real ────────────────────────────
function updateRules(pw) {
  Object.entries(PASSWORD_RULES).forEach(([key, check]) => {
    const el = document.getElementById(`rule-${key}`);
    if (!el) return;
    const passed = pw && check(pw);
    el.classList.toggle('passed', !!passed);
    el.classList.toggle('failed', !!(pw && !passed));
  });
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
  if (pw.length >= 8)                              score++;
  if (pw.length >= 12)                             score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw))       score++;
  if (/[0-9]/.test(pw))                            score++;
  if (/[^A-Za-z0-9]/.test(pw))                    score++;
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
  pwLabel.style.color = { weak: '#EF4444', fair: '#F59E0B', good: '#3B82F6', strong: '#22C55E' }[cls];
}

// ─── Feedback inline ──────────────────────────────────────────────
function setFieldState(fieldId, errorMsg) {
  const fg    = document.getElementById(`fg-${fieldId}`);
  const errEl = document.getElementById(`${fieldId}-error`);
  if (!fg || !errEl) return;

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
  if (!fg || !errEl) return;
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

// ─── Toggle visibilidade de senha ─────────────────────────────────
function togglePassword(inputId, btnId) {
  const input  = document.getElementById(inputId);
  const btn    = document.getElementById(btnId);
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  btn.setAttribute('aria-label', hidden ? 'Ocultar senha' : 'Mostrar senha');
  btn.innerHTML = hidden
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
  const pw = passInput.value;
  renderStrength(pw);
  updateRules(pw);

  const err = validatePassword(pw);
  if (pw) setFieldState('password', err);
  else clearFieldState('password');

  // Revalida confirmação se já foi preenchida
  if (confirmInput.value) {
    const cErr = validateConfirm(confirmInput.value, pw);
    setFieldState('confirm', cErr);
  }
});

passInput.addEventListener('blur', () => {
  if (passInput.value) setFieldState('password', validatePassword(passInput.value));
});

confirmInput.addEventListener('input', () => {
  hideAlert();
  const err = validateConfirm(confirmInput.value, passInput.value);
  if (confirmInput.value) setFieldState('confirm', err);
  else clearFieldState('confirm');
});

confirmInput.addEventListener('blur', () => {
  if (confirmInput.value) setFieldState('confirm', validateConfirm(confirmInput.value, passInput.value));
});

// ─── Estado de carregamento ───────────────────────────────────────
function setLoading(on) {
  btnSubmit.disabled  = on;
  btnText.hidden      = on;
  btnLoader.hidden    = !on;
  const arrow = document.getElementById('btn-arrow');
  if (arrow) arrow.hidden = on;
}

// ─── Submit ───────────────────────────────────────────────────────
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideAlert();

  const email    = emailInput.value.trim();
  const password = passInput.value;
  const confirm  = confirmInput.value;

  const emailErr   = validateEmail(email);
  const passErr    = validatePassword(password);
  const confirmErr = validateConfirm(confirm, password);

  setFieldState('email',    emailErr);
  setFieldState('password', passErr);
  setFieldState('confirm',  confirmErr);

  if (emailErr || passErr || confirmErr) {
    showAlert('Corrija os campos indicados antes de continuar.', 'error');
    return;
  }

  setLoading(true);

  const name = email.split('@')[0]
    .replace(/[._-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());

  try {
    // Recupera o SDK dinamicamente se não carregou no primeiro paint
    const api = await window.ensureAPI();
    const { user } = await api.signup(name, email, password);
    showAlert(`Conta criada! Bem-vindo, ${user.name}.`, 'success');
    showToast('Redirecionando…');
    setTimeout(() => { window.location.replace('/app'); }, 700);
  } catch (err) {
    if (err.needsConfirmation) {
      showAlert('✉ Conta criada! Verifique seu e-mail e clique no link de confirmação para ativar.', 'success');
      setLoading(false);
      return;
    }
    showAlert(err.message || 'Não foi possível criar a conta.', 'error');
    setLoading(false);
  }
});
