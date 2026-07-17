/**
 * src/api.js
 * Cliente Supabase do front-end.
 *
 * Responsabilidades:
 *  - Conexão única com Supabase Auth + Postgres
 *  - API enxuta usada pelo login.js (auth) e app.js (CRUD de dias/entradas)
 *  - Todas as queries respeitam RLS — cada usuário só acessa seus dados
 *  - Recuperação automática caso o SDK não tenha carregado no primeiro paint
 *  - Timeout de requisições e mensagens de erro específicas por causa
 */

const SUPABASE_URL = 'https://bwejrhrxszbdydocbyqs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yvFjVYGFlHyP5jeqW0rs-A_MuEu5RRQ';

const SDK_SOURCES = [
  '/public/supabase.min.js',
  'https://unpkg.com/@supabase/supabase-js@2/dist/umd/supabase.js',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js',
];

const REQUEST_TIMEOUT_MS = 15000;

// ─── Carregamento resiliente do SDK ──────────────────────────────
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => resolve(src);
    s.onerror = () => { s.remove(); reject(new Error(`Falha ao carregar ${src}`)); };
    document.head.appendChild(s);
  });
}

async function loadSupabaseSDK() {
  if (window.supabase) return true;
  for (const src of SDK_SOURCES) {
    try {
      await loadScript(src);
      if (window.supabase) {
        console.info('[api] Supabase SDK carregado via', src);
        return true;
      }
    } catch (e) {
      console.warn('[api]', e.message);
    }
  }
  return false;
}

// ─── Timeout helper ──────────────────────────────────────────────
function withTimeout(promise, ms = REQUEST_TIMEOUT_MS) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('TIMEOUT')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

// ─── Tradução de erros para mensagens específicas ────────────────
function friendlyError(err) {
  const msg = (err && err.message ? err.message : String(err)).toLowerCase();

  if (msg === 'timeout')
    return 'O servidor demorou para responder. Verifique sua conexão e tente novamente.';
  if (msg.includes('failed to fetch') || msg.includes('networkerror') || msg.includes('load failed') || msg.includes('fetch failed'))
    return 'Servidor indisponível. Verifique sua conexão com a internet e tente novamente.';
  if (msg.includes('invalid login credentials'))
    return 'E-mail ou senha incorretos.';
  if (msg.includes('already registered') || msg.includes('user already exists') || msg.includes('already been registered'))
    return 'Este e-mail já está cadastrado. Use a página de login.';
  if (msg.includes('password should be at least'))
    return 'A senha não atende ao tamanho mínimo exigido pelo servidor.';
  if (msg.includes('email not confirmed'))
    return 'E-mail ainda não confirmado. Verifique sua caixa de entrada.';
  if (msg.includes('invalid email') || msg.includes('unable to validate email'))
    return 'O e-mail informado é inválido.';
  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
  if (msg.includes('jwt') || msg.includes('token'))
    return 'Sessão inválida ou expirada. Faça login novamente.';
  if (msg.includes('database') || msg.includes('unexpected_failure'))
    return 'Banco de dados indisponível no momento. Tente novamente em instantes.';

  return err && err.message ? err.message : 'Erro interno. Tente novamente.';
}

