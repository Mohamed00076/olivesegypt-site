#!/usr/bin/env node
'use strict';

/*
 * One-off Resend connectivity check.
 *
 * Deliberately goes through netlify/functions/_email_lib.js -- the same code
 * the live forms use -- rather than calling Resend directly. A parallel
 * snippet can succeed while the site still fails; this cannot.
 *
 *   # safe: builds and logs the message, sends nothing, needs no key
 *   NOTIFY_DRY_RUN=1 NOTIFY_EMAIL='you@example.com' node scripts/send-test-email.js
 *
 *   # real send, to whatever NOTIFY_EMAIL holds (comma-separated is fine)
 *   RESEND_API_KEY='re_...' \
 *   NOTIFY_FROM_EMAIL='Triple Company Website <info@olivesegypt.com>' \
 *   NOTIFY_EMAIL='info@olivesegypt.com,sales@olivesegypt.com' \
 *   node scripts/send-test-email.js
 *
 *   # real send, one-off recipient, ignoring NOTIFY_EMAIL
 *   RESEND_API_KEY='re_...' node scripts/send-test-email.js --to you@example.com
 *
 * The key is read from the environment and never written to disk. Do not put
 * it in this file, or in any file: THIS REPOSITORY IS PUBLIC, and a committed
 * key is a leaked key. See docs/email-delivery.md.
 */

const { sendEmail, sendNotification, notifyRecipients, isDryRun } =
  require('../netlify/functions/_email_lib');

function arg(name) {
  const i = process.argv.indexOf(name);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : null;
}

const to = arg('--to');
const key = process.env.RESEND_API_KEY || '';
const from = process.env.NOTIFY_FROM_EMAIL || '';
const dry = isDryRun();

if (key && /^re_x+$/i.test(key)) {
  console.error('RESEND_API_KEY is still the placeholder from the docs. Use the real one.');
  process.exit(1);
}
if (!key && !dry) {
  console.error(
    'No RESEND_API_KEY set.\n' +
    'Either export the real key, or set NOTIFY_DRY_RUN=1 to exercise the path without sending.'
  );
  process.exit(1);
}

const recipients = to ? [to] : notifyRecipients();
if (recipients.length === 0) {
  console.error('No recipient. Set NOTIFY_EMAIL, or pass --to someone@example.com');
  process.exit(1);
}

// The single most common reason a send "works" in a snippet but not on the
// site: Resend's sandbox sender only delivers to the address the Resend
// account itself is registered under. Anything else is rejected.
if (!from) {
  console.warn(
    '\nNOTIFY_FROM_EMAIL is not set, so the Resend sandbox sender ' +
    '(onboarding@resend.dev) will be used.\n' +
    'That can ONLY deliver to your own Resend account address. If this test ' +
    'succeeds to your personal\ninbox but the site still fails, this is why -- ' +
    'verify olivesegypt.com in Resend and set NOTIFY_FROM_EMAIL.\n'
  );
}

const subject = 'olivesegypt.com — Resend connectivity test';
const body = [
  'This is a connectivity test for olivesegypt.com.',
  '',
  'It was sent through netlify/functions/_email_lib.js, the same code path the',
  'contact, sample and quote forms use, so a success here means the real forms',
  'can deliver too.',
  '',
  'Sender:     ' + (from || 'onboarding@resend.dev (Resend sandbox)'),
  'Recipients: ' + recipients.length,
  'Sent at:    ' + new Date().toISOString(),
].join('\n');

(async () => {
  console.log(
    `\nSending${dry ? ' (DRY RUN — nothing leaves the machine)' : ''} to ` +
    `${recipients.length} recipient(s)...\n`
  );

  const ok = to
    ? await sendEmail(recipients, subject, body, { formType: 'connectivity-test' })
    : await sendNotification(subject, body, { formType: 'connectivity-test' });

  console.log('');
  if (ok && dry) {
    console.log('Dry run completed. The call path works; no message was sent.');
  } else if (ok) {
    console.log('Sent. Check the inbox(es) — and the log line above for the message id.');
  } else {
    console.log('Failed. The reason is in the [email] line above.');
    console.log('  422 / "domain is not verified" -> finish domain verification in Resend');
    console.log('  403 / sandbox restriction      -> set NOTIFY_FROM_EMAIL on a verified domain');
    console.log('  401                            -> the API key is wrong or revoked');
  }
  process.exit(ok ? 0 : 1);
})();
