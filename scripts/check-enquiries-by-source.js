#!/usr/bin/env node
'use strict';

/*
 * Enquiries by how the visitor arrived: admin only, counts only.
 *
 *   node scripts/check-enquiries-by-source.js        (part of `npm test`)
 *
 * Since Deploy 35 an enquiry carries the analytics session of the visit that
 * sent it, with consent only (C-112). Nothing read it back, so the question
 * "which searches led to a quote request" had no answer (system health audit,
 * run 1, D4). analytics-report now answers report=enquiries_by_source.
 *
 * Linking an identified record to a browsing session is exactly why C-112 was
 * disclosed, so this report must stay aggregate: it is held to the analytics
 * admin's login, and to counts and a source label -- never a name, email,
 * company, message or address.
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

process.env.DATABASE_URL = 'postgres://stub';
process.env.SESSION_SECRET = 'admin-secret-for-test-only-000000000000';
process.env.CRM_SESSION_SECRET = 'crm-secret-for-test-only-0000000000000000';

let calls = [];
let tablePresent = true;
const sql = (strings, ...vals) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  calls.push({ q, params: Array.isArray(strings) ? vals : (vals[0] || []) });
  if (/to_regclass\('public\.inquiries'\)/.test(q)) return Promise.resolve([{ ok: tablePresent }]);
  if (/FROM inquiries i/.test(q)) return Promise.resolve([
    { source: 'Organic Search', enquiries: 2, quote_requests: 1, sample_requests: 1 },
    { source: 'Not linked', enquiries: 1, quote_requests: 1, sample_requests: 0 },
  ]);
  return Promise.resolve([]);
};
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
Object.assign(require.cache[neonId], { filename: neonId, loaded: true, exports: { neon: () => sql } });

const lib = require(path.join(FN, '_lib.js'));
const crm = require(path.join(FN, '_crm_lib.js'));
const handler = require(path.join(FN, 'analytics-report.js')).handler;
const admin = `${lib.COOKIE_NAME}=${lib.signSession('owner', process.env.SESSION_SECRET)}`;
// signCrmSession arrives with #177; before it, CRM sessions were signed with the raw secret.
const staff = `${crm.CRM_COOKIE_NAME}=${crm.signCrmSession ? crm.signCrmSession('staff') : crm.signSession('staff', process.env.CRM_SESSION_SECRET)}`;
const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };
const get = (cookie, qs) => quiet(() => handler({ httpMethod: 'GET', headers: cookie ? { cookie } : {}, queryStringParameters: Object.assign({ report: 'enquiries_by_source' }, qs) }, {}));

(async () => {
  let r = await get(null);
  t('no session: refused', r.statusCode === 401, r.statusCode);
  r = await get(staff);
  t('a CRM session: refused (this is the analytics admin\'s report)', r.statusCode === 401, r.statusCode);

  calls = [];
  r = await get(admin, { range: '90d' });
  const body = JSON.parse(r.body || '{}');
  t('the admin gets it', r.statusCode === 200 && Array.isArray(body.rows) && body.total === 3, r.body);
  t('   never cached', /no-store/.test((r.headers || {})['Cache-Control'] || ''));
  const q = (calls.find((c) => /FROM inquiries i/.test(c.q)) || { q: '', params: [] });
  t('   real enquiry records, joined to the session of the visit that sent them',
    /FROM inquiries i\s+LEFT JOIN analytics_sessions s ON s\.session_id = i\.session_id/.test(q.q), q.q.slice(0, 200));
  t('   within the chosen period', /WHERE i\.created_at >= \$1 AND i\.created_at < \$2/.test(q.q) && q.params.length === 2 &&
    Math.round((q.params[1] - q.params[0]) / 86400000) === 90, JSON.stringify(q.params));
  const selected = (q.q.match(/SELECT([\s\S]*?)FROM inquiries/) || ['', ''])[1];
  t('   selecting a source label and counts only -- no personal details',
    /AS source/.test(selected) && /count\(\*\)/.test(selected) &&
    !/\b(email|name|company|message|client_ip|phone|country)\b/.test(selected.replace(/attribution_source|request_type|session_id/g, '')), selected.trim());
  t('   enquiries with no session are labelled, not dropped', /'Not linked'/.test(q.q) && /'Visit no longer held'/.test(q.q));

  tablePresent = false;
  r = await get(admin);
  t('on a database with no enquiries table yet, it answers empty rather than failing',
    r.statusCode === 200 && JSON.parse(r.body).rows.length === 0, r.body);

  // ---- the dashboard -------------------------------------------------------------
  const page = fs.readFileSync(path.join(ROOT, 'admin/analytics/index.html'), 'utf8');
  t('the dashboard asks for it with the rest of the pipeline',
    /jApi\('analytics-report', \{ report: 'enquiries_by_source' \}\)\.then\(renderEnquiriesBySource\)/.test(page));
  const m = page.match(/function renderEnquiriesBySource\(d\) \{[\s\S]*?\n    \}/);
  t('   and renders it as text only', !!m && !/innerHTML/.test(m[0]));
  if (m) {
    const els = {}; const el = (id) => (els[id] = els[id] || { textContent: '', id });
    let ranked = null;
    const sb = { document: { getElementById: el }, renderRank: (id, rows) => { ranked = rows; }, labelFor: (x) => String(x) };
    vm.createContext(sb);
    vm.runInContext(m[0] + '\nthis.f = renderEnquiriesBySource;', sb);
    sb.f({ rows: [{ source: '<img src=x onerror=alert(1)>', enquiries: 2, quote_requests: 1, sample_requests: 1 }], note: 'n' });
    t('   a source label cannot inject markup', ranked && ranked[0].y === 2 && els['j-enq-source-split'].textContent.includes('<img') && els['j-enq-source-note'].textContent === 'n',
      JSON.stringify(els));
  }

  const ok = fail === 0;
  console.log(`\nenquiries-by-source ${ok ? 'OK' : 'FAILED'} -- enquiries by how the visitor arrived: admin only, counts only.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('check-enquiries-by-source CRASHED:', e && e.stack ? e.stack : e); process.exit(1); });
