'use strict';

/*
 * CRM sign-in.
 *
 *   - limits, counted in auth_events by Netlify's own client IP: 10 sign-in
 *     attempts per IP per 15 minutes, then 429. An account with 10 failures
 *     in 15 minutes is slowed (2 s per attempt), never locked, so nobody can
 *     lock its owner out on purpose
 *   - a username that does not exist costs the same scrypt work as a wrong
 *     password (DUMMY_HASH), and gets the same answer
 *   - an old-format hash is upgraded to today's settings after a successful
 *     sign-in
 *   - the session carries the account id and its session number (raised by
 *     every reset), and "must change password" after an emergency reset; such
 *     a session opens only the change-password page
 */

const { neon } = require('@neondatabase/serverless');
const auth = require('./_auth_lib');
const emailLib = require('./_email_lib');
const { reportFailure } = require('./_failure_lib');
const {
  signCrmSession,
  crmSessionKey,
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

const WRONG = 'Incorrect username or password. Please try again.';

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }
  const reply = (status, body, extra) => json(status, body, { ...auth.NO_STORE, ...(extra || {}) });

  const cs = connectionString();
  if (!crmSessionKey() || !cs) return reply(500, { ok: false, error: 'Server not configured' });

  const sql = neon(cs);
  const store = auth.createStore(sql);
  const app = 'crm';

  try {
    const ready = await auth.prepare(store);
    if (!ready.ok) {
      console.error('[crm-auth-login] refused:', ready.reason);
      return reply(503, { ok: false, error: 'Sign-in is temporarily unavailable.' });
    }

    const ipH = auth.ipHash(auth.clientIp(event));
    const attempts = await auth.countSafe(store, { app, events: ['login_failed', 'login_succeeded', 'login_throttled'], minutes: 15, ipHash: ipH });
    if (attempts >= auth.LIMITS_PER.loginPerIp15) {
      await auth.audit(store, { app, event: 'login_throttled', ipHash: ipH });
      await auth.maybeAlert(store, emailLib, { app, userId: null });
      return reply(429, { ok: false, error: 'Too many attempts. Please try again later.' });
    }

    const body = readJsonBody(event) || {};
    const username = typeof body.username === 'string' ? body.username.trim().slice(0, 100) : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password || password.length > 1024) {
      await auth.audit(store, { app, event: 'login_failed', ipHash: ipH, detail: 'empty_or_oversized' });
      return reply(200, { ok: false, error: WRONG });
    }

    const user = await store.userByUsername(username);
    if (user) {
      const failures = await auth.countSafe(store, { app, events: ['login_failed'], minutes: 15, userId: user.id });
      if (failures >= auth.LIMITS_PER.loginFailuresPerAccount15) await auth.sleep(2000);
    }
    const { ok, needsRehash } = await auth.verifyPassword(password, user ? user.password_hash : auth.DUMMY_HASH);
    if (!user || !ok) {
      await auth.audit(store, { app, event: 'login_failed', userId: user ? user.id : null, ipHash: ipH, detail: user ? null : 'no_account' });
      if (user) await auth.maybeAlert(store, emailLib, { app, userId: user.id });
      return reply(200, { ok: false, error: WRONG });
    }

    if (needsRehash) {
      try {
        await store.rehash({ userId: user.id, oldHash: user.password_hash, newHash: await auth.hashPassword(password) });
      } catch (e) {
        console.error('[crm-auth-login] rehash skipped:', String((e && e.message) || e).slice(0, 120));
      }
    }
    await auth.audit(store, { app, event: 'login_succeeded', userId: user.id, ipHash: ipH });

    const mustChange = user.must_change_password === true;
    const token = signCrmSession(user.username, { uid: Number(user.id), sv: Number(user.session_version || 1), ...(mustChange ? { mc: 1 } : {}) });
    return reply(200, {
      ok: true,
      must_change: mustChange,
      user: { username: user.username, display_name: user.display_name || user.username },
    }, { 'Set-Cookie': crmSessionCookie(token, CRM_SESSION_TTL_SECONDS) });
  } catch (err) {
    console.error('[crm-auth-login] error:', String((err && err.message) || err).slice(0, 200));
    await reportFailure(sql, { source: 'crm-auth-login', method: event.httpMethod }, err);
    return reply(500, { ok: false, error: 'Could not sign in' });
  }
};
