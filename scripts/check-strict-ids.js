#!/usr/bin/env node
'use strict';

/*
 * A record id from a request is digits, or it is refused.
 *
 *   node scripts/check-strict-ids.js        (part of `npm test`)
 *
 * parseInt reads "5abc" or "5; anything" as 5. Deleting enquiries, that meant
 * a malformed id would delete record 5 -- caught by check-request-delete.js,
 * fixed there, and flagged as still true of the buyer and document pages.
 * The owner asked for those tightened too (2026-09-27), and then the KPI
 * manager, where Number() read "0x10" as 16 and "1e1" as 10. And a malformed id
 * that parsed to nothing was worse in another way: GET ?id=abc quietly
 * returned the whole buyer list, ?buyer_id=abc every buyer's documents, and
 * the KPI manager's ?kpi_id=abc every KPI's values.
 *
 * Every CRM and KPI id now goes through parseId (_lib.js, one copy). This runs the real
 * handlers with malformed ids and checks each is refused before any query
 * that names a record -- and that a good id still reaches the database as
 * that number.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const SECRET = 'test-secret-not-a-real-one';
process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = SECRET;
process.env.SESSION_SECRET = SECRET + '-admin';

let calls = [];
const sql = (strings, ...vals) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  calls.push({ q, params: Array.isArray(strings) ? vals : (vals[0] || []) });
  return Promise.resolve([]);
};
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
Object.assign(require.cache[neonId], { filename: neonId, loaded: true, exports: { neon: () => sql } });

const { parseId, signCrmSession, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const base = require(path.join(FN, '_lib.js'));
const crmCookie = `${CRM_COOKIE_NAME}=${signCrmSession('staff')}`;
const adminCookie = `${base.COOKIE_NAME}=${base.signSession('owner', SECRET + '-admin')}`;
const cookieFor = (file) => (/^kpi-/.test(file) ? adminCookie : crmCookie);

// Queries that name a record, as opposed to creating tables.
const recordQueries = () => calls.filter((c) => /WHERE (\w+\.)?(id|buyer_id|kpi_id) =/i.test(c.q));

const BAD = ['5abc', '5; DROP TABLE buyers', '0', '-5', '5.5', '0x10', '1e3', ' 5', 'abc', '99999999999999999'];

(async () => {
  // ---- parseId itself ----------------------------------------------------------
  t('parseId accepts digits, as a string or a number', parseId('5') === 5 && parseId(5) === 5 && parseId('123456') === 123456);
  const leaked = BAD.filter((v) => parseId(v) !== null);
  t('parseId refuses everything that is not plainly a positive whole number', leaked.length === 0, leaked.join(' | '));
  t('   including a number that would round to a different record', parseId('9007199254740993') === null && parseId(9007199254740993) === null);
  t('   and nothing at all', parseId(undefined) === null && parseId(null) === null && parseId('') === null && parseId({}) === null && parseId([5]) === null);
  t('one copy: the CRM uses the same parseId as everything else', parseId === base.parseId);

  // ---- the handlers --------------------------------------------------------------
  const run = async (file, event) => {
    calls = [];
    const r = await require(path.join(FN, file)).handler(Object.assign({ headers: { cookie: cookieFor(file) } }, event));
    return { status: r.statusCode, body: JSON.parse(r.body || '{}'), touched: recordQueries() };
  };

  const QS_CASES = [
    { file: 'crm-buyers.js', method: 'GET', key: 'id', what: 'opening a buyer' },
    { file: 'crm-buyers.js', method: 'PATCH', key: 'id', what: 'editing a buyer', body: '{"current_stage":"Contacted"}' },
    { file: 'crm-buyers.js', method: 'DELETE', key: 'id', what: 'deleting a buyer', extra: { confirmed: '1' } },
    { file: 'crm-documents.js', method: 'GET', key: 'id', what: 'opening a document' },
    { file: 'crm-documents.js', method: 'GET', key: 'buyer_id', what: "listing a buyer's documents" },
    { file: 'crm-documents.js', method: 'DELETE', key: 'id', what: 'voiding a document', extra: { confirmed: '1' } },
    { file: 'kpi-values.js', method: 'GET', key: 'kpi_id', what: "reading a KPI's history", error: /kpi_id must be a number/ },
  ];
  for (const c of QS_CASES) {
    const tag = `${c.file} ${c.method} ?${c.key}=`;
    const bad = [];
    for (const v of BAD) {
      const r = await run(c.file, { httpMethod: c.method, queryStringParameters: Object.assign({ [c.key]: v }, c.extra), body: c.body });
      if (!(r.status === 400 && r.touched.length === 0 && (c.error || /valid id/).test(r.body.error))) bad.push(`${JSON.stringify(v)} -> ${r.status}, ${r.touched.length} record queries`);
    }
    t(`${tag}<malformed>, ${c.what}: refused, no record touched (${BAD.length} forms)`, bad.length === 0, bad.join(' | '));
    const ok = await run(c.file, { httpMethod: c.method, queryStringParameters: Object.assign({ [c.key]: '5' }, c.extra), body: c.body });
    t(`${tag}5 still reaches record 5`, ok.touched.length > 0 && ok.touched.every((q) => q.params.includes(5)),
      JSON.stringify(ok.touched.map((q) => q.params)));
  }

  // The list pages themselves still work without an id.
  let r = await run('crm-buyers.js', { httpMethod: 'GET', queryStringParameters: {} });
  t('crm-buyers.js GET with no id still lists buyers', r.status === 200 && Array.isArray(r.body), r.status);
  r = await run('crm-documents.js', { httpMethod: 'GET', queryStringParameters: {} });
  t('crm-documents.js GET with no buyer_id still lists documents', r.status === 200 && Array.isArray(r.body), r.status);
  r = await run('kpi-values.js', { httpMethod: 'GET', queryStringParameters: {} });
  t('kpi-values.js GET with no kpi_id still lists current values', r.status === 200 && r.body.ok === true, r.status);

  // ---- ids in a request body -------------------------------------------------------
  const BODY_BAD = ['5abc', '5; DROP TABLE buyers', 0, -5, 5.5, '0x10', 'abc', true];
  const post = (file, body) => run(file, { httpMethod: 'POST', queryStringParameters: {}, body: JSON.stringify(body) });

  let bad = [];
  for (const v of BODY_BAD) {
    const res = await post('crm-activity.js', { buyer_id: v, entry: 'Called them' });
    if (!(res.status === 400 && res.touched.length === 0 && (res.body.fields || []).includes('buyer_id'))) bad.push(`${JSON.stringify(v)} -> ${res.status}`);
  }
  t('crm-activity.js: a note with a malformed buyer_id is refused, no buyer touched', bad.length === 0, bad.join(' | '));
  r = await post('crm-activity.js', { buyer_id: 5, entry: 'Called them' });
  t('   buyer_id 5 still looks up buyer 5', r.touched.length > 0 && r.touched[0].params.includes(5), JSON.stringify(r));
  r = await post('crm-activity.js', { buyer_id: '5', entry: 'Called them' });
  t('   and so does "5"', r.touched.length > 0 && r.touched[0].params.includes(5), JSON.stringify(r));

  bad = [];
  for (const v of BODY_BAD) {
    const res = await post('crm-documents.js', { doc_type: 'letter', buyer_id: v });
    if (!(res.status === 400 && res.touched.length === 0 && (res.body.fields || []).includes('buyer_id'))) bad.push(`${JSON.stringify(v)} -> ${res.status} ${JSON.stringify(res.body)}`);
  }
  t('crm-documents.js: a document with a malformed buyer_id is refused, not issued to buyer 5', bad.length === 0, bad.join(' | '));
  r = await post('crm-documents.js', { doc_type: 'letter', buyer_id: 5 });
  t('   buyer_id 5 still looks up buyer 5', r.touched.length > 0 && r.touched[0].params.includes(5), JSON.stringify(r));

  // The KPI manager: entering a value, and editing or archiving a KPI.
  const KPI_BODY = [
    { file: 'kpi-values.js', method: 'POST', key: 'kpi_id', what: 'entering a KPI value', rest: { actual_value: 1 } },
    { file: 'kpi-definitions.js', method: 'PATCH', key: 'id', what: 'editing or archiving a KPI', rest: { archive: true } },
  ];
  for (const c of KPI_BODY) {
    bad = [];
    for (const v of BODY_BAD.concat(['1e1'])) {
      const res = await run(c.file, { httpMethod: c.method, queryStringParameters: {}, body: JSON.stringify(Object.assign({ [c.key]: v }, c.rest)) });
      if (!(res.status === 400 && res.touched.length === 0)) bad.push(`${JSON.stringify(v)} -> ${res.status}, ${res.touched.length} record queries`);
    }
    t(`${c.file}: ${c.what} with a malformed ${c.key} is refused, no KPI touched`, bad.length === 0, bad.join(' | '));
    const res = await run(c.file, { httpMethod: c.method, queryStringParameters: {}, body: JSON.stringify(Object.assign({ [c.key]: '5' }, c.rest)) });
    t(`   ${c.key} "5" still looks up KPI 5`, res.touched.length > 0 && res.touched[0].params.includes(5), JSON.stringify(res));
  }

  // ---- nothing parses an id loosely any more ----------------------------------------
  const loose = fs.readdirSync(FN).filter((f) => /^(crm-.*|kpi-.*|inquiries|leads|_crm_lib|_lib)\.js$/.test(f))
    .filter((f) => /parseInt\((qs|body)\.\w*id\b|Number\((qs|body)\.\w*id\b/.test(fs.readFileSync(path.join(FN, f), 'utf8')));
  t('no CRM or KPI function reads an id with parseInt or Number', loose.length === 0, loose.join(', '));

  const ok = fail === 0;
  console.log(`\nstrict-ids ${ok ? 'OK' : 'FAILED'} -- a CRM or KPI record id is digits, or it is refused.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('check-strict-ids CRASHED:', e && e.stack ? e.stack : e); process.exit(1); });
