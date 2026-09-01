'use strict';

const { neon } = require('@neondatabase/serverless');
const { requireCrmSession, readJsonBody, json } = require('./_crm_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS buyer_activity_log (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      buyer_id     bigint NOT NULL,
      created_at   timestamptz NOT NULL DEFAULT now(),
      created_by   text,
      entry        text NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS crm_audit_log (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      occurred_at  timestamptz NOT NULL DEFAULT now(),
      actor        text NOT NULL,
      action       text NOT NULL,
      record_type  text NOT NULL,
      record_id    bigint,
      details      text
    )
  `;
}

exports.handler = async (event) => {
  const session = requireCrmSession(event);
  if (!session) {
    return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }
  const actor = session.sub;

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });
  const sql = neon(cs);

  try {
    await ensureSchema(sql);

    if (event.httpMethod === 'POST') {
      const body = readJsonBody(event) || {};
      const buyerId = parseInt(body.buyer_id, 10);
      const entry = typeof body.entry === 'string' ? body.entry.trim().slice(0, 4000) : '';
      if (!buyerId || entry.length < 1) {
        return json(400, { ok: false, error: 'Validation failed', fields: ['buyer_id', 'entry'].filter((f) => (f === 'buyer_id' ? !buyerId : entry.length < 1)) });
      }
      const owner = await sql`SELECT id FROM buyers WHERE id = ${buyerId} LIMIT 1`;
      if (!owner[0]) return json(404, { ok: false, error: 'Buyer not found' });

      // Append-only: no UPDATE or DELETE endpoint exists for this table.
      await sql`INSERT INTO buyer_activity_log (buyer_id, created_by, entry) VALUES (${buyerId}, ${actor}, ${entry})`;
      await sql`INSERT INTO crm_audit_log (actor, action, record_type, record_id, details) VALUES (${actor}, 'create', 'buyer_activity', ${buyerId}, NULL)`;
      return json(200, { ok: true });
    }

    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  } catch (err) {
    console.error('[crm-activity] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
