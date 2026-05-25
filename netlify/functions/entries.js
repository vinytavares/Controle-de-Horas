/**
 * netlify/functions/entries.js
 * GET  /api/entries        → retorna todos os dias do usuário autenticado
 * PUT  /api/entries        → substitui (salva) todos os dias do usuário
 *
 * O front-end mantém o estado completo (array de dias) e sincroniza com
 * o banco. Salvamos o documento inteiro do usuário para simplicidade —
 * adequado ao volume de dados deste app.
 *
 * Requer header: Authorization: Bearer <token>
 */

const { connectToDatabase } = require('../../lib/mongodb');
const { getUserFromEvent, json, preflight } = require('../../lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return preflight();

  const auth = getUserFromEvent(event);
  if (!auth) return json(401, { error: 'Não autenticado.' });

  const userId = auth.sub;

  try {
    const { db } = await connectToDatabase();
    const entries = db.collection('entries');

    // ── GET: carregar dias do usuário ──
    if (event.httpMethod === 'GET') {
      const doc = await entries.findOne({ userId });
      return json(200, {
        days:        doc?.days        || [],
        nextDayId:   doc?.nextDayId   || 1,
        nextEntryId: doc?.nextEntryId || 1,
      });
    }

    // ── PUT: salvar (substituir) dias do usuário ──
    if (event.httpMethod === 'PUT') {
      let body;
      try { body = JSON.parse(event.body || '{}'); }
      catch { return json(400, { error: 'JSON inválido.' }); }

      const days        = Array.isArray(body.days) ? body.days : [];
      const nextDayId   = Number(body.nextDayId)   || 1;
      const nextEntryId = Number(body.nextEntryId) || 1;

      // Validação básica do formato de cada dia
      for (const d of days) {
        if (typeof d.date !== 'string' || !Array.isArray(d.entries)) {
          return json(400, { error: 'Formato de dados inválido.' });
        }
      }

      await entries.updateOne(
        { userId },
        {
          $set: { days, nextDayId, nextEntryId, updatedAt: new Date() },
          $setOnInsert: { userId, createdAt: new Date() },
        },
        { upsert: true }
      );

      return json(200, { ok: true, saved: days.length });
    }

    return json(405, { error: 'Método não permitido.' });
  } catch (err) {
    console.error('[entries]', err);
    return json(500, { error: 'Erro interno ao acessar os dados.' });
  }
};
