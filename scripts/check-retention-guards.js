#!/usr/bin/env node
'use strict';

/*
 * Guards on the nightly analytics purge.
 *
 *   node scripts/check-retention-guards.js        (part of `npm test`)
 *
 * Offline: the database driver is stubbed, so every statement the function
 * would run is captured and inspected instead of executed.
 *
 * analytics-retention.js deletes unrecoverable data, unattended, once a
 * night, against a number an admin types into a form. Its only check used to
 * be `days >= 1`. These assertions are about the cases where it must NOT
 * delete -- a floor-breaking setting, an unusable one, a dry run -- plus the
 * two properties that bound the damage when it does: a per-run cap that a
 * statement can actually honour, and an audit row for every outcome
 * including the refusals.
 */

const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

// ---- stubbed driver ------------------------------------------------------
let statements = [];
let settingsValue = 395;
let deleteRowCount = 3;

function text(strings) {
  return Array.isArray(strings) ? strings.join(' ? ') : String(strings);
}

function respond(sqlText) {
  if (/FROM analytics_settings/i.test(sqlText)) {
    return settingsValue === undefined ? [] : [{ value: settingsValue }];
  }
  if (/count\(\*\)/i.test(sqlText)) return [{ n: deleteRowCount }];
  if (/^\s*DELETE/i.test(sqlText)) return new Array(deleteRowCount).fill({ id: 1 });
  return [];
}

function fakeSql(strings, ...values) {
  const t = text(strings);
  statements.push({ text: t, params: values });
  return Promise.resolve(respond(t));
}
fakeSql.query = (t, params) => {
  statements.push({ text: t, params: params || [] });
  return Promise.resolve(respond(t));
};

const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => fakeSql };

const lib = require(path.join(FN, '_analytics_lib.js'));
const MIN = lib.MIN_RETENTION_DAYS;

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

function freshRetention(env) {
  delete process.env.ANALYTICS_RETENTION_DRY_RUN;
  process.env.DATABASE_URL = 'postgres://stub';
  Object.assign(process.env, env || {});
  delete require.cache[require.resolve(path.join(FN, 'analytics-retention.js'))];
  return require(path.join(FN, 'analytics-retention.js'));
}

async function run(opts) {
  statements = [];
  settingsValue = 'settings' in opts ? opts.settings : 395;
  deleteRowCount = 'rows' in opts ? opts.rows : 3;
  const mod = freshRetention(opts.env);
  const quiet = { log: console.log, warn: console.warn };
  console.log = () => {}; console.warn = () => {};
  const res = await mod.handler();
  console.log = quiet.log; console.warn = quiet.warn;
  return { res, mod, statements: statements.slice() };
}

const deletes = (list) => list.filter((s) => /^\s*DELETE\s+FROM\s+analytics_/i.test(s.text));
const audits = (list) => list.filter((s) => /INSERT INTO analytics_audit_log/i.test(s.text));

(async () => {
  // ---- 1. the ordinary nightly run still works ---------------------------
  let r = await run({ settings: 395, rows: 3 });
  t('a normal run purges and reports', /^purged:/.test(r.res.body), r.res.body);
  t('   it deletes from both analytics tables', deletes(r.statements).length === 2, deletes(r.statements).length);
  t('   and writes exactly one audit row', audits(r.statements).length === 1, audits(r.statements).length);

  // ---- 2. the floor ------------------------------------------------------
  r = await run({ settings: 1 });
  t(`data_retention_days=1 is refused, not obeyed`, /^refused:/.test(r.res.body), r.res.body);
  t('   nothing is deleted', deletes(r.statements).length === 0, deletes(r.statements).length);
  t('   the refusal names the floor and the fix', r.res.body.includes(String(MIN)) && r.res.body.includes('/admin/analytics'));
  t('   the refusal is recorded in the audit log, not just the function log',
    audits(r.statements).length === 1 && audits(r.statements)[0].params.some((p) => String(p).includes('refused')),
    JSON.stringify(audits(r.statements)[0] && audits(r.statements)[0].params));

  r = await run({ settings: MIN - 1 });
  t(`one day below the floor is still refused`, deletes(r.statements).length === 0);
  r = await run({ settings: MIN });
  t(`exactly the floor is allowed`, /^purged:/.test(r.res.body), r.res.body);

  // ---- 3. an unusable setting -------------------------------------------
  for (const bad of ['not-a-number', null, 0, -7]) {
    r = await run({ settings: bad });
    t(`data_retention_days=${JSON.stringify(bad)} deletes nothing`,
      deletes(r.statements).length === 0, r.res.body);
  }
  // No settings row at all is the fresh-install case: fall back to the
  // documented default rather than to zero, which would mean "delete
  // everything".
  r = await run({ settings: undefined });
  t('a missing setting falls back to the 395-day default, not to 0',
    /older than 395 days/.test(r.res.body), r.res.body);

  // ---- 4. dry run --------------------------------------------------------
  r = await run({ settings: 395, rows: 12, env: { ANALYTICS_RETENTION_DRY_RUN: '1' } });
  t('a dry run reports what it would delete', /^dry-run:/.test(r.res.body) && r.res.body.includes('12'), r.res.body);
  t('   and deletes nothing at all', deletes(r.statements).length === 0, deletes(r.statements).length);
  t('   and still leaves an audit row', audits(r.statements).length === 1);

  // ---- 5. the per-run cap ------------------------------------------------
  const mod = freshRetention({});
  const CAP = mod.MAX_DELETES_PER_RUN;
  r = await run({ settings: 395, rows: CAP });
  t('a run that hits the cap says so rather than reporting a clean sweep',
    r.res.body.includes('cap') && r.res.body.includes('next run continues'), r.res.body);

  // The cap is only real if the statement can honour it. An unbounded
  // DELETE ... WHERE has no way to stop partway.
  const del = deletes(r.statements)[0];
  t('the delete is bounded by a LIMIT, not an open WHERE', /LIMIT\s+\$2/i.test(del.text), del.text);
  t('   and the cap is the bound that is passed', del.params.includes(CAP), JSON.stringify(del.params));
  t('   the row count is bound as a parameter, never interpolated',
    del.params.length === 2 && del.params[0] === 395, JSON.stringify(del.params));

  r = await run({ settings: 395, rows: CAP - 1 });
  t('a run below the cap does not claim to have hit it', !r.res.body.includes('cap'), r.res.body);

  // ---- 6. the form and the purge agree on the floor ----------------------
  const privacySrc = require('fs').readFileSync(path.join(FN, 'analytics-privacy.js'), 'utf8');
  t('analytics-privacy.js validates against the shared floor, not its own number',
    privacySrc.includes('MIN_RETENTION_DAYS') && !/days < 1\b/.test(privacySrc));
  const adminSrc = require('fs').readFileSync(path.join(ROOT, 'admin', 'analytics', 'index.html'), 'utf8');
  t('the admin field will not even accept a value below the floor',
    adminSrc.includes(`id="j-retention-days" min="${MIN}"`),
    (adminSrc.match(/id="j-retention-days"[^>]*/) || [])[0]);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error('ERROR', e); process.exit(1); });
