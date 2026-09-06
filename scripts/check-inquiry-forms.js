#!/usr/bin/env node
'use strict';

/*
 * The two inquiry forms must actually be wired to something.
 *
 *   node scripts/check-inquiry-forms.js        (part of `npm test`)
 *
 * On 2026-09-06 the English /contact and /sample forms were found to have no
 * submit handler at all. Their markup was complete -- every field, every id,
 * the honeypot, the status element, the submit button -- and no script was
 * ever bound to them. The <form> carries no action, so pressing Send did a
 * default submission that reloaded the page and discarded everything the
 * buyer had typed: no POST, no error, no trace anywhere. The Arabic pages
 * carried a working copy of the handler inline; the English pages had never
 * had one, which is why nothing showed it -- the Arabic side always looked
 * fine.
 *
 * That is the most expensive kind of bug this site can have, and it was
 * invisible to every check that existed. So:
 *
 *   - every inquiry page loads the shared handler
 *   - no page keeps a second, inline copy of it (two handlers = two rows per
 *     submission, which is how the drift started)
 *   - the ids the handler looks up all exist on the page that claims to use it
 *   - the honeypot is off-screen on the correct side for the writing direction
 *   - the Part F intents are a closed set, in the handler and in the links
 *
 * This is a static check. The behaviour itself -- that a filled form produces
 * exactly one POST carrying the right request_type -- is exercised in a real
 * browser; see docs/ for the run. A static check cannot prove a form submits,
 * only that nothing obvious is missing.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const problems = [];

const HANDLER = 'assets/inquiry-form.js';
const js = fs.readFileSync(path.join(ROOT, HANDLER), 'utf8');

// the intents the handler will accept; anything else falls back to the default
const INTENTS = [...js.matchAll(/^\s{4}([a-z_]+): '([^']+)'/gm)].map((m) => m[1]);

const PAGES = [
  { file: 'contact/index.html', prefix: 'contact', dir: 'ltr' },
  { file: 'ar/contact/index.html', prefix: 'contact', dir: 'rtl' },
  { file: 'sample/index.html', prefix: 'sample', dir: 'ltr' },
  { file: 'ar/sample/index.html', prefix: 'sample', dir: 'rtl' },
];

// Every id the shared handler reads, per form. If one of these is renamed on a
// page the handler silently sends an empty string for it.
const IDS = {
  contact: ['contact-form', 'contact-form-status', 'contact-submit-btn', 'contact-website',
            'contact-name', 'contact-email', 'contact-company', 'contact-country',
            'contact-phone', 'contact-product', 'contact-volume', 'contact-message'],
  sample: ['sample-form', 'sample-form-status', 'sample-submit-btn', 'sample-website',
           'sample-name', 'sample-email', 'sample-company', 'sample-country',
           'sample-phone', 'sample-product', 'sample-shipping', 'sample-notes'],
};

for (const { file, prefix, dir } of PAGES) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');

  // ---- the handler is loaded -------------------------------------------
  if (!html.includes(`src="/${HANDLER}"`)) {
    problems.push(`${file}: does not load /${HANDLER} -- this form submits nowhere`);
  }

  // ---- and nothing else handles the same form --------------------------
  //
  // An inline copy alongside the shared one means every submission is sent
  // twice and stored twice.
  if (/fetch\(\s*['"]\/api\/inquiries['"]/.test(html)) {
    problems.push(`${file}: still contains an inline POST to /api/inquiries as well as the shared handler`);
  }

  // ---- a form with no action needs a handler; say so out loud ----------
  const form = (html.match(new RegExp(`<form[^>]*id="${prefix}-form"[^>]*>`)) || [])[0];
  if (!form) {
    problems.push(`${file}: no <form id="${prefix}-form">`);
  } else if (/\baction=/.test(form)) {
    problems.push(`${file}: the form has an action attribute; the handler calls preventDefault and posts JSON`);
  }

  // ---- every id the handler reads exists -------------------------------
  const missing = IDS[prefix].filter((id) => !html.includes(`id="${id}"`));
  if (missing.length) {
    problems.push(`${file}: the handler reads ids that are not on this page: ${missing.join(', ')}`);
  }

  // ---- the honeypot is off-screen, on the correct side -----------------
  //
  // left:-9999px on an RTL page pushes the field into view instead of out of
  // it, which turns an anti-spam field into a visible one a real buyer can
  // fill in by accident -- and filling it silently discards their enquiry.
  const hp = html.slice(Math.max(0, html.indexOf(`id="${prefix}-website"`) - 400),
                       html.indexOf(`id="${prefix}-website"`) + 200);
  const want = dir === 'rtl' ? 'right:-9999px' : 'left:-9999px';
  const wrong = dir === 'rtl' ? 'left:-9999px' : 'right:-9999px';
  if (!hp.includes(want)) {
    problems.push(`${file}: the honeypot is not positioned with ${want}`);
  }
  if (hp.includes(wrong)) {
    problems.push(`${file}: the honeypot uses ${wrong} on a ${dir} page, which pushes it into view`);
  }
}

// ---- Part F: every intent link points at an intent the handler knows ----
const LINKED = new Set();
for (const file of ['contact/index.html', 'ar/contact/index.html']) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  for (const m of html.matchAll(/href="[^"]*\?intent=([a-z_]+)"/g)) {
    LINKED.add(m[1]);
    if (!INTENTS.includes(m[1])) {
      problems.push(`${file}: links to ?intent=${m[1]}, which the handler does not recognise ` +
                    `-- it would silently fall back to the default`);
    }
  }
  // the badge must carry a label for every intent, or arriving with one shows nothing
  const badge = (html.match(/<p class="tc-intent-badge"[^>]*>/) || [])[0];
  if (!badge) {
    problems.push(`${file}: no intent badge, so a visitor is never told how their enquiry was labelled`);
  } else {
    const missing = INTENTS.filter((i) => !badge.includes(`data-intent-${i}=`));
    if (missing.length) problems.push(`${file}: the intent badge has no label for ${missing.join(', ')}`);
  }
}

// ---- the consent banner speaks the page's language ----------------------
//
// assets/consent.js contained no Arabic at all and never read the page
// language, so every Arabic visitor was asked for analytics consent in
// English. Consent someone cannot read is not meaningfully given, so this is
// a compliance problem, not a cosmetic one.
{
  const consent = fs.readFileSync(path.join(ROOT, 'assets/consent.js'), 'utf8');
  const arabic = [...consent].filter((c) => c >= '\u0600' && c <= '\u06FF').length;

  if (!/documentElement\.lang/.test(consent)) {
    problems.push('assets/consent.js never reads the page language, so it cannot localise itself');
  }
  if (arabic < 100) {
    problems.push(`assets/consent.js carries only ${arabic} Arabic characters; the Arabic strings are missing`);
  }
  // both privacy destinations must exist, or one locale is sent to the other's page
  for (const href of ["'/privacy'", "'/ar/privacy'"]) {
    if (!consent.includes(href)) {
      problems.push(`assets/consent.js has no ${href} privacy link, so one locale points at the other's page`);
    }
  }
  // the reopen pill is pinned to a corner; a physical property puts it in the
  // wrong one under rtl
  if (/#tc-consent-reopen\{position:fixed;left:/.test(consent)) {
    problems.push('the consent reopen control uses a physical left offset, which is the wrong corner under rtl');
  }
}

if (INTENTS.length === 0) {
  problems.push(`${HANDLER}: no intents parsed -- this check would pass vacuously`);
}

if (problems.length === 0) {
  console.log(
    `inquiry-forms OK -- all ${PAGES.length} inquiry pages load the one shared handler, none keeps a ` +
    `second inline copy, every id it reads exists, each honeypot is off-screen on the correct side, ` +
    `and all ${INTENTS.length} Part F intents resolve. Linked from /contact: ${[...LINKED].sort().join(', ')}.`
  );
  process.exit(0);
}
console.error(`inquiry-forms FAILED -- ${problems.length} problem(s):\n`);
problems.forEach((p) => console.error('  ' + p));
process.exit(1);
