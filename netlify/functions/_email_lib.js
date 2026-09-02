'use strict';

/*
 * Section K -- optional outbound email, shared by anything that wants to
 * send mail: inquiries.js ("email me a copy of every new inquiry") and,
 * as of Section H's password-reset flow, crm-auth-forgot.js (emailing a
 * reset link to a specific CRM user's own address, not the site owner's).
 *
 * Uses Resend's HTTP API directly over fetch -- no SDK to add as a
 * dependency, and Resend's free tier (100 emails/day, 3,000/month) is
 * more than this site will ever send. sendEmail() requires only
 * RESEND_API_KEY; sendNotification() is the site-owner-specific wrapper
 * used by inquiries.js and additionally requires NOTIFY_EMAIL. Either
 * way, if what's required is missing this just logs and no-ops, the same
 * "optional, degrades cleanly" pattern geo-refresh.js already uses for
 * its build hook -- nothing else depends on this running, and a missing/
 * failed send must never break the thing that triggered it (a form
 * submission, a password-reset request).
 *
 * IMPORTANT sender limitation: Resend's sandbox address
 * (onboarding@resend.dev, the default when NOTIFY_FROM_EMAIL is unset)
 * can only deliver to the email address your own Resend account is
 * registered under -- that's exactly sendNotification()'s use case (site
 * owner notifying themselves), but it means sendEmail() to anyone *else*
 * (e.g. crm-auth-forgot.js emailing a specific CRM user their own reset
 * link) needs a verified sending domain and NOTIFY_FROM_EMAIL set to an
 * address on it -- see Resend's domain verification docs. Until that's
 * set up, sendEmail() to anyone but the account owner will fail (logged,
 * not thrown) and callers must degrade gracefully rather than assume
 * delivery succeeded -- as crm-auth-forgot.js does (same response either
 * way, see its file header).
 */

async function sendEmail(to, subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) {
    console.log('[email] RESEND_API_KEY not set, or no recipient given -- skipping.');
    return false;
  }
  const from = process.env.NOTIFY_FROM_EMAIL || 'Triple Company Website <onboarding@resend.dev>';

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from, to: [to], subject, text }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.error('[email] Resend API returned', res.status, body);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[email] failed to send:', err && err.message);
    return false;
  }
}

function sendNotification(subject, text) {
  const to = process.env.NOTIFY_EMAIL;
  if (!to) {
    console.log('[email] NOTIFY_EMAIL not set -- skipping notification email.');
    return Promise.resolve(false);
  }
  return sendEmail(to, subject, text);
}

module.exports = { sendEmail, sendNotification };
