'use strict';

const { neon } = require('@neondatabase/serverless');
const {
  verifyPassword,
  signSession,
  crmSessionCookie,
  CRM_SESSION_TTL_SECONDS,
  readJsonBody,
  json,
} = require('./_crm_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;

function rateLimited(ip) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.resetAt < now) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  rec.count += 1;
  return rec.count > MAX_ATTEMPTS;
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS crm_users (
      id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at     timestamptz NOT NULL DEFAULT now(),
      username       text NOT NULL UNIQUE,
      password_hash  text NOT NULL,
      display_name   text
    )
  `;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }

  const SESSION_SECRET = process.env.CRM_SESSION_SECRET || process.env.SESSION_SECRET;
  const cs = connectionString();
  if (!SESSION_SECRET || !cs) {
    return json(500, { ok: false, error: 'Server not configured' });
  }

  const ip = (event.headers['x-nf-client-connection-ip'] || (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown');
  if (rateLimited(ip)) {
    return json(429, { ok: false, error: 'Too many attempts. Please try again later.' });
  }

  const body = readJsonBody(event) || {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return json(200, { ok: false, error: 'Incorrect username or password. Please try again.' });
  }

  const sql = neon(cs);

  try {
    await ensureSchema(sql);

    const rows = await sql`SELECT id, username, password_hash, display_name FROM crm_users WHERE username = ${username} LIMIT 1`;
    const user = rows[0];

    // Always run verifyPassword, even with a placeholder hash, so a
    // nonexistent username doesn't respond measurably faster than a
    // wrong password for a real one (basic timing-attack hygiene).
    const passOk = verifyPassword(password, user ? user.password_hash : 'scrypt:00:00');

    if (!user || !passOk) {
      return json(200, { ok: false, error: 'Incorrect username or password. Please try again.' });
    }

    const token = signSession(user.username, SESSION_SECRET);
    return json(200, { ok: true, user: { username: user.username, display_name: user.display_name || user.username } }, {
      'Set-Cookie': crmSessionCookie(token, CRM_SESSION_TTL_SECONDS),
    });
  } catch (err) {
    console.error('[crm-auth-login] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Could not sign in' });
  }
};
