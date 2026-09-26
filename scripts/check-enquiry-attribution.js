#!/usr/bin/env node
'use strict';

/*
 * An enquiry is linked to the visit that produced it -- and only with consent.
 *
 * Quote and sample requests are written to the inquiries table by the form's
 * POST. Until now that row carried no reference to the analytics session, so
 * no query could say whether an enquiry came from organic search, a referrer
 * or a campaign: the conversion and the traffic source lived in two tables
 * with nothing between them.
 *
 * The link is a session_id on the enquiry. Three properties matter, and two of
 * them are about what must NOT happen:
 *
 *   1. CONSENT. A visitor who declined analytics must not have an analytics
 *      identifier attached to their enquiry. TC.currentSessionId returns null
 *      without consent.
 *   2. NO SIDE EFFECTS. The form must not START tracking. getSession() creates
 *      a session and writes storage; currentSessionId only reads, and returns
 *      null rather than creating one. Checked by running it against spies, not
 *      by reading it.
 *   3. NEVER BLOCKS AN ENQUIRY. The id comes from the browser, so the server
 *      checks its shape -- and drops a bad one rather than refusing the
 *      enquiry. A buyer asking for a quote must get through whether or not
 *      attribution works.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- 1 & 2. the accessor, run for real against spies ---------------------

const analytics = read('assets/analytics.js');
const fnMatch = analytics.match(/TC\.currentSessionId = (function \(\) \{[\s\S]*?\n  \});/);
t('assets/analytics.js defines TC.currentSessionId', !!fnMatch, 'the accessor is missing');

if (fnMatch) {
  const body = fnMatch[1];

  t('   it never calls getSession, which would create a session',
    !/getSession\s*\(/.test(body), 'calling getSession starts tracking as a side effect of a form');
  t('   and never writes to storage',
    !/writeJson\s*\(|localStorage\.setItem/.test(body), 'a read accessor must not write');

  const run = ({ consent, stored, now }) => {
    const writes = [];
    let created = 0;
    const sandbox = {
      TC: { consent: { analytics: consent } },
      SESSION_KEY: 'tc-analytics-session',
      SESSION_TIMEOUT_MS: 30 * 60 * 1000,
      readJson: () => stored,
      writeJson: (k, v) => writes.push([k, v]),
      getSession: () => { created++; return { id: 'minted-by-getSession', lastSeen: now }; },
      Date: { now: () => now },
    };
    vm.createContext(sandbox);
    const fn = vm.runInContext('(' + body + ')', sandbox);
    return { result: fn(), writes, created };
  };

  const NOW = 1_800_000_000_000;
  const live = { id: '0f8fad5b-d9cb-469f-a165-70867728950e', lastSeen: NOW - 60_000 };
  const stale = { id: '0f8fad5b-d9cb-469f-a165-70867728950e', lastSeen: NOW - 31 * 60_000 };

  let r = run({ consent: false, stored: live, now: NOW });
  t('without analytics consent it returns null, even with a live session',
    r.result === null, `returned ${JSON.stringify(r.result)} -- a declined visitor would be tagged`);

  r = run({ consent: true, stored: null, now: NOW });
  t('with consent but no session it returns null rather than making one',
    r.result === null && r.writes.length === 0, JSON.stringify(r));

  r = run({ consent: true, stored: stale, now: NOW });
  t('an expired session is not attributed to today\'s enquiry',
    r.result === null, `returned ${r.result} -- that id belongs to an earlier visit`);

  r = run({ consent: true, stored: live, now: NOW });
  t('with consent and a live session it returns that session',
    r.result === live.id, `returned ${JSON.stringify(r.result)}`);

  const all = [false, true].flatMap((consent) =>
    [null, stale, live].map((stored) => run({ consent, stored, now: NOW })));
  t('and in no case did it write anything',
    all.every((x) => x.writes.length === 0), 'the accessor wrote to storage');
  t('or create a session',
    all.every((x) => x.created === 0), 'the accessor started a session -- the form would begin tracking');
}

// ---- the form sends it, and cannot be broken by it -----------------------

{
  const form = read('assets/inquiry-form.js');
  t('the enquiry form sends session_id',
    /payload\.session_id\s*=/.test(form), 'the form does not attach the session');
  t('   using the read-only accessor, not getSession',
    /TC\.currentSessionId\(\)/.test(form) && !/getSession\(/.test(form),
    'the form must not create a session');
  t('   and guards against analytics.js being blocked or absent',
    /typeof TC\.currentSessionId === 'function'/.test(form),
    'an ad blocker would throw here and the enquiry would never send');
}

// ---- 3. the server stores it, and never refuses an enquiry over it -------

{
  const fn = read('netlify/functions/inquiries.js');
  t('inquiries gains a session_id column, by the existing backfill pattern',
    /ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS session_id text/.test(fn),
    'existing deployments would have no column to write to');
  t('   not a foreign key, because sessions are purged on their own schedule',
    !/session_id[^\n]*REFERENCES/i.test(fn), 'an FK would break or cascade when retention runs');
  t('   and the insert writes it',
    /source_page, session_id\)/.test(fn) && /\$\{sourcePage\}, \$\{sessionId\}\)/.test(fn),
    'the value is validated and then thrown away');

  const helper = fn.match(/(const SESSION_ID_SHAPE = [^\n]+\n[\s\S]*?function sessionIdOrNull\(v\) \{[\s\S]*?\n\})/);
  t('the server has a shape check for the id', !!helper, 'sessionIdOrNull is missing');

  if (helper) {
    const sandbox = {};
    vm.createContext(sandbox);
    vm.runInContext(helper[1] + '\nthis.f = sessionIdOrNull;', sandbox);
    const f = sandbox.f;
    const good = '0F8FAD5B-D9CB-469F-A165-70867728950E';
    t('   a real session id is kept, and normalised to lower case',
      f(good) === good.toLowerCase(), String(f(good)));
    const bad = [null, undefined, '', 42, {}, 'not-a-uuid', "x'; DROP TABLE inquiries;--",
      'a'.repeat(5000), '0f8fad5b-d9cb-469f-a165-70867728950e-extra'];
    t(`   every malformed value becomes null, not an error (${bad.length} tried)`,
      bad.every((v) => { try { return f(v) === null; } catch (e) { return false; } }),
      'a bad id threw or was kept');
  }

  t('   and a bad id can never turn into a refused enquiry',
    !/sessionId[^\n]*errors\.push|errors\.push\([^)]*session/.test(fn),
    'session_id was added to the validation errors -- an enquiry would fail over attribution');
}

const ok = fail === 0;
console.log(
  `\nenquiry-attribution ${ok ? 'OK' : 'FAILED'} -- enquiries carry their session only with consent, ` +
  'never start tracking, and are never refused over it.'
);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(ok ? 0 : 1);
