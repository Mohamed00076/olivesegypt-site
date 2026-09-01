'use strict';

// Consent event log (G2). Records that a choice was made and what it was --
// this is the accountability record referenced in the privacy policy, not
// an analytics identifier. device_hash is a one-way, truncated hash of
// (client IP + User-Agent), never the raw IP, and must never be reused as
// an analytics visitor ID anywhere else in the codebase (see
// docs/g1-data-flow-inventory.md, section 6).

const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { readJsonBody, parseCookies, verifySession, COOKIE_NAME, json } = require('./_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const MAX = { mechanism: 60, policy_version: 30, consent_version: 30 };
const ALLOWED_MECHANISMS = new Set(['banner_accept_all', 'banner_reject', 'preferences_saved']);

function str(v) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}
function clean(v, cap) {
  return str(v).trim().slice(0, cap);
}

function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

function deviceHash(event) {
  const ip = clientIp(event);
  const ua = (event.headers && (event.headers['user-agent'] || event.headers['User-Agent'])) || '';
  // One-way, truncated -- deliberately not reversible to the raw IP, and
  // deliberately not the same value used anywhere as an analytics ID.
  return crypto.createHash('sha256').update('consent-log:' + ip + ':' + ua).digest('hex').slice(0, 24);
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS consent_log (
      id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      consent_id       text NOT NULL,
      created_at       timestamptz NOT NULL DEFAULT now(),
      categories       jsonb NOT NULL,
      policy_version   text NOT NULL,
      consent_version  text NOT NULL,
      mechanism        text NOT NULL,
      device_hash      text NOT NULL
    )
  `;
}

async function handlePost(event, sql) {
  const body = readJsonBody(event);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { ok: false, error: 'Invalid request body' });
  }

  const mechanism = clean(body.mechanism, MAX.mechanism);
  const policyVersion = clean(body.policy_version, MAX.policy_version);
  const consentVersion = clean(body.consent_version, MAX.consent_version);
  const categories = body.categories;

  const errors = [];
  if (!ALLOWED_MECHANISMS.has(mechanism)) errors.push('mechanism');
  if (!policyVersion) errors.push('policy_version');
  if (!consentVersion) errors.push('consent_version');
  if (!categories || typeof categories !== 'object' || Array.isArray(categories)) errors.push('categories');
  else if (typeof categories.analytics !== 'boolean') errors.push('categories.analytics');

  if (errors.length) {
    return json(400, { ok: false, error: 'Validation failed', fields: errors });
  }

  const consentId = crypto.randomBytes(16).toString('hex');
  const hash = deviceHash(event);

  await sql`
    INSERT INTO consent_log (consent_id, categories, policy_version, consent_version, mechanism, device_hash)
    VALUES (${consentId}, ${JSON.stringify({ analytics: categories.analytics === true })}::jsonb, ${policyVersion}, ${consentVersion}, ${mechanism}, ${hash})
  `;

  return json(200, { ok: true, consent_id: consentId });
}

async function handleGet(event, sql) {
  // Independently queryable for G4 validation -- session-authenticated,
  // same pattern as the inquiries/analytics admin endpoints.
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const token = SESSION_SECRET ? parseCookies(event.headers)[COOKIE_NAME] : null;
  const session = token ? verifySession(token, SESSION_SECRET) : null;
  if (!session) {
    return json(401, { error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }

  const rows = await sql`
    SELECT
      consent_id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
      categories,
      policy_version,
      consent_version,
      mechanism,
      device_hash
    FROM consent_log
    ORDER BY created_at DESC
    LIMIT 5000
  `;

  return json(200, rows, { 'Cache-Control': 'no-store, private' });
}

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method !== 'POST' && method !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST' });
  }

  const cs = connectionString();
  if (!cs) {
    return json(500, { ok: false, error: 'Server not configured' });
  }

  const sql = neon(cs);

  try {
    await ensureSchema(sql);
    if (method === 'POST') return await handlePost(event, sql);
    return await handleGet(event, sql);
  } catch (err) {
    console.error('[consent] db error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Could not record consent' });
  }
};
