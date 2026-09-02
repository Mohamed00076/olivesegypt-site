'use strict';

/*
 * Section K -- optional outbound email notifications, shared by anything
 * that wants to email the site owner (currently just inquiries.js, "email
 * me a copy of every new inquiry").
 *
 * Uses Resend's HTTP API directly over fetch -- no SDK to add as a
 * dependency, and Resend's free tier (100 emails/day, 3,000/month) is
 * more than this site will ever send. Requires RESEND_API_KEY and
 * NOTIFY_EMAIL to both be set in Netlify's environment variables; if
 * either is missing this just logs and no-ops, the same "optional,
 * degrades cleanly" pattern geo-refresh.js already uses for its build
 * hook -- nothing else depends on this running, and a missing/failed send
 * must never break the thing that triggered it (a form submission).
 *
 * No domain verification needed for the default sender: Resend's own
 * sandbox address (onboarding@resend.dev) is allowed to send to the
 * account's own registered email without any DNS setup at all -- which is
 * exactly this use case (notifying the site owner at their own address).
 * If you later want a "from" address on your own domain, verify it in
 * Resend and set NOTIFY_FROM_EMAIL.
 */

async function sendNotification(subject, text) {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.NOTIFY_EMAIL;
  if (!apiKey || !to) {
    console.log('[email] RESEND_API_KEY or NOTIFY_EMAIL not set -- skipping notification email.');
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

module.exports = { sendNotification };
