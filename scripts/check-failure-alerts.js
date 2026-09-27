#!/usr/bin/env node
'use strict';

/*
 * A failed CRM operation reaches a person, not only the log.
 *
 *   node scripts/check-failure-alerts.js        (part of `npm test`)
 *
 * Every CRM function wrote failures to Netlify's function log and nothing
 * else. Nobody reads that log unprompted -- eighteen broken calls ran from
 * 2026-09-01 to 2026-09-24, every one of them logged. _failure_lib.js adds a
 * dashboard record and a throttled email; this holds the code to it.
 *
 *   - Every error handler that logs a failure also reports it -- found by
 *     scanning, not from a list, so a new function cannot skip it quietly.
 *   - Reporting records the failure, emails once per throttle window, strips
 *     connection strings, and never throws -- including when the database is
 *     the thing that is down, where it must still email and say it could not
 *     record.
 *   - A handler's response to the user is unchanged by the reporting.
 *   - The dashboard shows recent failures, escaped.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

// ---- 1. every logging error handler reports ---------------------------------

// Handlers that log without reporting, by name and with a reason.
const NOT_REPORTED = {
  'inquiries.js [inquiries] could not record the intake failure':
    'the intake failure itself was just reported; this is the note-writing after it',
  'inquiries.js [inquiries] notification email failed':
    'a failed email is not reported by email -- that would loop',
  'leads.js [leads] notification email failed':
    'a failed email is not reported by email -- that would loop',
  'crm-dashboard.js [crm-dashboard] could not read recent failures':
    'reporting it would write to the very table that just failed to be read',
};

function catchBlocks(src) {
  const out = [];
  const re = /\} catch \((\w+)\) \{/g;
  let m;
  while ((m = re.exec(src))) {
    let depth = 1, i = m.index + m[0].length;
    for (; i < src.length && depth > 0; i++) {
      const c = src[i];
      if (c === "'" || c === '"' || c === '`') { for (i++; i < src.length && src[i] !== c; i++) if (src[i] === '\\') i++; continue; }
      if (c === '{') depth++; else if (c === '}') depth--;
    }
    out.push({ at: m.index, body: src.slice(m.index + m[0].length, i - 1) });
  }
  return out;
}

const files = fs.readdirSync(FN).filter((f) => /^(crm-.*|inquiries|leads)\.js$/.test(f)).sort();
let examined = 0;
for (const f of files) {
  const src = fs.readFileSync(path.join(FN, f), 'utf8');
  for (const b of catchBlocks(src)) {
    // Single-quoted or template-literal log lines alike: two functions use the latter.
    const tag = (b.body.match(/console\.error\(\s*['`](\[[^\]]+\][^:'`]*)/) || [])[1];
    if (!tag) continue;                      // not a logged failure
    examined++;
    const line = src.slice(0, b.at).split('\n').length;
    const key = `${f} ${tag.trim()}`;
    if (NOT_REPORTED[key]) { t(`${f}:${line} "${tag.trim()}" -- not reported: ${NOT_REPORTED[key]}`, true); continue; }
    t(`${f}:${line} "${tag.trim()}" is reported, not only logged`, /await reportFailure\(sql, \{ source: '[\w-]+'/.test(b.body),
      'logs to Netlify and tells nobody');
  }
}
t(`every logging error handler in the CRM, enquiry and lead functions was examined (${examined})`, examined >= 17, examined);
// Named, so a scanner that silently stops seeing a function fails rather than passing.
for (const f of files) {
  const src = fs.readFileSync(path.join(FN, f), 'utf8');
  if (!/console\.error/.test(src)) continue;
  t(`   ${f} was among them`, catchBlocks(src).some((b) => /console\.error\(\s*['`]\[/.test(b.body)), 'the scan found no logging handler in it');
}

// ---- 2. reportFailure itself ----------------------------------------------------

process.env.NOTIFY_EMAIL = 'owner@example.com';
process.env.NOTIFY_DRY_RUN = '1';
const emails = [];
const origLog = console.log, origErr = console.error;
const quiet = (fn) => async (...a) => {
  console.log = (...m) => { const s = m.join(' '); if (/^\[email\] form=failure-alert/.test(s)) emails.push(s); };
  console.error = () => {};
  try { return await fn(...a); } finally { console.log = origLog; console.error = origErr; }
};

const lib = require(path.join(FN, '_failure_lib.js'));

(async () => {
  const writes = [];
  const goodSql = (s, ...v) => { const q = s.join('?'); writes.push({ q, v }); return Promise.resolve([]); };

  lib._resetThrottle(); emails.length = 0;
  const err = Object.assign(new Error('Server error (HTTP status 500): upstream; dsn postgresql://user:secret@ep-x.neon.tech/db'), {});
  const recorded = await quiet(lib.reportFailure)(goodSql, { source: 'crm-buyers', method: 'PATCH', step: 'moving a card', actor: 'staff' }, err);
  const ins = writes.find((w) => /INSERT INTO crm_failures/.test(w.q));
  t('a failure is recorded for the dashboard', recorded === true && !!ins, JSON.stringify(writes.map((w) => w.q.slice(0, 40))));
  t('   with where, what and who', ins && ins.v[0] === 'crm-buyers' && ins.v[1] === 'PATCH' && ins.v[2] === 'moving a card' && ins.v[5] === 'staff', ins && JSON.stringify(ins.v));
  t('   and no connection string, even when the error contains one',
    ins && !/secret|postgresql:\/\//.test(ins.v[4]) && /\[connection string removed\]/.test(ins.v[4]), ins && ins.v[4]);
  t('   old failures are trimmed (kept 90 days)', writes.some((w) => /DELETE FROM crm_failures WHERE occurred_at < now\(\)/.test(w.q)));
  t('and an alert email is sent', emails.length === 1, emails.join(' | '));

  await quiet(lib.reportFailure)(goodSql, { source: 'crm-buyers', method: 'PATCH' }, new Error('again'));
  await quiet(lib.reportFailure)(goodSql, { source: 'crm-buyers', method: 'PATCH' }, new Error('and again'));
  t('an outage does not flood the inbox: one email per 15 minutes per server', emails.length === 1, emails.length);

  lib._resetThrottle(); emails.length = 0;
  const downSql = () => Promise.reject(Object.assign(new Error('Error connecting to database: fetch failed'), {}));
  let threw = false, rec2;
  try { rec2 = await quiet(lib.reportFailure)(downSql, { source: 'crm-buyers', method: 'PATCH' }, new Error('Error connecting to database: fetch failed')); } catch (e) { threw = true; }
  t('when the database itself is down, reporting does not throw', !threw);
  t('   it cannot record, and says so', rec2 === false);
  t('   but still emails -- the one channel that does not need the database', emails.length === 1, emails.length);

  // ---- 3. a real handler: the response is unchanged ------------------------------
  const SECRET = 'test-secret-not-a-real-one';
  process.env.DATABASE_URL = 'postgres://stub';
  process.env.CRM_SESSION_SECRET = SECRET;
  const hwrites = [];
  const failingSql = (s, ...v) => {
    const q = Array.isArray(s) ? s.join('?') : String(s);
    hwrites.push(q);
    if (/crm_failures/.test(q)) return Promise.resolve([]);
    return Promise.reject(new Error('Server error (HTTP status 500): upstream compute unavailable'));
  };
  const neonId = require.resolve('@neondatabase/serverless');
  require.cache[neonId] = new Module(neonId, null);
  Object.assign(require.cache[neonId], { filename: neonId, loaded: true, exports: { neon: () => failingSql } });
  const { signSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
  const cookie = `${CRM_COOKIE_NAME}=${signSession('staff', SECRET)}`;
  lib._resetThrottle(); emails.length = 0;
  const res = await quiet(require(path.join(FN, 'crm-buyers.js')).handler)({
    httpMethod: 'PATCH', headers: { cookie }, queryStringParameters: { id: '1' }, body: '{"current_stage":"Contacted"}' });
  const body = JSON.parse(res.body);
  t('a failing CRM request still answers the user exactly as before', res.statusCode === 500 && body.ok === false && /could not be reached/.test(body.error), res.body);
  t('   and the failure was recorded and emailed', hwrites.some((q) => /INSERT INTO crm_failures/.test(q)) && emails.length === 1, JSON.stringify({ e: emails.length }));

  // ---- 4. the dashboard ------------------------------------------------------------
  const dash = fs.readFileSync(path.join(FN, 'crm-dashboard.js'), 'utf8');
  t('the dashboard sends recent failures, guarded so they cannot take it down',
    /try \{\s*failures = await recentFailures\(sql, 7\);\s*\} catch/.test(dash));
  const page = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf8');
  const m = page.match(/var FAILURE_PLACES = [\s\S]*?function renderFailures\(f\) \{[\s\S]*?\n        \}/);
  t('the dashboard page renders them', !!m && /renderFailures\(d && d\.failures\);/.test(page));
  if (m) {
    const el = { innerHTML: 'x' };
    const sb = { document: { getElementById: () => el }, CRM: { escapeHtml: (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;'), fmtDate: (d) => d } };
    vm.createContext(sb);
    vm.runInContext(m[0] + '\nthis.r = renderFailures;', sb);
    sb.r({ days: 7, count: 2, latest: [
      { occurred_at: '2026-09-27', source: 'crm-buyers', method: 'PATCH', step: 'moving', message: '<img src=x onerror=alert(1)>' },
      { occurred_at: '2026-09-27', source: 'inquiries', method: 'POST', step: 'saving a website enquiry', message: 'x' }] });
    t('   "Something failed: 2 operations in the last 7 days", in plain names', /Something failed: 2 operations in the last 7 days/.test(el.innerHTML) &&
      />Buyers </.test(el.innerHTML) && />Website enquiries </.test(el.innerHTML), el.innerHTML.slice(0, 300));
    t('   an error message cannot inject markup', !/<img/.test(el.innerHTML) && /&lt;img/.test(el.innerHTML));
    sb.r({ days: 7, count: 0, latest: [] });
    t('   and nothing is shown when nothing failed', el.innerHTML === '');
  }

  const ok = fail === 0;
  console.log(`\nfailure-alerts ${ok ? 'OK' : 'FAILED'} -- a failed CRM operation reaches a person, not only the log.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.log = origLog; console.error('check-failure-alerts CRASHED:', e && e.stack ? e.stack : e); process.exit(1); });
