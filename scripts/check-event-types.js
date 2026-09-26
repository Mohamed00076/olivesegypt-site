#!/usr/bin/env node
'use strict';

/*
 * Every event the site fires must be one the collector accepts.
 *
 * assets/analytics.js sends events to /api/analytics-collect through
 * TC.logEvent. The collector refuses any event_type outside EVENT_TYPES with a
 * 400. facebook_click was fired on every click of the Facebook button and
 * refused every time, because it was never added to the set -- and nobody
 * noticed, because logEvent is fire-and-forget and a rejected beacon makes no
 * sound.
 *
 * The two lists live in different files, one in the browser and one in a
 * function, and nothing connected them. This does.
 *
 * The other direction is checked too, more gently. A type the collector
 * accepts but nothing fires is not a failure on its own -- it may be waiting
 * for a feature -- but it has to be named with a reason, because an accepted
 * type that silently never arrives is how contact_form_submit came to sit in
 * the funnel definitions measuring nothing.
 *
 * The real set is required from _analytics_lib.js rather than restated here.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const { EVENT_TYPES } = require(path.join(ROOT, 'netlify/functions/_analytics_lib.js'));

// Accepted by the collector but fired by nothing, each with the reason why.
const ACCEPTED_NOT_FIRED = new Map([
  ['contact_form_submit',
    'Referenced by the funnel definitions but fired by no page. The enquiry forms post to /api/inquiries, which records the submission in its own table and emits no analytics event. Found in the 2026-09-26 attribution check; attributing enquiries is being done by linking the enquiry to its analytics session instead.'],
]);

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- what the client fires ------------------------------------------------

function walk(dir, out) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'scripts') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else if (/\.(js|html)$/.test(e.name)) out.push(full);
  }
  return out;
}

const fired = new Map();   // type -> [file:line, ...]
for (const file of walk(ROOT, [])) {
  if (file.includes(`${path.sep}netlify${path.sep}`)) continue;  // server code does not fire
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const m of line.matchAll(/logEvent\(\s*'([a-z_]+)'/g)) {
      const where = `${path.relative(ROOT, file)}:${i + 1}`;
      if (!fired.has(m[1])) fired.set(m[1], []);
      fired.get(m[1]).push(where);
    }
  });
}

t(`the client fires events at all (${fired.size} types)`, fired.size >= 3,
  'found almost nothing -- has logEvent been renamed?');
t('the collector exposes its accepted set', EVENT_TYPES instanceof Set && EVENT_TYPES.size > 0,
  'EVENT_TYPES is not exported from _analytics_lib.js');

// ---- every fired type is accepted -----------------------------------------

const refused = [...fired.keys()].filter((type) => !EVENT_TYPES.has(type));
t('every event the site fires is one the collector accepts',
  refused.length === 0,
  refused.map((type) => `${type} (fired at ${fired.get(type)[0]}) is refused with a 400`).join('; '));

for (const type of [...fired.keys()].sort()) {
  t(`   ${type}`, EVENT_TYPES.has(type), `fired at ${fired.get(type).join(', ')} but not in EVENT_TYPES`);
}

// ---- every accepted type is fired, or named with a reason -----------------

const silent = [...EVENT_TYPES].filter((type) => !fired.has(type) && !ACCEPTED_NOT_FIRED.has(type));
t('every accepted type is either fired or named with a reason',
  silent.length === 0,
  `${silent.join(', ')} -- accepted but never sent; fire it, or add it to ACCEPTED_NOT_FIRED with a reason`);

const stale = [...ACCEPTED_NOT_FIRED.keys()].filter((type) => fired.has(type) || !EVENT_TYPES.has(type));
t('and no exemption is stale',
  stale.length === 0,
  `${stale.join(', ')} -- now fired or no longer accepted; remove it from ACCEPTED_NOT_FIRED`);

t('every exemption carries a real reason',
  [...ACCEPTED_NOT_FIRED.values()].every((why) => why.length > 60),
  'an exemption without a reason is just a hole');

const ok = fail === 0;
console.log(
  `\nevent-types ${ok ? 'OK' : 'FAILED'} -- ${fired.size} fired, ${EVENT_TYPES.size} accepted, ` +
  `${ACCEPTED_NOT_FIRED.size} accepted-but-idle named with a reason.`
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
