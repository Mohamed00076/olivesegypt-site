'use strict';

/*
 * Section H -- completes the password reset crm-auth-forgot.js starts:
 * takes the token from the emailed link plus a new password, and if the
 * token is valid, unexpired, and unused, updates that user's
 * password_hash. See crm-auth-forgot.js's file header for the token
 * design (only a SHA-256 hash of it is ever stored).
 *
 * Known, deliberate limitation: this does not invalidate the user's
 * other active sessions. Sessions here are stateless HMAC-signed cookies
 * (verifySession() in _lib.js checks a signature + expiry only, no
 * server-side session table to revoke against) -- adding real
 * revocation would mean a server-side session store for every CRM
 * session, a materially larger change than this reset flow. Documented
 * in the README rather than silently left unmentioned.
 */

const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { hashPassword, readJsonBody, json } = require('./_crm_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const MIN_PASSWORD_LENGTH = 12; // matches scripts/crm-create-user.js's own rule

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
  await sql`
    CREATE TABLE IF NOT EXISTS crm_password_resets (
      id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at   timestamptz NOT NULL DEFAULT now(),
      user_id      bigint NOT NULL,
      token_hash   text NOT NULL UNIQUE,
      expires_at   timestamptz NOT NULL,
      used_at      timestamptz
    )
  `;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });

  const body = readJsonBody(event) || {};
  const token = typeof body.token === 'string' ? body.token.trim() : '';
  const newPassword = typeof body.new_password === 'string' ? body.new_password : '';

  if (!token) {
    return json(400, { ok: false, error: 'Missing or invalid reset link.' });
  }
  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return json(400, { ok: false, error: `Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.` });
  }

  const sql = neon(cs);
  try {
    await ensureSchema(sql);

    const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
    const rows = await sql`
      SELECT id, user_id FROM crm_password_resets
      WHERE token_hash = ${tokenHash} AND used_at IS NULL AND expires_at > now()
      LIMIT 1
    `;
    const reset = rows[0];
    if (!reset) {
      return json(400, { ok: false, error: 'This reset link is invalid or has expired. Request a new one.' });
    }

    const passwordHash = hashPassword(newPassword);
    await sql`UPDATE crm_users SET password_hash = ${passwordHash} WHERE id = ${reset.user_id}`;
    await sql`UPDATE crm_password_resets SET used_at = now() WHERE id = ${reset.id}`;

    return json(200, { ok: true });
  } catch (err) {
    console.error('[crm-auth-reset] error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Could not reset password.' });
  }
};
