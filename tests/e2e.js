/**
 * tests/e2e.js
 * Testes de integração Frontend ⇄ API (Supabase mockado na camada de rede).
 *
 * Sobe um servidor estático local com os mesmos rewrites do netlify.toml
 * e dirige o browser real (Chromium headless) pelos fluxos de cadastro e
 * login, interceptando as chamadas ao Supabase para simular cada cenário
 * de resposta do servidor (sucesso, e-mail duplicado, credencial inválida,
 * servidor fora do ar, SDK bloqueado).
 *
 * Uso:  node tests/e2e.js
 *       CHROME_PATH=/caminho/para/chrome node tests/e2e.js
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const PORT = 3010;
const BASE = `http://127.0.0.1:${PORT}`;

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.svg': 'image/svg+xml', '.json': 'application/json',
};

// Mesmos rewrites do netlify.toml
const REWRITES = { '/': '/index.html', '/app': '/app.html', '/register': '/register.html' };

function startServer() {
  const server = http.createServer((req, res) => {
    let urlPath = req.url.split('?')[0];
    urlPath = REWRITES[urlPath] || urlPath;
    const file = path.join(ROOT, urlPath);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404); res.end('not found'); return;
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

// ─── Mocks no formato GoTrue/PostgREST ───────────────────────────
const FAKE_USER = {
  id: '11111111-1111-1111-1111-111111111111',
  aud: 'authenticated', role: 'authenticated',
  email: 'teste@exemplo.com', user_metadata: { name: 'Teste' },
};
const FAKE_SESSION = {
  access_token: 'fake-jwt-access-token', token_type: 'bearer',
  expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'fake-refresh-token', user: FAKE_USER,
};

const json = (status, body) => ({ status, contentType: 'application/json', body: JSON.stringify(body) });

// ─── Runner ──────────────────────────────────────────────────────
const results = [];
async function scenario(name, fn) {
  try { await fn(); results.push(['PASS', name]); console.log('  ✅', name); }
  catch (e) { results.push(['FAIL', `${name} — ${e.message}`]); console.log('  ❌', name, '—', e.message); }
}
function expect(cond, msg) { if (!cond) throw new Error(msg); }

async function newPage(browser, { blockSDK = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  if (blockSDK) {
    await ctx.route('**/public/supabase.min.js*', r => r.abort('failed'));
    await ctx.route('**/unpkg.com/**', r => r.abort('failed'));
    await ctx.route('**/cdn.jsdelivr.net/**', r => r.abort('failed'));
  }
  const page = await ctx.newPage();
  page.on('pageerror', e => console.log('     [pageerror]', e.message));
  return { ctx, page };
}

async function fillRegister(page, email, pw, confirm) {
  if (email !== null) await page.fill('#email', email);
  if (pw !== null) await page.fill('#password', pw);
  if (confirm !== null) await page.fill('#confirm', confirm);
}

