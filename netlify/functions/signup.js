/**
 * netlify/functions/signup.js
 * POST /api/signup
 * Cria um novo usuário. Body: { name, email, password }
 */

const { connectToDatabase } = require('../../lib/mongodb');
const { hashPassword, signToken, json, preflight } = require('../../lib/auth');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();
  if (event.httpMethod !== 'POST')    return json(405, { error: 'Método não permitido.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch { return json(400, { error: 'JSON inválido.' }); }

  const name     = (body.name || '').trim();
  const email    = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  // Validações
  if (!name)                    return json(400, { error: 'O nome é obrigatório.' });
  if (!EMAIL_RE.test(email))    return json(400, { error: 'E-mail inválido.' });
  if (password.length < 8)      return json(400, { error: 'A senha deve ter no mínimo 8 caracteres.' });

  try {
    const { db } = await connectToDatabase();
    const users = db.collection('users');

    // E-mail já cadastrado?
    const existing = await users.findOne({ email });
    if (existing) return json(409, { error: 'Este e-mail já está cadastrado.' });

    // Garante índice único no e-mail (idempotente)
    await users.createIndex({ email: 1 }, { unique: true });

    const passwordHash = await hashPassword(password);
    const now = new Date();

    const result = await users.insertOne({
      name, email, passwordHash,
      createdAt: now, updatedAt: now,
    });

    const userId = result.insertedId.toString();
    const token  = signToken({ sub: userId, email, name });

    return json(201, {
      token,
      user: { id: userId, name, email },
    });
  } catch (err) {
    console.error('[signup]', err);
    return json(500, { error: 'Erro interno ao criar conta.' });
  }
};
