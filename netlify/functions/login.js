/**
 * netlify/functions/login.js
 * POST /api/login
 * Autentica um usuário. Body: { email, password }
 */

const { connectToDatabase } = require('../../lib/mongodb');
const { verifyPassword, signToken, json, preflight } = require('../../lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Método não permitido.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'JSON inválido.' }); }

  const email    = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) return json(400, { error: 'E-mail e senha são obrigatórios.' });

  try {
    const { db } = await connectToDatabase();
    const users = db.collection('users');

    const user = await users.findOne({ email });
    // Mensagem genérica de propósito — não revela se o e-mail existe.
    if (!user) return json(401, { error: 'E-mail ou senha incorretos.' });

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok)  return json(401, { error: 'E-mail ou senha incorretos.' });

    const userId = user._id.toString();
    const token  = signToken({ sub: userId, email: user.email, name: user.name });

    return json(200, {
      token,
      user: { id: userId, name: user.name, email: user.email },
    });
  } catch (err) {
    console.error('[login]', err);
    return json(500, { error: 'Erro interno ao autenticar.' });
  }
};
