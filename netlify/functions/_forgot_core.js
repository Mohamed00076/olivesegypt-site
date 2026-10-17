'use strict';

/*
 * "Forgot password": emails a single-use reset link to the account's own
 * address. Shared by the CRM and /admin/analytics (one user store).
 *
 * crm-auth-forgot.mjs is the Netlify function (the newer format, so it has
 * context.waitUntil); the work is here, in CommonJS like every other
 * function's, so the tests drive it with the same stand-ins.
 *
 * The answer is the same words, status and headers for every username, and
 * it is sent BEFORE anything about the account is known:
 *
 *   before the answer -- the database guard, the per-IP limits (5 per 15
 *     minutes, 20 per day) and the per-IP counter row (reset_requested,
 *     no account on it), so rapid repeats are counted before they are
 *     answered
 *   after the answer, inside context.waitUntil -- the account lookup, the
 *     per-account limit (3 per hour), the link, the email and the audit
 *
 * So the time to answer cannot tell anyone whether an account exists or has
 * an email on file. Nothing after the answer can reach the caller, so every
 * failure there is recorded in auth_events and reported through the failure
 * alert (crm_failures, and an email to NOTIFY_EMAIL):
 *
 *   - Resend gets its own time limit (8 s, settings.emailTimeoutMs); a
 *     timeout or refusal is reset_not_sent / email_failed
 *   - any other error is reset_not_sent / failed_after_answer
 *   - if the runtime has no waitUntil, the work runs before the answer (no
 *     email is lost) and that is reported, because timing then leaks again
 *
 * The link: 256 random bits; only its SHA-256 is stored; 30 minutes; single
 * use; a new request cancels earlier links. Its address comes from
 * APP_BASE_URL (https), never the request's Host header, and the token
 * travels after '#'. Never sent to a role mailbox (sales@, info@, contact@,
 * admin@, noreply@).
 *
 * scripts/auth-emergency-reset.js remains the backstop when email is down.
 */

const { neon } = require('@neondatabase/serverless');
const auth = require('./_auth_lib');
const emailLib = require('./_email_lib');
const { reportFailure } = require('./_failure_lib');
const { json } = require('./_crm_lib');

const settings = { emailTimeoutMs: 8000 };
const app = 'crm';

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const GENERIC = {
  ok: true,
  message: 'If that account exists and has an email on file, a reset link has been sent to it. The link works once, for 30 minutes.',
};
const UNAVAILABLE = { ok: false, error: 'Password reset is temporarily unavailable.' };

function resetEmailText(link) {
  return [
    'Someone asked to reset the password for your olivesegypt.com account (CRM and analytics).',
    '',
    'To choose a new password, open this link:',
    link,
    '',
    `The link works once and expires in ${auth.RESET_TTL_MINUTES} minutes.`,
    '',
    "If this wasn't you, ignore this email. Your password has not changed.",
  ].join('\n');
}

function parseUsername(text) {
  try {
    const body = JSON.parse(String(text || '').slice(0, 10000));
    return body && typeof body.username === 'string' ? body.username.trim().slice(0, 100) : '';
  } catch {
    return '';
  }
}

