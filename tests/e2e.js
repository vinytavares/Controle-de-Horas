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
    await page.waitForURL('**/app', { timeout: 8000 });
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
    await page.waitForURL('**/app', { timeout: 8000 });
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
    await page.waitForURL('**/app', { timeout: 8000 });
    // Reabrir a página de login: deve voltar ao /app sem pedir credenciais
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForURL('**/app', { timeout: 8000 });
    await ctx.close();
  });

  await browser.close();
  server.close();

  const fails = results.filter(([s]) => s === 'FAIL');
  console.log(`\n══ Resultado: ${results.length - fails.length}/${results.length} cenários OK ══`);
  if (fails.length) { fails.forEach(([, m]) => console.log('  FAIL:', m)); process.exit(1); }
})();