(async () => {
  const server = await startServer();
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHROME_PATH || undefined,
  });

  console.log('\n── Cadastro ──────────────────────────────────────');

  await scenario('SDK local carrega e window.API é criada', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    expect(await page.evaluate(() => !!window.supabase), 'window.supabase ausente');
    expect(await page.evaluate(() => !!window.API), 'window.API ausente');
    await ctx.close();
  });

  await scenario('cadastro válido → sessão criada e redireciona para /app', async () => {
    const { ctx, page } = await newPage(browser);
    await ctx.route('**/auth/v1/signup**', r => r.fulfill(json(200, FAKE_SESSION)));
    await ctx.route('**/rest/v1/**', r => r.fulfill(json(200, [])));
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await fillRegister(page, 'novo@exemplo.com', 'Senha@123', 'Senha@123');
    await page.click('#btn-submit');
    await page.waitForURL('**/app', { timeout: 15000, waitUntil: 'commit' });
    const hasToken = await page.evaluate(() =>
      Object.keys(localStorage).some(k => k.startsWith('sb-') && k.includes('auth')));
    expect(hasToken, 'token de sessão não persistido no localStorage');
    await ctx.close();
  });

  await scenario('e-mail duplicado → "Este e-mail já está cadastrado."', async () => {
    const { ctx, page } = await newPage(browser);
    await ctx.route('**/auth/v1/signup**', r => r.fulfill(json(422, {
      code: 422, error_code: 'user_already_exists', msg: 'User already registered',
    })));
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await fillRegister(page, 'existe@exemplo.com', 'Senha@123', 'Senha@123');
    await page.click('#btn-submit');
    await page.waitForSelector('.form-alert.visible', { timeout: 8000 });
    const alert = await page.textContent('.form-alert');
    expect(/já está cadastrado/i.test(alert), `mensagem inesperada: "${alert}"`);
    await ctx.close();
  });

  await scenario('senha fraca (sem maiúscula/número) → bloqueia no cliente, sem request', async () => {
    const { ctx, page } = await newPage(browser);
    let called = false;
    await ctx.route('**/auth/v1/signup**', r => { called = true; r.abort(); });
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await fillRegister(page, 'a@b.com', 'senhafraca', 'senhafraca');
    await page.click('#btn-submit');
    await page.waitForTimeout(500);
    const pwErr = await page.textContent('#password-error');
    expect(/maiúscula/i.test(pwErr), `erro de senha inesperado: "${pwErr}"`);
    expect(!called, 'request enviada mesmo com senha inválida');
    await ctx.close();
  });

  await scenario('campos vazios → erros nos 3 campos, sem request', async () => {
    const { ctx, page } = await newPage(browser);
    let called = false;
    await ctx.route('**/auth/v1/**', r => { called = true; r.abort(); });
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await page.click('#btn-submit');
    await page.waitForTimeout(400);
    for (const id of ['email-error', 'password-error', 'confirm-error']) {
      expect((await page.textContent(`#${id}`)).trim().length > 0, `#${id} vazio`);
    }
    expect(!called, 'request enviada com campos vazios');
    await ctx.close();
  });

  await scenario('e-mail inválido → "Informe um e-mail válido."', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await fillRegister(page, 'nao-e-email', 'Senha@123', 'Senha@123');
    await page.click('#btn-submit');
    await page.waitForTimeout(400);
    const err = await page.textContent('#email-error');
    expect(/e-mail válido/i.test(err), `mensagem inesperada: "${err}"`);
    await ctx.close();
  });

  await scenario('senhas não coincidem → "As senhas não coincidem."', async () => {
    const { ctx, page } = await newPage(browser);
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await fillRegister(page, 'a@b.com', 'Senha@123', 'Senha@999');
    await page.click('#btn-submit');
    await page.waitForTimeout(400);
    const err = await page.textContent('#confirm-error');
    expect(/não coincidem/i.test(err), `mensagem inesperada: "${err}"`);
    await ctx.close();
  });

  await scenario('servidor fora do ar → "Servidor indisponível…"', async () => {
    const { ctx, page } = await newPage(browser);
    await ctx.route('**/auth/v1/**', r => r.abort('failed'));
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await fillRegister(page, 'a@b.com', 'Senha@123', 'Senha@123');
    await page.click('#btn-submit');
    await page.waitForSelector('.form-alert.visible', { timeout: 8000 });
    const alert = await page.textContent('.form-alert');
    expect(/servidor indisponível/i.test(alert), `mensagem inesperada: "${alert}"`);
    await ctx.close();
  });

  await scenario('erro de banco (unexpected_failure) → "Banco de dados indisponível…"', async () => {
    const { ctx, page } = await newPage(browser);
    await ctx.route('**/auth/v1/signup**', r => r.fulfill(json(500, {
      code: 500, error_code: 'unexpected_failure', msg: 'Database error saving new user',
    })));
    await page.goto(`${BASE}/register`, { waitUntil: 'networkidle' });
    await fillRegister(page, 'a@b.com', 'Senha@123', 'Senha@123');
    await page.click('#btn-submit');
    await page.waitForSelector('.form-alert.visible', { timeout: 8000 });
    const alert = await page.textContent('.form-alert');
    expect(/banco de dados indisponível/i.test(alert), `mensagem inesperada: "${alert}"`);
    await ctx.close();
  });

  await scenario('SDK bloqueado (local + CDNs) → mensagem específica, não a genérica', async () => {
    const { ctx, page } = await newPage(browser, { blockSDK: true });
    await page.goto(`${BASE}/register`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(800);
    await fillRegister(page, 'a@b.com', 'Senha@123', 'Senha@123');
    await page.click('#btn-submit');
    await page.waitForSelector('.form-alert.visible', { timeout: 10000 });
    const alert = await page.textContent('.form-alert');
    expect(/serviço de autenticação/i.test(alert), `mensagem inesperada: "${alert}"`);
    expect(!/Recarregue a página e tente novamente/.test(alert), 'ainda mostra a mensagem genérica antiga');
    await ctx.close();
  });

  console.log('\n── Login ─────────────────────────────────────────');

  await scenario('login válido → sessão + redireciona para /app', async () => {
    const { ctx, page } = await newPage(browser);
    await ctx.route('**/auth/v1/token**', r => r.fulfill(json(200, FAKE_SESSION)));
    await ctx.route('**/rest/v1/**', r => r.fulfill(json(200, [])));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.fill('#email', 'teste@exemplo.com');
    await page.fill('#password', 'Senha@123');
    await page.click('#btn-submit');
    await page.waitForURL('**/app', { timeout: 15000, waitUntil: 'commit' });
    await ctx.close();
  });

  await scenario('senha incorreta → "E-mail ou senha incorretos."', async () => {
    const { ctx, page } = await newPage(browser);
    await ctx.route('**/auth/v1/token**', r => r.fulfill(json(400, {
      error: 'invalid_grant', error_description: 'Invalid login credentials',
    })));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.fill('#email', 'teste@exemplo.com');
    await page.fill('#password', 'SenhaErrada1');
    await page.click('#btn-submit');
    await page.waitForSelector('.form-alert.visible', { timeout: 8000 });
    const alert = await page.textContent('.form-alert');
    expect(/e-mail ou senha incorretos/i.test(alert), `mensagem inesperada: "${alert}"`);
    await ctx.close();
  });

  await scenario('usuário inexistente → mesma mensagem (sem vazar existência)', async () => {
    const { ctx, page } = await newPage(browser);
    await ctx.route('**/auth/v1/token**', r => r.fulfill(json(400, {
      error: 'invalid_grant', error_description: 'Invalid login credentials',
    })));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.fill('#email', 'naoexiste@exemplo.com');
    await page.fill('#password', 'Qualquer1');
    await page.click('#btn-submit');
    await page.waitForSelector('.form-alert.visible', { timeout: 8000 });
    const alert = await page.textContent('.form-alert');
    expect(/e-mail ou senha incorretos/i.test(alert), `mensagem inesperada: "${alert}"`);
    await ctx.close();
  });

  await scenario('sessão persistida → login já autenticado redireciona direto', async () => {
    const { ctx, page } = await newPage(browser);
    await ctx.route('**/auth/v1/token**', r => r.fulfill(json(200, FAKE_SESSION)));
    await ctx.route('**/rest/v1/**', r => r.fulfill(json(200, [])));
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.fill('#email', 'teste@exemplo.com');
    await page.fill('#password', 'Senha@123');
    await page.click('#btn-submit');
    await page.waitForURL('**/app', { timeout: 15000, waitUntil: 'commit' });
    // Reabrir a página de login: deve voltar ao /app sem pedir credenciais
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/app', { timeout: 15000, waitUntil: 'commit' });
    await ctx.close();
  });

  console.log('\n── Painel (dashboard) ────────────────────────────');

  // Banco em memória com IDs UUID — reproduz o Postgres de produção.
  function uuid(n) { return `aaaaaaa${n}-0000-4000-8000-00000000000${n}`.slice(0, 36); }

  function makeDb() {
    return {
      days: [
        { id: uuid(1), date: '2026-07-15' },
        { id: uuid(2), date: '2026-07-16' },
      ],
      entries: [
        { id: uuid(3), day_id: uuid(1), start_time: '09:00', end_time: '10:30',
          type: 'activity', description: 'Trabalho inicial', position: 0, duration_mins: null },
      ],
      seq: 10,
    };
  }

  async function newDashboard(browser, db, { failWrites = false } = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });

    // Sessão válida semeada antes de qualquer script da página
    await ctx.addInitScript(([session]) => {
      localStorage.setItem('sb-bwejrhrxszbdydocbyqs-auth-token', JSON.stringify(session));
    }, [{ ...FAKE_SESSION, expires_at: Math.floor(Date.now() / 1000) + 86400 }]);

    await ctx.route('**/auth/v1/**', r => r.fulfill(json(200, FAKE_SESSION)));
    await ctx.route('**/rest/v1/profiles*', r => r.fulfill(json(200, {
      id: FAKE_USER.id, name: 'Teste', email: FAKE_USER.email,
    })));

    const restHandler = table => route => {
      const req    = route.request();
      const method = req.method();
      const url    = new URL(req.url());
      const idEq   = (url.searchParams.get('id') || '').replace('eq.', '');
      const single = (req.headers()['accept'] || '').includes('pgrst.object');

      if (method === 'OPTIONS') return route.fulfill({ status: 200, body: '' });
      if (failWrites && method !== 'GET')
        return route.fulfill(json(500, { message: 'internal error' }));

      if (method === 'GET') return route.fulfill(json(200, db[table]));

      if (method === 'POST') {
        const row = { id: uuid(db.seq++ % 10) + db.seq, ...JSON.parse(req.postData()) };
        db[table].push(row);
        return route.fulfill(json(201, single ? row : [row]));
      }
      if (method === 'PATCH') {
        const row = db[table].find(x => String(x.id) === idEq);
        if (row) Object.assign(row, JSON.parse(req.postData()));
        return route.fulfill(json(200, single ? row : [row]));
      }
      if (method === 'DELETE') {
        db[table] = db[table].filter(x => String(x.id) !== idEq);
        if (table === 'days') db.entries = db.entries.filter(e => String(e.day_id) !== idEq);
        return route.fulfill(json(204, []));
      }
      return route.fulfill(json(405, {}));
    };

    await ctx.route('**/rest/v1/days*',    restHandler('days'));
    await ctx.route('**/rest/v1/entries*', restHandler('entries'));

    const page = await ctx.newPage();
    const pageErrors = [];
    page.on('pageerror', e => pageErrors.push(e.message));
    await page.goto(`${BASE}/app`, { waitUntil: 'networkidle' });
    await page.waitForSelector('.day-card', { timeout: 8000 });
    return { ctx, page, pageErrors };
  }

  await scenario('painel carrega: 2 dias, 1 entrada, usuário no topo, sem erros de console', async () => {
    const db = makeDb();
    const { ctx, page, pageErrors } = await newDashboard(browser, db);
    expect((await page.$$('.day-card')).length === 2, 'esperava 2 day-cards');
    expect((await page.$$('.entry-row')).length === 1, 'esperava 1 entry-row');
    expect((await page.textContent('#topbar-user')).includes('Teste'), 'nome do usuário ausente');
    expect(pageErrors.length === 0, `erros no console: ${pageErrors.join(' | ')}`);
    await ctx.close();
  });

  await scenario('ADICIONAR ENTRADA: clique → POST em entries + linha nova + feedback', async () => {
    const db = makeDb();
    const { ctx, page, pageErrors } = await newDashboard(browser, db);
    await page.click('.day-card >> nth=0 >> .btn-add-entry');
    await page.waitForFunction(() => document.querySelectorAll('.entry-row').length === 2, { timeout: 5000 });
    expect(db.entries.length === 2, 'entrada não persistida no banco (sem POST)');
    const st = await page.textContent('#save-status');
    expect(/entrada adicionada/i.test(st), `status inesperado: "${st}"`);
    expect(pageErrors.length === 0, `erros no console: ${pageErrors.join(' | ')}`);
    await ctx.close();
  });

  await scenario('editar descrição → PATCH persiste no banco', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db);
    const sel = '.entry-row >> nth=0 >> input[placeholder="Descrição…"]';
    await page.fill(sel, 'Reunião de planejamento');
    await page.evaluate(s => document.querySelector(s.replace(/ >> nth=0 >> /, ' ')).blur(), sel);
    await page.dispatchEvent('.entry-row input[placeholder="Descrição…"]', 'change');
    await page.waitForTimeout(400);
    expect(db.entries[0].description === 'Reunião de planejamento',
      `banco tem: "${db.entries[0].description}"`);
    await ctx.close();
  });

  await scenario('mudar tipo para Reunião → PATCH type', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db);
    await page.selectOption('.entry-row select', 'meeting');
    await page.waitForTimeout(400);
    expect(db.entries[0].type === 'meeting', `banco tem: "${db.entries[0].type}"`);
    await ctx.close();
  });

  await scenario('alternar p/ modo duração → PATCH duration_mins + campo H:MM aparece', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db);
    await page.click('.entry-row .btn-mode');
    await page.waitForSelector('.hrs-field', { timeout: 5000 });
    await page.waitForTimeout(300);
    expect(db.entries[0].duration_mins === 90, `banco tem: ${db.entries[0].duration_mins} (esperava 90 = 09:00→10:30)`);
    await ctx.close();
  });

  await scenario('digitar duração "2:15" → total do dia vira 2h 15m', async () => {
    const db = makeDb();
    db.entries[0].duration_mins = 60;
    const { ctx, page } = await newDashboard(browser, db);
    await page.fill('.hrs-field', '2:15');
    await page.dispatchEvent('.hrs-field', 'change');
    await page.waitForTimeout(400);
    expect(db.entries[0].duration_mins === 135, `banco tem: ${db.entries[0].duration_mins}`);
    const badge = await page.textContent('.day-card >> nth=0 >> .total-badge');
    expect(badge.includes('2h 15m'), `badge: "${badge}"`);
    await ctx.close();
  });

  await scenario('duração inválida "abc" → erro amigável e valor anterior mantido', async () => {
    const db = makeDb();
    db.entries[0].duration_mins = 60;
    const { ctx, page } = await newDashboard(browser, db);
    await page.fill('.hrs-field', 'abc');
    await page.dispatchEvent('.hrs-field', 'change');
    await page.waitForTimeout(400);
    expect(db.entries[0].duration_mins === 60, 'valor foi sobrescrito com inválido');
    const st = await page.textContent('#save-status');
    expect(/formato inválido/i.test(st), `status: "${st}"`);
    await ctx.close();
  });

  await scenario('remover entrada → DELETE + linha some', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db);
    await page.click('.entry-row .btn-remove-entry');
    await page.waitForFunction(() => document.querySelectorAll('.entry-row').length === 0, { timeout: 5000 });
    await page.waitForTimeout(300);
    expect(db.entries.length === 0, 'entrada segue no banco');
    await ctx.close();
  });

  await scenario('adicionar dia → POST em days + card novo', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db);
    await page.click('.btn-add-day');
    await page.waitForFunction(() => document.querySelectorAll('.day-card').length === 3, { timeout: 5000 });
    expect(db.days.length === 3, 'dia não persistido');
    await ctx.close();
  });

  await scenario('remover dia: modo remoção → selecionar card → confirmar → DELETE', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db);
    await page.click('#btn-rem');
    await page.click('.day-card >> nth=1');
    await page.waitForSelector('.btn-confirm-rm', { timeout: 5000 });
    await page.click('.btn-confirm-rm');
    await page.waitForFunction(() => document.querySelectorAll('.day-card').length === 1, { timeout: 5000 });
    await page.waitForTimeout(300);
    expect(db.days.length === 1, 'dia segue no banco');
    await ctx.close();
  });

  await scenario('calendário abre, navega de mês e clique em dia vazio cria o dia', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db);
    await page.click('#btn-cal');
    await page.waitForSelector('.cal-panel', { timeout: 5000 });
    const label1 = await page.textContent('.cal-month-label');
    await page.click('.cal-nav-btn >> nth=1');
    const label2 = await page.textContent('.cal-month-label');
    expect(label1 !== label2, 'navegação de mês não mudou o rótulo');
    await page.click('.cal-nav-btn >> nth=0'); // volta
    const before = db.days.length;
    await page.click('.cal-day:not(.other-month):not(.selected) >> nth=0');
    await page.waitForTimeout(500);
    expect(db.days.length === before + 1, 'clique no calendário não criou o dia');
    await ctx.close();
  });

  await scenario('falha da API no salvar (500) → status "Erro ao salvar"', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db, { failWrites: true });
    await page.selectOption('.entry-row select', 'meeting');
    await page.waitForTimeout(500);
    const st = await page.textContent('#save-status');
    expect(/erro/i.test(st), `status: "${st}"`);
    await ctx.close();
  });

  await scenario('descrição com aspas/HTML não quebra a interface (escape)', async () => {
    const db = makeDb();
    db.entries[0].description = 'Reunião "importante" <b>x</b>';
    const { ctx, page, pageErrors } = await newDashboard(browser, db);
    const val = await page.inputValue('.entry-row input[placeholder="Descrição…"]');
    expect(val === 'Reunião "importante" <b>x</b>', `valor renderizado: "${val}"`);
    expect((await page.$$('.entry-row')).length === 1, 'linha quebrada pela descrição');
    expect(pageErrors.length === 0, `erros no console: ${pageErrors.join(' | ')}`);
    await ctx.close();
  });

  await scenario('logout → volta para a tela de login', async () => {
    const db = makeDb();
    const { ctx, page } = await newDashboard(browser, db);
    await page.click('.btn-logout');
    await page.waitForURL(u => !u.pathname.includes('/app'), { timeout: 15000, waitUntil: 'commit' });
    await ctx.close();
  });

  await browser.close();
  server.close();

  const fails = results.filter(([s]) => s === 'FAIL');
  console.log(`\n══ Resultado: ${results.length - fails.length}/${results.length} cenários OK ══`);
  if (fails.length) { fails.forEach(([, m]) => console.log('  FAIL:', m)); process.exit(1); }
})();
