'use strict';

/*
 * Completes a reset: the token from the emailed link, plus the new password
 * typed twice.
 *
 *   - the token: well-formed, its SHA-256 found unused, uncancelled and
 *     unexpired, compared in constant time; claiming it, changing the
 *     password and cancelling every other open link happen in one statement
 *   - the password: 12 to 128 characters, not common, not built from the
 *     username or the site's words; hashed with today's scrypt settings
 *   - afterwards: every session for the account ends (session_version), a
 *     "password changed" email goes to the account's own address, an audit
 *     row is written, and the visitor is NOT signed in -- they go to sign in
 *   - limit: 10 failed or throttled attempts per IP per 15 minutes
 */

const { neon } = require('@neondatabase/serverless');
const auth = require('./_auth_lib');
const emailLib = require('./_email_lib');
const { reportFailure } = require('./_failure_lib');
const { readJsonBody, json } = require('./_crm_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const INVALID = 'This reset link is invalid, already used or expired. Request a new one.';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }
  const reply = (status, body) => json(status, body, auth.NO_STORE);

  const cs = connectionString();
  if (!cs) return reply(503, { ok: false, error: 'Password reset is temporarily unavailable.' });

  const sql = neon(cs);
  const store = auth.createStore(sql);
  const app = 'crm';

  try {
    const ready = await auth.prepare(store);
    if (!ready.ok) {
      console.error('[crm-auth-reset] refused:', ready.reason);
      return reply(503, { ok: false, error: 'Password reset is temporarily unavailable.' });
    }

    const ipH = auth.ipHash(auth.clientIp(event));
    const recent = await auth.countSafe(store, { app, events: ['reset_failed', 'reset_throttled'], minutes: 15, ipHash: ipH });
    if (recent >= auth.LIMITS_PER.resetPerIp15) {
      await auth.audit(store, { app, event: 'reset_throttled', ipHash: ipH, detail: 'per_ip' });
      await auth.maybeAlert(store, emailLib, { app, userId: null });
      return reply(429, { ok: false, error: 'Too many attempts. Please try again later.' });
    }

    const body = readJsonBody(event) || {};
    const token = typeof body.token === 'string' ? body.token.trim() : '';
    const newPassword = typeof body.new_password === 'string' ? body.new_password : '';
    const confirm = typeof body.confirm_password === 'string' ? body.confirm_password : null;

    if (!auth.wellFormedToken(token)) {
      await auth.audit(store, { app, event: 'reset_failed', ipHash: ipH, detail: 'malformed' });
      return reply(400, { ok: false, error: INVALID });
    }
    const h = auth.tokenHash(token);
    const row = await store.activeReset(h);
    if (!row || !auth.sameHash(row.token_hash, h)) {
      await auth.audit(store, { app, event: 'reset_failed', ipHash: ipH, detail: 'invalid_used_or_expired' });
      await auth.maybeAlert(store, emailLib, { app, userId: null });
      return reply(400, { ok: false, error: INVALID });
    }
    const user = await store.userById(row.user_id);
    if (!user) {
      await auth.audit(store, { app, event: 'reset_failed', ipHash: ipH, detail: 'no_account' });
      return reply(400, { ok: false, error: INVALID });
    }

    // Rule problems keep the link usable, so the person can try again.
    if (confirm === null || confirm !== newPassword) {
      return reply(400, { ok: false, error: 'The two passwords do not match.' });
    }
    const problem = auth.passwordProblem(newPassword, user.username);
    if (problem) return reply(400, { ok: false, error: problem });

    const passwordHash = await auth.hashPassword(newPassword);
    const changed = await store.completeReset({ resetId: row.id, passwordHash });
    if (!changed) {
      await auth.audit(store, { app, event: 'reset_failed', userId: user.id, ipHash: ipH, detail: 'already_claimed' });
      return reply(400, { ok: false, error: INVALID });
    }
    await auth.audit(store, { app, event: 'reset_completed', userId: user.id, ipHash: ipH });
    if (auth.usableEmail(user.email)) {
      await emailLib.sendEmail(user.email.trim(), 'Your olivesegypt.com password was changed', auth.changedEmailText(), { formType: 'password-changed' });
    }
    return reply(200, { ok: true, next: '/crm/login/' });
  } catch (err) {
    console.error('[crm-auth-reset] error:', String((err && err.message) || err).slice(0, 200));
    await reportFailure(sql, { source: 'crm-auth-reset', method: event.httpMethod }, err);
    return reply(500, { ok: false, error: 'Something went wrong. Please try again.' });
  }
};
