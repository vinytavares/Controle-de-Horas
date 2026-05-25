/**
 * lib/auth.js
 * Helpers de autenticação compartilhados entre as functions.
 *  - hash e verificação de senha (bcrypt)
 *  - emissão e validação de token de sessão (JWT)
 *  - helpers de resposta HTTP padronizada
 */

const bcrypt = require('bcryptjs');
const jwt    = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET || 'troque-este-segredo-em-producao';
const TOKEN_TTL   = '8h'; // mesma duração da sessão original (8 horas)

// ─── Senhas ────────────────────────────────────────────────────────
async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plain, salt);
}

async function verifyPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// ─── Tokens ────────────────────────────────────────────────────────
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_TTL });
}

function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

/**
 * Extrai e valida o token do header Authorization: Bearer <token>.
 * Retorna o payload do usuário ou null.
 */
function getUserFromEvent(event) {
  const header = event.headers.authorization || event.headers.Authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return verifyToken(match[1]);
}

// ─── Respostas HTTP ────────────────────────────────────────────────
const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Content-Type': 'application/json',
};

function json(statusCode, body) {
  return { statusCode, headers: CORS, body: JSON.stringify(body) };
}

function preflight() {
  return { statusCode: 204, headers: CORS, body: '' };
}

module.exports = {
  hashPassword, verifyPassword,
  signToken, verifyToken, getUserFromEvent,
  json, preflight, CORS,
};