// ─── Criação da API (idempotente) ────────────────────────────────
function initAPI() {
  if (window.API) return true;
  if (!window.supabase) return false;

  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const API = {
    // ─── Sessão ────────────────────────────────────────────────
    async getSession() {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },

    async getUser() {
      const session = await this.getSession();
      if (!session) return null;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, name, email')
        .eq('id', session.user.id)
        .single();
      return profile || { id: session.user.id, name: session.user.email, email: session.user.email };
    },

    async isLoggedIn() {
      const session = await this.getSession();
      return !!session;
    },

    async logout() {
      await supabase.auth.signOut();
    },

    // ─── Autenticação ──────────────────────────────────────────
    async signup(name, email, password) {
      let data, error;
      try {
        ({ data, error } = await withTimeout(
          supabase.auth.signUp({ email, password, options: { data: { name } } })
        ));
      } catch (e) {
        console.error('[api] signup falhou:', e);
        throw new Error(friendlyError(e));
      }

      if (error) {
        console.error('[api] signup rejeitado pelo servidor:', error);
        throw new Error(friendlyError(error));
      }

      // Sessão veio direto (confirmação de e-mail desativada) — ótimo.
      if (data.session) {
        return { user: { id: data.user.id, name, email } };
      }

      // Sessão nula: GoTrue exige confirmação, mas nosso trigger já confirmou
      // no banco. Tenta login imediatamente — vai funcionar.
      try {
        return await this.login(email, password);
      } catch {
        const err = new Error('CONFIRM_EMAIL');
        err.needsConfirmation = true;
        throw err;
      }
    },

    async login(email, password) {
      let data, error;
      try {
        ({ data, error } = await withTimeout(
          supabase.auth.signInWithPassword({ email, password })
        ));
      } catch (e) {
        console.error('[api] login falhou:', e);
        throw new Error(friendlyError(e));
      }
      if (error) {
        console.error('[api] login rejeitado pelo servidor:', error);
        throw new Error(friendlyError(error));
      }
      return { user: { id: data.user.id, email: data.user.email, name: data.user.user_metadata?.name || data.user.email } };
    },

    // ─── Dados: carregar todos os dias do usuário com suas entradas ──
    async loadDays() {
      const { data: daysRaw, error: errDays } = await supabase
        .from('days')
        .select('id, date')
        .order('date', { ascending: true });
      if (errDays) throw new Error(friendlyError(errDays));

      if (!daysRaw.length) return [];

      const { data: entriesRaw, error: errEntries } = await supabase
        .from('entries')
        .select('id, day_id, start_time, end_time, type, description, position, duration_mins')
        .order('position', { ascending: true });
      if (errEntries) throw new Error(friendlyError(errEntries));

      // Agrupar entradas por day_id
      const byDay = {};
      entriesRaw.forEach(e => {
        if (!byDay[e.day_id]) byDay[e.day_id] = [];
        byDay[e.day_id].push({
          id:    e.id,
          start: (e.start_time || '').slice(0, 5),
          end:   (e.end_time || '').slice(0, 5),
          type:  e.type,
          desc:  e.description || '',
          mins:  e.duration_mins ?? null,
        });
      });

      return daysRaw.map(d => ({
        id:      d.id,
        date:    d.date,
        entries: byDay[d.id] || [],
      }));
    },

    // ─── Dias ──────────────────────────────────────────────────
    async createDay(date) {
      const session = await this.getSession();
      const { data, error } = await supabase
        .from('days')
        .insert({ date, user_id: session.user.id })
        .select('id, date')
        .single();
      if (error) throw new Error(friendlyError(error));
      return { id: data.id, date: data.date, entries: [] };
    },

    async updateDay(dayId, fields) {
      const payload = {};
      if (fields.date) payload.date = fields.date;
      const { error } = await supabase.from('days').update(payload).eq('id', dayId);
      if (error) throw new Error(friendlyError(error));
    },

    async deleteDay(dayId) {
      const { error } = await supabase.from('days').delete().eq('id', dayId);
      if (error) throw new Error(friendlyError(error));
    },

    // ─── Entradas ──────────────────────────────────────────────
    async createEntry(dayId, entry, position) {
      const session = await this.getSession();
      const { data, error } = await supabase
        .from('entries')
        .insert({
          day_id:        dayId,
          user_id:       session.user.id,
          start_time:    entry.start || null,
          end_time:      entry.end   || null,
          type:          entry.type,
          description:   entry.desc  || '',
          position,
          duration_mins: entry.mins  ?? null,
        })
        .select('id')
        .single();
      if (error) throw new Error(friendlyError(error));
      return data.id;
    },

    async updateEntry(entryId, fields) {
      const payload = {};
      if ('start'    in fields) payload.start_time    = fields.start || null;
      if ('end'      in fields) payload.end_time      = fields.end   || null;
      if ('type'     in fields) payload.type          = fields.type;
      if ('desc'     in fields) payload.description   = fields.desc;
      if ('position' in fields) payload.position      = fields.position;
      if ('mins'     in fields) payload.duration_mins = fields.mins ?? null;

      const { error } = await supabase.from('entries').update(payload).eq('id', entryId);
      if (error) throw new Error(friendlyError(error));
    },

    async deleteEntry(entryId) {
      const { error } = await supabase.from('entries').delete().eq('id', entryId);
      if (error) throw new Error(friendlyError(error));
    },
  };

  window.API = API;
  return true;
}

/**
 * Garante que a API exista antes de usá-la.
 * Se o SDK não carregou no primeiro paint (rede lenta, CDN bloqueada),
 * tenta recarregá-lo dinamicamente antes de desistir.
 */
async function ensureAPI() {
  if (initAPI()) return window.API;
  const ok = await loadSupabaseSDK();
  if (ok && initAPI()) return window.API;
  throw new Error('Não foi possível conectar ao serviço de autenticação. Verifique sua internet e recarregue a página.');
}

window.initAPI   = initAPI;
window.ensureAPI = ensureAPI;

if (!initAPI()) {
  console.error('[api] Supabase SDK ausente no carregamento inicial — será recarregado sob demanda.');
  loadSupabaseSDK().then(ok => { if (ok) initAPI(); });
}
