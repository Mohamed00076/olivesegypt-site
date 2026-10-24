#!/usr/bin/env node
'use strict';

/*
 * The dashboard's Lost/Stalled Reasons card (owner, 2026-10-23): moves to
 * Lost/Stalled counted by reason, this month and overall, read-only.
 *
 *   node scripts/check-lost-reasons-card.js        (part of `npm test`)
 *
 * Holds that
 *   - the count reads buyer_stage_history and writes or creates nothing;
 *   - it counts moves TO Lost/Stalled only, leaves deleted buyers out, and
 *     takes "this month" from the start of the month in Cairo time;
 *   - moves with no stored reason count as not_recorded, not as a category;
 *   - if the count cannot be read the rest of the dashboard still answers;
 *   - the card lists every category, the same list as the stage rules.
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

process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = 'test-secret-not-a-real-one';

// Fictitious counts only.
const REASON_ROWS = [
  { category: 'price', this_month: 2, overall: 5 },
  { category: 'no_response', this_month: 0, overall: 3 },
  { category: 'not_recorded', this_month: 0, overall: 4 },
];
let reasonsBroken = false;
let statements = [];
const sql = (strings, ...vals) => {
  const q = (Array.isArray(strings) ? strings.join('?') : String(strings)).replace(/\s+/g, ' ').trim();
  statements.push(q);
  if (/reason_category/.test(q)) return reasonsBroken ? Promise.reject(new Error('column "reason_category" does not exist')) : Promise.resolve(REASON_ROWS);
  if (/count\(\*\)::int AS n|count\(DISTINCT/.test(q)) return Promise.resolve([{ n: 0 }]);
  return Promise.resolve([]);
};
sql.query = (text, params) => sql(text, params);
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => sql };

const { signCrmSession, CRM_COOKIE_NAME, LOST_CATEGORIES } = require(path.join(FN, '_crm_lib.js'));
const cookie = `${CRM_COOKIE_NAME}=${signCrmSession('staff')}`;
const dashboard = require(path.join(FN, 'crm-dashboard.js')).handler;
const get = async () => {
  statements = [];
  const r = await dashboard({ httpMethod: 'GET', headers: { cookie }, queryStringParameters: {}, body: null });
  return { status: r.statusCode, data: JSON.parse(r.body || '{}') };
};
const quiet = async (fn) => { const e = console.error; console.error = () => {}; try { return await fn(); } finally { console.error = e; } };

(async () => {
  let r = await get();
  t('the dashboard answers lost_reasons with one row per reason', r.status === 200 && r.data.lost_reasons && JSON.stringify(r.data.lost_reasons.rows) === JSON.stringify(REASON_ROWS), JSON.stringify(r.data.lost_reasons));
  const q = statements.find((s) => /reason_category/.test(s)) || '';
  t('   it counts moves to Lost/Stalled from the stage history', /FROM buyer_stage_history h/.test(q) && /h\.to_stage = 'Lost\/Stalled'/.test(q), q);
  t('   leaves deleted buyers out', /JOIN buyers b ON b\.id = h\.buyer_id/.test(q) && /b\.deleted_at IS NULL/.test(q));
  t('   "this month" starts at the 1st, Cairo time', /date_trunc\('month', now\(\) AT TIME ZONE 'Africa\/Cairo'\) AT TIME ZONE 'Africa\/Cairo'/.test(q));
  t('   a move with no stored reason counts as not_recorded', /COALESCE\(h\.reason_category, 'not_recorded'\)/.test(q));
  // (The failures card's own read may create its crm_failures table; that is older and separate.)
  const writes = statements.filter((s) => /^(INSERT|UPDATE|DELETE|CREATE|ALTER)\b/i.test(s) && /buyer/i.test(s));
  t('   and nothing about buyers or their history is written, created or altered', writes.length === 0, JSON.stringify(writes));

  reasonsBroken = true;
  r = await quiet(get);
  t('if the reasons cannot be read, the rest of the dashboard still answers', r.status === 200 && r.data.lost_reasons === null && Array.isArray(r.data.by_stage), JSON.stringify(r));
  reasonsBroken = false;

  const unsigned = await dashboard({ httpMethod: 'GET', headers: {}, queryStringParameters: {}, body: null });
  t('without a CRM session nothing is answered', unsigned.statusCode === 401 && !/lost_reasons/.test(unsigned.body));

  // ---- the page -----------------------------------------------------------
  const page = fs.readFileSync(path.join(ROOT, 'crm/index.html'), 'utf8');
  const js = fs.readFileSync(path.join(ROOT, 'assets/crm.js'), 'utf8');
  t('the dashboard shows a "Lost/Stalled Reasons" card', /<h2>Lost\/Stalled Reasons<\/h2>' \+ lostReasonsHtml/.test(page));
  t('   with This month and Overall columns and a total', /<th>Reason<\/th><th>This month<\/th><th>Overall<\/th>/.test(page) && /<th scope="row">Total<\/th>/.test(page));
  t('   listing every category, zero or not, from the shared list', /CRM\.LOST_CATEGORIES\.map/.test(page) && /counts\[c\[0\]\] \|\| \{ this_month: 0, overall: 0 \}/.test(page));
  const pageCats = (js.match(/CRM\.LOST_CATEGORIES = \[([\s\S]*?)\];/) || [])[1] || '';
  t('   the same categories as the server\'s stage rules', LOST_CATEGORIES.every((c) => pageCats.includes(`['${c[0]}', '${c[1]}']`)) && (pageCats.match(/\['/g) || []).length === LOST_CATEGORIES.length);
  t('   older moves shown as "Not recorded" only when there are some', /if \(counts\.not_recorded\) reasonRows\.push/.test(page));
  t('   and when the count is unavailable the card says so', /if \(!lr\) \{/.test(page) && /Not available yet\./.test(page));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log('\nlost-reasons-card FAILED -- the card must be a read-only count of moves to Lost/Stalled by reason.');
    process.exit(1);
  }
})().catch((e) => { console.error(e); process.exit(1); });
