'use strict';

/*
 * Change password while signed in: the current password, then the new one
 * typed twice. The only CRM endpoint a "must change password" session (set
 * by scripts/auth-emergency-reset.js) is allowed to call.
 *
 * Same rules and the same outcome as a reset: today's scrypt settings, every
 * session for the account ends, a "password changed" email, an audit row,
 * and the person signs in again with the new password. 10 failed attempts
 * per IP per 15 minutes, then 429.
 */

const { neon } = require('@neondatabase/serverless');
const auth = require('./_auth_lib');
const emailLib = require('./_email_lib');
const { reportFailure } = require('./_failure_lib');
const { clearCrmSessionCookie, readJsonBody, json } = require('./_crm_lib');
const { currentCrmSession } = require('./_sessions');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }
  const reply = (status, body, extra) => json(status, body, { ...auth.NO_STORE, ...(extra || {}) });

  const session = await currentCrmSession(event, { allowMustChange: true });
  if (!session) return reply(401, { ok: false, error: 'Your session has ended. Please sign in again.' });

  const cs = connectionString();
  if (!cs) return reply(503, { ok: false, error: 'Changing the password is temporarily unavailable.' });

  const sql = neon(cs);
  const store = auth.createStore(sql);
  const app = 'crm';

  try {
    const ready = await auth.prepare(store);
    if (!ready.ok) {
      console.error('[crm-auth-change] refused:', ready.reason);
      return reply(503, { ok: false, error: 'Changing the password is temporarily unavailable.' });
    }

    const ipH = auth.ipHash(auth.clientIp(event));
    const recent = await auth.countSafe(store, { app, events: ['change_failed', 'change_throttled'], minutes: 15, ipHash: ipH });
    if (recent >= auth.LIMITS_PER.changeFailuresPerIp15) {
      await auth.audit(store, { app, event: 'change_throttled', ipHash: ipH });
      await auth.maybeAlert(store, emailLib, { app, userId: null });
      return reply(429, { ok: false, error: 'Too many attempts. Please try again later.' });
    }

    const user = await store.userByUsername(session.sub);
    if (!user) return reply(401, { ok: false, error: 'Your session has ended. Please sign in again.' });

    const body = readJsonBody(event) || {};
    const current = typeof body.current_password === 'string' ? body.current_password : '';
    const next = typeof body.new_password === 'string' ? body.new_password : '';
    const confirm = typeof body.confirm_password === 'string' ? body.confirm_password : null;

    const { ok } = current.length > 0 && current.length <= 1024
      ? await auth.verifyPassword(current, user.password_hash)
      : { ok: false };
    if (!ok) {
      await auth.audit(store, { app, event: 'change_failed', userId: user.id, ipHash: ipH });
      await auth.maybeAlert(store, emailLib, { app, userId: user.id });
      return reply(400, { ok: false, error: 'Your current password is not correct.' });
    }
    if (confirm === null || confirm !== next) return reply(400, { ok: false, error: 'The two new passwords do not match.' });
    if (next === current) return reply(400, { ok: false, error: 'Choose a password different from your current one.' });
    const problem = auth.passwordProblem(next, user.username);
    if (problem) return reply(400, { ok: false, error: problem });

    const passwordHash = await auth.hashPassword(next);
    const changed = await store.changePassword({ userId: user.id, passwordHash });
    if (!changed) return reply(401, { ok: false, error: 'Your session has ended. Please sign in again.' });
    await auth.audit(store, { app, event: 'password_changed', userId: user.id, ipHash: ipH });
    if (auth.usableEmail(user.email)) {
      await emailLib.sendEmail(user.email.trim(), 'Your olivesegypt.com password was changed', auth.changedEmailText(), { formType: 'password-changed' });
    }
    return reply(200, { ok: true, next: '/crm/login/' }, { 'Set-Cookie': clearCrmSessionCookie() });
  } catch (err) {
    console.error('[crm-auth-change] error:', String((err && err.message) || err).slice(0, 200));
    await reportFailure(sql, { source: 'crm-auth-change', method: event.httpMethod }, err);
    return reply(500, { ok: false, error: 'Something went wrong. Please try again.' });
  }
};
