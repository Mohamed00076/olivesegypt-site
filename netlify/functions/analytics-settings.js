'use strict';

/*
 * Section J Phase 1 -- admin-only settings for the custom event pipeline:
 * the configurable bot-confidence threshold, and the manual
 * false-positive review action (bot_override on a session). Same
 * tc_session admin gate as analytics-report.js.
 */

const { neon } = require('@neondatabase/serverless');
const { parseCookies, verifySession, COOKIE_NAME, readJsonBody, json } = require('./_lib');
const { ensureSchema } = require('./_analytics_lib');

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

async function handleGet(sql) {
  const rows = await sql`SELECT value FROM analytics_settings WHERE key = 'bot_confidence_threshold'`;
  const threshold = rows[0] ? Number(rows[0].value) : 70;
  return json(200, { bot_confidence_threshold: threshold });
}

async function handlePatchThreshold(sql, body) {
  const threshold = Number(body.bot_confidence_threshold);
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
    return json(400, { ok: false, error: 'bot_confidence_threshold must be a number between 0 and 100' });
  }
  await sql`
    INSERT INTO analytics_settings (key, value, updated_at)
    VALUES ('bot_confidence_threshold', ${JSON.stringify(Math.round(threshold))}::jsonb, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `;
  return json(200, { ok: true, bot_confidence_threshold: Math.round(threshold) });
}

// Manual false-positive review: an admin looking at analytics-report.js's
// bot_review list confirms or overrides a session's classification.
// override=true confirms it as a bot, override=false confirms it as
// human (excludes it from bot-suppression regardless of score), and
// override=null clears back to "unreviewed, use the computed score."
async function handlePatchOverride(sql, body) {
  const sessionId = typeof body.session_id === 'string' ? body.session_id.slice(0, 100) : '';
  if (!sessionId) return json(400, { ok: false, error: 'session_id required' });

  let override = null;
  if (body.override === true) override = true;
  else if (body.override === false) override = false;
  else if (body.override !== null) return json(400, { ok: false, error: 'override must be true, false, or null' });

  const rows = await sql`
    UPDATE analytics_sessions SET bot_override = ${override} WHERE session_id = ${sessionId}
    RETURNING session_id
  `;
  if (!rows[0]) return json(404, { ok: false, error: 'Session not found' });
  return json(200, { ok: true });
}

exports.handler = async (event) => {
  const session = requireAdmin(event);
  if (!session) {
    return json(401, { error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }

  const cs = connectionString();
  if (!cs) return json(500, { error: 'Server not configured' });
  const sql = neon(cs);

  try {
    await ensureSchema(sql);

    if (event.httpMethod === 'GET') return await handleGet(sql);

    if (event.httpMethod === 'PATCH') {
      const body = readJsonBody(event) || {};
      if (body.session_id !== undefined) return await handlePatchOverride(sql, body);
      if (body.bot_confidence_threshold !== undefined) return await handlePatchThreshold(sql, body);
      return json(400, { ok: false, error: 'Nothing to update' });
    }

    return json(405, { error: 'Method not allowed' }, { Allow: 'GET, PATCH' });
  } catch (err) {
    console.error('[analytics-settings] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Server error' });
  }
};
