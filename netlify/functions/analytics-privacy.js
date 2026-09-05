'use strict';

/*
 * Section J Phase 3 -- privacy tooling required alongside the numbered
 * features: delete a specific visitor's data on request, and retention-
 * policy visibility. Admin-only (same tc_session gate as the rest of
 * /admin/analytics/). Deletion is a real, destructive action -- same
 * "explicit confirmation required server-side, not just a client
 * dialog" pattern already established for the CRM's bulk delete/export.
 */

const { neon } = require('@neondatabase/serverless');
const { parseCookies, verifySession, COOKIE_NAME, readJsonBody, json } = require('./_lib');
const { ensureSchema, auditLog, clean, MIN_RETENTION_DAYS, MAX_RETENTION_DAYS } = require('./_analytics_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

function requireAdmin(event) {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const token = SESSION_SECRET ? parseCookies(event.headers)[COOKIE_NAME] : null;
  return token ? verifySession(token, SESSION_SECRET) : null;
}

async function handleGetPolicy(sql) {
  const rows = await sql`SELECT key, value FROM analytics_settings WHERE key = 'data_retention_days'`;
  const days = rows[0] ? Number(rows[0].value) : 395;
  return json(200, {
    data_retention_days: days,
    note: `Session and event data older than ${days} days is purged automatically by a scheduled function (see netlify/functions/analytics-retention.js). This figure (395 days, ~13 months) is the spec's own suggested starting point, explicitly pending real legal review -- not a compliance guarantee.`,
  });
}

async function handleSetPolicy(sql, body, actor) {
  const days = Number(body.data_retention_days);
  // The lower bound used to be 1. A 1 typed here would have had the nightly
  // purge destroy thirteen months of analytics on its next run; the floor is
  // now the same one analytics-retention.js refuses to act below, so the
  // form and the delete agree instead of the form permitting what the delete
  // will silently decline to do.
  if (!Number.isFinite(days) || days < MIN_RETENTION_DAYS || days > MAX_RETENTION_DAYS) {
    return json(400, {
      ok: false,
      error: `data_retention_days must be a number between ${MIN_RETENTION_DAYS} and ${MAX_RETENTION_DAYS}`,
    });
  }
  await sql`
    INSERT INTO analytics_settings (key, value, updated_at)
    VALUES ('data_retention_days', ${JSON.stringify(Math.round(days))}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  await auditLog(sql, actor, 'set_retention_policy', `data_retention_days=${Math.round(days)}`);
  return json(200, { ok: true, data_retention_days: Math.round(days) });
}

async function handleDeleteVisitor(event, sql, body, actor) {
  const qs = event.queryStringParameters || {};
  const visitorId = clean(body.visitor_id, 100);
  if (!visitorId) return json(400, { ok: false, error: 'visitor_id required' });

  // Same server-side confirmation pattern as the CRM's bulk delete/export
  // -- not just a client-side confirm() dialog.
  if (qs.confirmed !== '1') {
    return json(400, { ok: false, error: 'Deletion requires explicit confirmation (confirmed=1)' });
  }

  const sessionRows = await sql`SELECT session_id FROM analytics_sessions WHERE visitor_id = ${visitorId}`;
  const sessionIds = sessionRows.map((r) => r.session_id);

  if (sessionIds.length) {
    await sql`DELETE FROM analytics_events WHERE visitor_id = ${visitorId}`;
    await sql`DELETE FROM analytics_sessions WHERE visitor_id = ${visitorId}`;
  }

  // The actual "invalidated for future correlation" mechanism -- see
  // analytics-collect.js, which checks every incoming visitor_id against
  // this table before writing anything.
  await sql`
    INSERT INTO deleted_visitor_ids (visitor_id) VALUES (${visitorId})
    ON CONFLICT (visitor_id) DO NOTHING
  `;

  await auditLog(sql, actor, 'delete_visitor', `visitor_id=${visitorId} sessions=${sessionIds.length}`);

  return json(200, {
    ok: true,
    visitor_id: visitorId,
    sessions_deleted: sessionIds.length,
    note: 'This visitor_id is now permanently rejected by the ingestion endpoint -- no future event can be written under it, and no attempt is made to link whatever new ID that browser mints next back to this one.',
  });
}

exports.handler = async (event) => {
  const session = requireAdmin(event);
  if (!session) {
    return json(401, { ok: false, error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }
  const actor = session.sub;

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });
  const sql = neon(cs);

  try {
    await ensureSchema(sql);

    if (event.httpMethod === 'GET') return await handleGetPolicy(sql);

    if (event.httpMethod === 'PATCH') {
      const body = readJsonBody(event) || {};
      if (body.data_retention_days !== undefined) return await handleSetPolicy(sql, body, actor);
      return json(400, { ok: false, error: 'Nothing to update' });
    }

    if (event.httpMethod === 'POST') {
      const body = readJsonBody(event) || {};
      if (body.action === 'delete_visitor') return await handleDeleteVisitor(event, sql, body, actor);
      return json(400, { ok: false, error: 'Unknown action' });
    }

    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, PATCH, POST' });
  } catch (err) {
    console.error('[analytics-privacy] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
