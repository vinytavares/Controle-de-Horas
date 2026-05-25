/**
 * src/api.js
 * Cliente de API do front-end. Conversa com as Netlify Functions.
 *
 * Guarda o token JWT no localStorage (apenas o token, nunca a senha).
 * Todas as chamadas autenticadas enviam Authorization: Bearer <token>.
 */

const API = {
  TOKEN_KEY: 'ch_token',
  USER_KEY:  'ch_user',

  // ── Sessão local (token + dados do usuário) ──
  getToken() { return localStorage.getItem(this.TOKEN_KEY); },
  getUser()  {
    try { return JSON.parse(localStorage.getItem(this.USER_KEY) || 'null'); }
    catch { return null; }
  },
  setSession(token, user) {
    localStorage.setItem(this.TOKEN_KEY, token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(user));
  },
  clearSession() {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
  },
  isLoggedIn() { return !!this.getToken(); },

  // ── Requisição base ──
  async _request(path, { method = 'GET', body = null, auth = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
      const token = this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    let data;
    try { data = await res.json(); } catch { data = {}; }

    if (!res.ok) {
      const err = new Error(data.error || `Erro ${res.status}`);
      err.status = res.status;
      throw err;
    }
    return data;
  },

  // ── Endpoints de autenticação ──
  signup(name, email, password) {
    return this._request('signup', { method: 'POST', body: { name, email, password } });
  },
  login(email, password) {
    return this._request('login', { method: 'POST', body: { email, password } });
  },

  // ── Endpoints de dados ──
  loadEntries() {
    return this._request('entries', { method: 'GET', auth: true });
  },
  saveEntries(days, nextDayId, nextEntryId) {
    return this._request('entries', {
      method: 'PUT', auth: true,
      body: { days, nextDayId, nextEntryId },
    });
  },
};

window.API = API;
