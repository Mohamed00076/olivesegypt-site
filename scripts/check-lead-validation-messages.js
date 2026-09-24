#!/usr/bin/env node
'use strict';

/*
 * A rejected lead form must tell the visitor what to fix.
 *
 * netlify/functions/leads.js answers a bad submission with the exact fields it
 * refused -- {ok:false, error:'Validation failed', fields:['email']}. For a
 * while assets/gated-download.js threw that list away and showed "Something
 * went wrong. Please try again" for every failure, so a buyer who mistyped
 * their address was told the site was broken. They cannot tell the difference,
 * and the likely response to "the site is broken" is to leave.
 *
 * Two things rot here and neither shows up by reading the page:
 *
 *   1. The two locales drift. A field gains an English message and no Arabic
 *      one, and Arabic speakers quietly keep getting the generic wording.
 *   2. leads.js gains a validated field and the client is not told. The new
 *      field silently falls back to generic, which is the original bug again
 *      for that one field.
 *
 * So this reads the real field names out of leads.js rather than keeping a
 * second copy of the list, and holds the two locales against each other.
 *
 * Nothing here is executed: both files are read as text and the message maps
 * are parsed out, because gated-download.js expects a browser.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CLIENT = path.join(ROOT, 'assets/gated-download.js');
const SERVER = path.join(ROOT, 'netlify/functions/leads.js');

// Filled in by the page itself, not by the person at the keyboard. If the
// server rejects one of these the fault is ours, so the generic wording is
// correct and a per-field message would blame the visitor for our bug.
const NOT_THE_VISITORS_FAULT = new Set(['source_page', 'segment']);

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const clientSrc = fs.readFileSync(CLIENT, 'utf8');
const serverSrc = fs.readFileSync(SERVER, 'utf8');

// ---- what the server can actually reject ---------------------------------

const serverFields = [...new Set(
  [...serverSrc.matchAll(/errors\.push\('([a-z_]+)'\)/g)].map((m) => m[1])
)].sort();

t(`leads.js validates a recognisable set of fields (${serverFields.length})`,
  serverFields.length >= 5, serverFields.join(', ') || 'none found -- has the shape changed?');
t('and every one of them is a plain snake_case name',
  serverFields.every((f) => /^[a-z][a-z_]*$/.test(f)), serverFields.join(', '));

// ---- what the client explains, per locale --------------------------------

const localeMaps = {};
for (const lang of ['en', 'ar']) {
  const block = clientSrc.match(
    new RegExp(`${lang}:\\s*\\{[\\s\\S]*?invalid:\\s*\\{([\\s\\S]*?)\\}`, 'm')
  );
  localeMaps[lang] = block
    ? [...block[1].matchAll(/([a-z_]+)\s*:\s*'([^']*)'/g)].map((m) => [m[1], m[2]])
    : null;
}

for (const lang of ['en', 'ar']) {
  const m = localeMaps[lang];
  t(`${lang} has an invalid-field message map`, Array.isArray(m) && m.length > 0,
    'no invalid: {...} block found for this locale');
  if (!m) continue;
  t(`  and every ${lang} message is non-empty`,
    m.every(([, msg]) => msg.trim().length > 0),
    m.filter(([, msg]) => !msg.trim()).map(([k]) => k).join(', '));
}

if (!localeMaps.en || !localeMaps.ar) {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(1);
}

const enKeys = localeMaps.en.map(([k]) => k).sort();
const arKeys = localeMaps.ar.map(([k]) => k).sort();

// ---- the two things that actually rot ------------------------------------

t('the two locales explain exactly the same fields',
  enKeys.join(',') === arKeys.join(','),
  `en: ${enKeys.join(', ')} | ar: ${arKeys.join(', ')}`);

const unexplained = serverFields.filter(
  (f) => !NOT_THE_VISITORS_FAULT.has(f) && !enKeys.includes(f)
);
t('every field the visitor can correct has a message',
  unexplained.length === 0,
  `${unexplained.join(', ')} -- leads.js rejects these and the form would only say "something went wrong"`);

const blamed = enKeys.filter((f) => NOT_THE_VISITORS_FAULT.has(f));
t('and no message blames the visitor for a field the page fills in',
  blamed.length === 0,
  `${blamed.join(', ')} -- these are set by the page, so a rejection is our bug, not theirs`);

const phantom = enKeys.filter((f) => !serverFields.includes(f));
t('no message exists for a field leads.js never returns',
  phantom.length === 0,
  `${phantom.join(', ')} -- dead strings, or leads.js stopped validating them`);

// ---- the wiring, without running the browser code ------------------------

t('the form prefers the field message over the generic one',
  /showStatus\('error',\s*fieldMessage\(result\.data\)\s*\|\|\s*T\.generic\)/.test(clientSrc),
  'the generic message is still shown unconditionally on a rejection');
t('and an unrecognised field name still falls back to generic',
  /var msg = T\.invalid\[data\.fields\[i\]\];\s*\n\s*if \(!msg\) return '';/.test(clientSrc),
  'a new server field would render as undefined rather than fall back');
t('the rate-limit message is still handled separately',
  /T\.rateLimited/.test(clientSrc), 'rate limiting lost its own wording');

const ok = fail === 0;
console.log(
  `\nlead-validation-messages ${ok ? 'OK' : 'FAILED'} -- ${serverFields.length} server field(s), ` +
  `${enKeys.length} explained in 2 locale(s), ${[...NOT_THE_VISITORS_FAULT].length} generic by design.`
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
