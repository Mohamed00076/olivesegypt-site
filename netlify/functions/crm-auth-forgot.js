'use strict';

/*
 * Section H -- self-service "forgot password" for CRM users. Previously
 * the only way to reset a CRM password was scripts/crm-create-user.js,
 * which requires direct DATABASE_URL access -- fine for the one person
 * running this project today, but a real gap for any real multi-user
 * CRM (a locked-out staff member shouldn't need a developer to get back
 * in). That script still works and still needs no email setup, so it
 * stays as the always-available fallback; this is the self-service path
 * on top of it.
 *
 * Deliberately never reveals whether a username exists or has a
 * recovery email set -- the response is identical either way, to avoid
 * turning this endpoint into a way to enumerate valid CRM usernames.
 *
 * The token itself is never stored -- only its SHA-256 hash
 * (crm_password_resets.token_hash), the same "don't store the credential
 * itself" discipline this codebase already applies to session tokens and
 * passwords elsewhere. A raw token that only ever exists in the emailed
 * link and the requester's browser can't be replayed from a database
 * breach the way a stored plaintext token could.
 */

const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');
const { readJsonBody, json } = require('./_crm_lib');
const { sendEmail } = require('./_email_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const RESET_TTL_MINUTES = 60;

const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

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
  // Table may already exist from before this column was added.
  await sql`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS email text`;
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

function siteUrl() {
  // Netlify sets URL to the site's real production origin, and
  // DEPLOY_PRIME_URL to the deploy-preview origin when this is running
  // as one -- preferring URL when set means a real reset link either
  // way, not always the production domain regardless of context.
  return process.env.URL || process.env.DEPLOY_PRIME_URL || 'https://olivesegypt.com';
}

function resetEmailText(link) {
  return [
    'A password reset was requested for your Triple Company CRM account.',
    '',
    'Reset your password: ' + link,
    '',
    `This link expires in ${RESET_TTL_MINUTES} minutes and can only be used once.`,
    '',
    "If you didn't request this, you can ignore this email -- your password hasn't changed.",
  ].join('\n');
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }

  const cs = connectionString();
  if (!cs) return json(500, { ok: false, error: 'Server not configured' });

  const ip = event.headers['x-nf-client-connection-ip'] || (event.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  if (rateLimited(ip)) {
    return json(429, { ok: false, error: 'Too many requests. Please try again later.' });
  }

  const body = readJsonBody(event) || {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';

  // Same response whether or not this leads anywhere -- see file header.
  const genericOk = { ok: true, message: 'If that account exists and has a recovery email on file, a reset link has been sent to it.' };
  if (!username) return json(200, genericOk);

  const sql = neon(cs);
  try {
    await ensureSchema(sql);

    const rows = await sql`SELECT id, email FROM crm_users WHERE username = ${username} LIMIT 1`;
    const user = rows[0];
    if (user && user.email) {
      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(token, 'utf8').digest('hex');
      const expiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60 * 1000).toISOString();

      await sql`
        INSERT INTO crm_password_resets (user_id, token_hash, expires_at)
        VALUES (${user.id}, ${tokenHash}, ${expiresAt})
      `;

      const link = `${siteUrl()}/crm/reset-password/?token=${token}`;
      // Best-effort -- a failed/unconfigured send still returns the same
      // generic response; scripts/crm-create-user.js remains the
      // always-available fallback if email delivery isn't set up.
      await sendEmail(user.email, 'Reset your Triple Company CRM password', resetEmailText(link)).catch(() => {});
    }
  } catch (err) {
    console.error('[crm-auth-forgot] error:', err?.message ?? err);
    // Still return the generic response -- an error here must not leak
    // "that username doesn't exist" vs. "something broke" to the caller.
  }

  return json(200, genericOk);
};