// Resend's own abort (opts.timeoutMs) stops the request; this race is the
// backstop, so nothing after the answer can wait on email for ever.
async function sendWithin(ms, send) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(() => resolve({ ok: false, reason: `no answer from the email service within ${ms / 1000} s` }), ms);
  });
  const sent = send().then(
    (ok) => (ok ? { ok: true } : { ok: false, reason: 'the email service refused the message or could not be reached (see the function log)' }),
    (e) => ({ ok: false, reason: `the email service call failed: ${String((e && e.message) || e).slice(0, 120)}` })
  );
  try {
    return await Promise.race([sent, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

// Everything that depends on the account. Runs after the answer; never throws.
async function deliver({ sql, store, username, ipH }) {
  try {
    const user = username ? await store.userByUsername(username) : null;
    if (!user) {
      await auth.audit(store, { app, event: 'reset_not_sent', ipHash: ipH, detail: 'no_account' });
      return;
    }

    const perAccount = await auth.countSafe(store, { app, events: ['reset_sent', 'reset_not_sent'], minutes: 60, userId: user.id });
    if (perAccount >= auth.LIMITS_PER.forgotPerAccountHour) {
      await auth.audit(store, { app, event: 'reset_throttled', userId: user.id, ipHash: ipH, detail: 'per_account' });
      await auth.maybeAlert(store, emailLib, { app, userId: user.id });
      return;
    }

    if (!user.email) {
      await auth.audit(store, { app, event: 'reset_not_sent', userId: user.id, ipHash: ipH, detail: 'no_email' });
      return;
    }
    if (!auth.usableEmail(user.email)) {
      await auth.audit(store, { app, event: 'reset_not_sent', userId: user.id, ipHash: ipH, detail: auth.isRoleMailbox(user.email) ? 'shared_mailbox' : 'invalid_email' });
      return;
    }
    const base = auth.appBaseUrl();
    if (!base) {
      await auth.audit(store, { app, event: 'reset_not_sent', userId: user.id, ipHash: ipH, detail: 'app_base_url_missing_or_not_https' });
      await reportFailure(sql, { source: 'crm-auth-forgot', method: 'POST', step: 'building the reset link' }, new Error('APP_BASE_URL is not set to an https origin; reset email not sent'));
      return;
    }

    const { token, hash } = auth.newResetToken();
    await store.issueResetToken({ userId: user.id, tokenHash: hash, ipHash: ipH, minutes: auth.RESET_TTL_MINUTES });
    const link = `${base}/crm/reset-password/#token=${token}`;
    const outcome = await sendWithin(settings.emailTimeoutMs, () =>
      emailLib.sendEmail(user.email.trim(), 'Reset your olivesegypt.com password', resetEmailText(link), { formType: 'password-reset', timeoutMs: settings.emailTimeoutMs }));
    if (outcome.ok) {
      await auth.audit(store, { app, event: 'reset_sent', userId: user.id, ipHash: ipH });
      return;
    }
    await auth.audit(store, { app, event: 'reset_not_sent', userId: user.id, ipHash: ipH, detail: 'email_failed' });
    await reportFailure(sql, { source: 'crm-auth-forgot', method: 'POST', step: 'sending the reset email' }, new Error(`Reset email to account #${user.id} not sent: ${outcome.reason}`));
  } catch (err) {
    console.error('[crm-auth-forgot] error after the answer:', String((err && err.message) || err).slice(0, 200));
    await auth.audit(store, { app, event: 'reset_not_sent', ipHash: ipH, detail: 'failed_after_answer' });
    await reportFailure(sql, { source: 'crm-auth-forgot', method: 'POST', step: 'after answering a reset request' }, err);
  }
}

/**
 * @param {object} req
 * @param {string} req.method
 * @param {() => Promise<string>} req.readBody
 * @param {object} req.headers      lower-case names
 * @param {string} [req.contextIp]  Netlify's context.ip, used only if its client-IP header is absent
 * @param {(p: Promise) => void} [req.waitUntil]
 * @returns {Promise<{statusCode: number, headers: object, body: string}>}
 */
async function handle({ method, readBody, headers, contextIp, waitUntil }) {
  if (method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }
  const answer = (status, body) => json(status, body, auth.NO_STORE);

  const cs = connectionString();
  if (!cs) return answer(503, UNAVAILABLE);

  const sql = neon(cs);
  const store = auth.createStore(sql);

  try {
    const ready = await auth.prepare(store);
    if (!ready.ok) {
      console.error('[crm-auth-forgot] refused:', ready.reason);
      return answer(503, UNAVAILABLE);
    }

    const username = parseUsername(await readBody());
    // Netlify's own client-IP header, never X-Forwarded-For.
    const fromHeader = auth.clientIp({ headers: headers || {} });
    const ipH = auth.ipHash(fromHeader === 'unknown' && contextIp ? String(contextIp) : fromHeader);

    const ip15 = await auth.countSafe(store, { app, events: ['reset_requested', 'reset_throttled'], minutes: 15, ipHash: ipH });
    const ipDay = await auth.countSafe(store, { app, events: ['reset_requested', 'reset_throttled'], minutes: 1440, ipHash: ipH });
    if (ip15 >= auth.LIMITS_PER.forgotPerIp15 || ipDay >= auth.LIMITS_PER.forgotPerIpDay) {
      await auth.audit(store, { app, event: 'reset_throttled', ipHash: ipH, detail: 'per_ip' });
      await auth.maybeAlert(store, emailLib, { app, userId: null });
      return answer(200, GENERIC);
    }
    await auth.audit(store, { app, event: 'reset_requested', ipHash: ipH });

    const work = { sql, store, username, ipH };
    if (typeof waitUntil === 'function') {
      waitUntil(deliver(work));
    } else {
      await reportFailure(sql, { source: 'crm-auth-forgot', method, step: 'answering a reset request' },
        new Error('context.waitUntil is not available, so the reset email was sent before answering and the answer time can show whether the account exists'));
      await deliver(work);
    }
    return answer(200, GENERIC);
  } catch (err) {
    console.error('[crm-auth-forgot] error:', String((err && err.message) || err).slice(0, 200));
    await reportFailure(sql, { source: 'crm-auth-forgot', method }, err);
    // The same answer: an error must not tell the caller anything about the account.
    return answer(200, GENERIC);
  }
}

module.exports = { handle, settings };
