'use strict';

/*
 * "Forgot password": emails a single-use reset link to the account's own
 * address. Shared by the CRM and /admin/analytics (one user store).
 *
 * The answer never tells the caller anything about the account: the same
 * status, the same words and about the same time (auth.padTo) whether the
 * username exists, has no email, has a shared mailbox, or was throttled.
 *
 *   - the link: 256 random bits; only its SHA-256 is stored; 30 minutes;
 *     single use; a new request cancels earlier links
 *   - its address: APP_BASE_URL (https), never the request's Host header;
 *     the token travels after '#', so it never reaches a server log
 *   - recipient: the account's own email only, never a role mailbox
 *     (sales@, info@, contact@, admin@, noreply@)
 *   - limits: 5 requests per IP per 15 minutes and 20 per day; 3 per account
 *     per hour -- counted in auth_events, so they hold across servers
 *   - audit: requested / throttled / not sent and why; never the token
 *
 * scripts/auth-emergency-reset.js remains the backstop when email is down.
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

const GENERIC = {
  ok: true,
  message: 'If that account exists and has an email on file, a reset link has been sent to it. The link works once, for 30 minutes.',
};

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

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }
  const startedAt = Date.now();
  const answer = async (status, body) => {
    await auth.padTo(startedAt);
    return json(status, body, auth.NO_STORE);
  };

  const cs = connectionString();
  if (!cs) return answer(503, { ok: false, error: 'Password reset is temporarily unavailable.' });

  const sql = neon(cs);
  const store = auth.createStore(sql);
  const app = 'crm';

  try {
    const ready = await auth.prepare(store);
    if (!ready.ok) {
      console.error('[crm-auth-forgot] refused:', ready.reason);
      return answer(503, { ok: false, error: 'Password reset is temporarily unavailable.' });
    }

    const body = readJsonBody(event) || {};
    const username = typeof body.username === 'string' ? body.username.trim().slice(0, 100) : '';
    const ipH = auth.ipHash(auth.clientIp(event));

    const ip15 = await auth.countSafe(store, { app, events: ['reset_requested', 'reset_throttled'], minutes: 15, ipHash: ipH });
    const ipDay = await auth.countSafe(store, { app, events: ['reset_requested', 'reset_throttled'], minutes: 1440, ipHash: ipH });
    if (ip15 >= auth.LIMITS_PER.forgotPerIp15 || ipDay >= auth.LIMITS_PER.forgotPerIpDay) {
      await auth.audit(store, { app, event: 'reset_throttled', ipHash: ipH, detail: 'per_ip' });
      await auth.maybeAlert(store, emailLib, { app, userId: null });
      return answer(200, GENERIC);
    }

    const user = username ? await store.userByUsername(username) : null;
    await auth.audit(store, { app, event: 'reset_requested', userId: user ? user.id : null, ipHash: ipH, detail: user ? null : 'no_account' });
    if (!user) return answer(200, GENERIC);

    const perAccount = await auth.countSafe(store, { app, events: ['reset_requested'], minutes: 60, userId: user.id });
    if (perAccount > auth.LIMITS_PER.forgotPerAccountHour) {
      await auth.audit(store, { app, event: 'reset_throttled', userId: user.id, ipHash: ipH, detail: 'per_account' });
      await auth.maybeAlert(store, emailLib, { app, userId: user.id });
      return answer(200, GENERIC);
    }

    if (!user.email) {
      await auth.audit(store, { app, event: 'reset_not_sent', userId: user.id, ipHash: ipH, detail: 'no_email' });
      return answer(200, GENERIC);
    }
    if (!auth.usableEmail(user.email)) {
      await auth.audit(store, { app, event: 'reset_not_sent', userId: user.id, ipHash: ipH, detail: auth.isRoleMailbox(user.email) ? 'shared_mailbox' : 'invalid_email' });
      return answer(200, GENERIC);
    }
    const base = auth.appBaseUrl();
    if (!base) {
      await auth.audit(store, { app, event: 'reset_not_sent', userId: user.id, ipHash: ipH, detail: 'app_base_url_missing_or_not_https' });
      await reportFailure(sql, { source: 'crm-auth-forgot', method: event.httpMethod }, new Error('APP_BASE_URL is not set to an https origin; reset email not sent'));
      return answer(200, GENERIC);
    }

    const { token, hash } = auth.newResetToken();
    await store.issueResetToken({ userId: user.id, tokenHash: hash, ipHash: ipH, minutes: auth.RESET_TTL_MINUTES });
    const link = `${base}/crm/reset-password/#token=${token}`;
    const sent = await emailLib.sendEmail(user.email.trim(), 'Reset your olivesegypt.com password', resetEmailText(link), { formType: 'password-reset' });
    if (!sent) await auth.audit(store, { app, event: 'reset_not_sent', userId: user.id, ipHash: ipH, detail: 'email_failed' });
    return answer(200, GENERIC);
  } catch (err) {
    console.error('[crm-auth-forgot] error:', String((err && err.message) || err).slice(0, 200));
    await reportFailure(sql, { source: 'crm-auth-forgot', method: event.httpMethod }, err);
    // The same answer: an error must not tell the caller anything about the account.
    return answer(200, GENERIC);
  }
};
