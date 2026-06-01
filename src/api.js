/**
 * src/api.js
 * Cliente Supabase do front-end.
 *
 * Responsabilidades:
 *  - Conexão única com Supabase Auth + Postgres
 *  - API enxuta usada pelo login.js (auth) e app.js (CRUD de dias/entradas)
 *  - Todas as queries respeitam RLS — cada usuário só acessa seus dados
 */

const SUPABASE_URL = 'https://bwejrhrxszbdydocbyqs.supabase.co';
const SUPABASE_KEY = 'sb_publishable_yvFjVYGFlHyP5jeqW0rs-A_MuEu5RRQ';

// Cliente único (a lib supabase-js é carregada via CDN no HTML)
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
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) throw new Error(this._friendlyError(error));

    // Se sessão veio direto (email confirm desativado no dashboard), ótimo.
    if (data.session) {
      return { user: { id: data.user.id, name, email } };
    }

    // Sessão nula: GoTrue exige confirmação, mas nosso trigger já confirmou
    // no banco. Tenta login imediatamente — vai funcionar.
    try {
      const loginResult = await this.login(email, password);
      return loginResult;
    } catch {
      // Login falhou mesmo após trigger — pede confirmação manual
      const err = new Error('CONFIRM_EMAIL');
      err.needsConfirmation = true;
      throw err;
    }
  },

  async login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(this._friendlyError(error));
    return { user: { id: data.user.id, email: data.user.email } };
  },

  // ─── Dados: carregar todos os dias do usuário com suas entradas ──
  async loadDays() {
    const { data: daysRaw, error: errDays } = await supabase
      .from('days')
      .select('id, date')
      .order('date', { ascending: true });
    if (errDays) throw new Error(errDays.message);

    if (!daysRaw.length) return [];

    const { data: entriesRaw, error: errEntries } = await supabase
      .from('entries')
      .select('id, day_id, start_time, end_time, type, description, position, duration_mins')
      .order('position', { ascending: true });
    if (errEntries) throw new Error(errEntries.message);

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
    if (error) throw new Error(this._friendlyError(error));
    return { id: data.id, date: data.date, entries: [] };
  },

  async updateDay(dayId, fields) {
    const payload = {};
    if (fields.date) payload.date = fields.date;
    const { error } = await supabase.from('days').update(payload).eq('id', dayId);
    if (error) throw new Error(error.message);
  },

  async deleteDay(dayId) {
    const { error } = await supabase.from('days').delete().eq('id', dayId);
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
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
    if (error) throw new Error(error.message);
  },

  async deleteEntry(entryId) {
    const { error } = await supabase.from('entries').delete().eq('id', entryId);
    if (error) throw new Error(error.message);
  },

  // ─── Helpers ───────────────────────────────────────────────
  _friendlyError(err) {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
    if (msg.includes('already registered'))         return 'Este e-mail já está cadastrado.';
    if (msg.includes('password should be at least')) return 'A senha deve ter no mínimo 6 caracteres.';
    if (msg.includes('email rate limit'))           return 'Muitas tentativas. Aguarde alguns minutos.';
    return err.message;
  },
};

window.API = API;
