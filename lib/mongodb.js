/**
 * lib/mongodb.js
 * Conexão reutilizável com o MongoDB Atlas.
 *
 * Em ambientes serverless (Netlify Functions), cada invocação pode reusar
 * a conexão entre execuções "quentes". Por isso cacheamos o client num
 * escopo de módulo — evita abrir uma conexão nova a cada request.
 */

const { MongoClient } = require('mongodb');

const uri    = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'controle_horas';

if (!uri) {
  // Falha cedo e com mensagem clara se a variável não foi configurada.
  console.error('[mongodb] Variável de ambiente MONGODB_URI não definida.');
}

// Cache no escopo do módulo (persiste entre invocações quentes).
let cachedClient = null;
let cachedDb     = null;

async function connectToDatabase() {
  if (cachedDb) return { client: cachedClient, db: cachedDb };

  if (!uri) {
    throw new Error('MONGODB_URI não configurada nas variáveis de ambiente.');
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 8000,
  });

  await client.connect();
  const db = client.db(dbName);

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}

module.exports = { connectToDatabase };
