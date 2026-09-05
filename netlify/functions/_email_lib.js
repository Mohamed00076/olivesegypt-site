'use strict';

/*
 * Section K -- optional outbound email, shared by anything that wants to
 * send mail: inquiries.js ("email me a copy of every new inquiry"),
 * leads.js (gated-guide downloads, off by default -- see its file header),
 * and crm-auth-forgot.js (emailing a reset link to a specific CRM user's
 * own address, not the site owner's).
 *
 * Uses Resend's HTTP API directly over fetch -- no SDK to add as a
 * dependency, and Resend's free tier (100 emails/day, 3,000/month) is
 * more than this site will ever send. sendEmail() requires only
 * RESEND_API_KEY; sendNotification() is the site-owner-specific wrapper
 * and additionally requires NOTIFY_EMAIL. Either way, if what's required
 * is missing this just logs and no-ops, the same "optional, degrades
 * cleanly" pattern geo-refresh.js already uses for its build hook --
 * nothing else depends on this running, and a missing/failed send must
 * never break the thing that triggered it (a form submission, a
 * password-reset request).
 *
 * IMPORTANT sender limitation: Resend's sandbox address
 * (onboarding@resend.dev, the default when NOTIFY_FROM_EMAIL is unset)
 * can only deliver to the email address your own Resend account is
 * registered under. Any send to a different recipient is rejected by the
 * API. Routing notifications to several mailboxes therefore REQUIRES a
 * domain verified in Resend and NOTIFY_FROM_EMAIL set to an address on
 * it -- otherwise every recipient but one silently fails. That failure is
 * now loud in the logs (see logResult) rather than a bare console.error.
 *
 * Environment variables (names only -- never log or commit values):
 *   RESEND_API_KEY      required for any send at all
 *   NOTIFY_EMAIL        recipient(s) for sendNotification(); comma- or
 *                       semicolon-separated for several mailboxes
 *   NOTIFY_FROM_EMAIL   verified sender; see the limitation above
 *   NOTIFY_DRY_RUN      set to 1/true to log what would be sent and send
 *                       nothing -- the staging adapter for testing the
 *                       call path without real delivery
 */

const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

function isDryRun() {
  const v = String(process.env.NOTIFY_DRY_RUN || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

/** NOTIFY_EMAIL may hold several mailboxes, comma- or semicolon-separated. */
function notifyRecipients() {
  return String(process.env.NOTIFY_EMAIL || '')
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/*
 * Logs carry only the provider's message id, the form type and how many
 * mailboxes were addressed. Never the body, never the recipient
 * addresses, never the API key -- an inquiry body contains the buyer's
 * own message and contact details, and function logs are not the place
 * for it.
 */
function logResult(formType, count, ok, id, detail) {
  const tag = `[email] form=${formType} recipients=${count}`;
  if (ok) console.log(`${tag} status=sent message_id=${id || 'unknown'}`);
  else console.error(`${tag} status=failed reason=${detail || 'unknown'}`);
}

async function postToResend(apiKey, payload) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) {
    const data = await res.json().catch(() => ({}));
    return { ok: true, id: data && data.id };
  }
  // Resend puts the reason in the body; it does not echo the API key.
  const body = await res.text().catch(() => '');
  return { ok: false, status: res.status, detail: `${res.status} ${body}`.slice(0, 300) };
}

/**
 * Send one message.
 *
 * @param {string|string[]} to        one address, or several
 * @param {string} subject
 * @param {string} text               plain-text body
 * @param {object} [opts]
 * @param {string} [opts.replyTo]     so replying reaches the enquirer, not the site
 * @param {string} [opts.formType]    label for the log line, e.g. 'inquiry'
 * @returns {Promise<boolean>}        never throws
 */
async function sendEmail(to, subject, text, opts) {
  const options = opts || {};
  const formType = options.formType || 'unspecified';
  const list = (Array.isArray(to) ? to : [to]).map((s) => String(s || '').trim()).filter(Boolean);

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || list.length === 0) {
    console.log(
      `[email] form=${formType} status=skipped reason=${!apiKey ? 'RESEND_API_KEY not set' : 'no recipient'}`
    );
    return false;
  }

  const from = process.env.NOTIFY_FROM_EMAIL || 'Triple Company Website <onboarding@resend.dev>';
  if (!process.env.NOTIFY_FROM_EMAIL && list.length > 1) {
    console.error(
      `[email] form=${formType} WARNING: NOTIFY_FROM_EMAIL is unset, so the Resend sandbox ` +
      `sender is in use. It can only deliver to the Resend account's own address, so ` +
      `${list.length} recipients will not all receive this. Set NOTIFY_FROM_EMAIL to an ` +
      `address on a domain verified in Resend.`
    );
  }

  const payload = { from, to: list, subject, text };
  if (options.replyTo) payload.reply_to = options.replyTo;

  if (isDryRun()) {
    console.log(
      `[email] form=${formType} status=dry-run recipients=${list.length} ` +
      `subject_len=${String(subject || '').length} body_len=${String(text || '').length}`
    );
    return true;
  }

  // One retry, and only for transient conditions. A 4xx (bad sender,
  // unverified domain, malformed address) will fail identically on a
  // second attempt, so retrying it just doubles the latency of a request
  // a visitor is waiting on.
  let last = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await postToResend(apiKey, payload);
      if (result.ok) {
        logResult(formType, list.length, true, result.id);
        return true;
      }
      last = result;
      if (!RETRYABLE_STATUS.has(result.status)) break;
    } catch (err) {
      last = { detail: `network: ${(err && err.message) || 'unknown'}` };
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 400));
  }

  logResult(formType, list.length, false, null, last && last.detail);
  return false;
}

/**
 * Site-owner notification. Recipients come from NOTIFY_EMAIL, which may
 * name several mailboxes.
 */
function sendNotification(subject, text, opts) {
  const to = notifyRecipients();
  const formType = (opts && opts.formType) || 'notification';
  if (to.length === 0) {
    console.log(`[email] form=${formType} status=skipped reason=NOTIFY_EMAIL not set`);
    return Promise.resolve(false);
  }
  return sendEmail(to, subject, text, Object.assign({ formType }, opts));
}

module.exports = { sendEmail, sendNotification, notifyRecipients, isDryRun };
