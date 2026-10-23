'use strict';

/*
 * /admin/analytics sign-in.
 *
 * Analytics is opened with a CRM account marked is_admin -- one username,
 * one password, one reset flow for both apps (owner decision, option C,
 * 2026-10-16). The session is the analytics cookie (tc_session, signed with
 * SESSION_SECRET), so every analytics endpoint keeps checking exactly what
 * it checked before. It carries the account id and its session number for
 * the per-request check in release 2.
 *
 * The old login -- ADMIN_USERNAME and ADMIN_PASSWORD_HASH in Netlify -- is
 * an emergency fallback only. It works when ADMIN_FALLBACK_LOGIN is "on",
 * and does not need the database (that is when it is wanted). Every use is
 * written to auth_events when the database answers, and emailed to the
 * owner.
 *
 * Limits: 10 attempts per IP per 15 minutes, counted in auth_events by
 * Netlify's own client IP; the fallback, which may run without the
 * database, also keeps an in-memory count.
 */

const { neon } = require('@neondatabase/serverless');
const auth = require('./_auth_lib');
const emailLib = require('./_email_lib');
const { safeEqualStr, signSession, sessionCookie, readJsonBody, SESSION_TTL_SECONDS, json } = require('./_lib');

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

// Fallback only: a per-instance count, because the database may be down.
const fallbackAttempts = new Map();
function fallbackLimited(ipH) {
  const now = Date.now();
  const rec = fallbackAttempts.get(ipH);
  if (!rec || rec.resetAt < now) {
    fallbackAttempts.set(ipH, { count: 1, resetAt: now + 15 * 60 * 1000 });
    return false;
  }
  rec.count += 1;
  return rec.count > auth.LIMITS_PER.loginPerIp15;
}

function fallbackEnabled() {
  return String(process.env.ADMIN_FALLBACK_LOGIN || '').trim().toLowerCase() === 'on';
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }
  const reply = (status, body, extra) => json(status, body, { ...auth.NO_STORE, ...(extra || {}) });

  const SESSION_SECRET = process.env.SESSION_SECRET;
  if (!SESSION_SECRET) return reply(500, { ok: false, error: 'Server not configured' });

  const body = readJsonBody(event) || {};
  const username = typeof body.username === 'string' ? body.username.trim().slice(0, 100) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const ipH = auth.ipHash(auth.clientIp(event));
  const cs = connectionString();
  const store = cs ? auth.createStore(neon(cs)) : null;

  // --- Emergency fallback: the old Netlify-settings login, only when switched on.
  const ADMIN_USERNAME = process.env.ADMIN_USERNAME;
  const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;
  if (fallbackEnabled() && ADMIN_USERNAME && ADMIN_PASSWORD_HASH && safeEqualStr(username, ADMIN_USERNAME)) {
    if (fallbackLimited(ipH)) return reply(429, { ok: false, error: 'Too many attempts. Please try again later.' });
    const { ok } = password.length <= 1024 ? await auth.verifyPassword(password, ADMIN_PASSWORD_HASH) : { ok: false };
    if (store) await auth.audit(store, { app: 'admin', event: ok ? 'fallback_login' : 'login_failed', ipHash: ipH, detail: 'fallback' });
    if (!ok) return reply(200, { ok: false, error: WRONG });
    await emailLib.sendNotification(
      'Analytics: emergency fallback sign-in used',
      'Someone signed in to /admin/analytics with the emergency fallback login (ADMIN_FALLBACK_LOGIN is on).\n\n' +
      'If this was you, switch ADMIN_FALLBACK_LOGIN off in Netlify when you are done. If it was not, switch it off now and change the analytics password.',
      { formType: 'auth-alert' }
    );
    const token = signSession(ADMIN_USERNAME, SESSION_SECRET, { fb: 1 });
    return reply(200, { ok: true, user: { username: ADMIN_USERNAME } }, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SECONDS) });
  }

  // --- Normal path: a CRM account marked is_admin.
  if (!store) return reply(503, { ok: false, error: 'Sign-in is temporarily unavailable.' });
  const app = 'admin';
  try {
    const ready = await auth.prepare(store);
    if (!ready.ok) {
      console.error('[auth-login] refused:', ready.reason);
      return reply(503, { ok: false, error: 'Sign-in is temporarily unavailable.' });
    }

    const attempts = await auth.countSafe(store, { app, events: ['login_failed', 'login_succeeded', 'login_throttled'], minutes: 15, ipHash: ipH });
    if (attempts >= auth.LIMITS_PER.loginPerIp15) {
      await auth.audit(store, { app, event: 'login_throttled', ipHash: ipH });
      await auth.maybeAlert(store, emailLib, { app, userId: null });
      return reply(429, { ok: false, error: 'Too many attempts. Please try again later.' });
    }
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
    // The password was right; saying why access is refused tells nobody anything new.
    if (user.is_admin !== true) {
      await auth.audit(store, { app, event: 'login_failed', userId: user.id, ipHash: ipH, detail: 'not_admin' });
      return reply(200, { ok: false, error: 'This account does not have access to analytics.' });
    }
    if (user.must_change_password === true) {
      return reply(200, { ok: false, must_change: true, error: 'Change your password in the CRM first, then sign in here.' });
    }
    if (needsRehash) {
      try {
        await store.rehash({ userId: user.id, oldHash: user.password_hash, newHash: await auth.hashPassword(password) });
      } catch (e) {
        console.error('[auth-login] rehash skipped:', String((e && e.message) || e).slice(0, 120));
      }
    }
    await auth.audit(store, { app, event: 'login_succeeded', userId: user.id, ipHash: ipH });
    const token = signSession(user.username, SESSION_SECRET, { uid: Number(user.id), sv: Number(user.session_version || 1), adm: 1 });
    return reply(200, { ok: true, user: { username: user.username } }, { 'Set-Cookie': sessionCookie(token, SESSION_TTL_SECONDS) });
  } catch (err) {
    console.error('[auth-login] error:', String((err && err.message) || err).slice(0, 200));
    return reply(500, { ok: false, error: 'Could not sign in' });
  }
};
