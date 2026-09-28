#!/usr/bin/env node
'use strict';

/*
 * Every request the site's forms collect is visible to staff -- and only staff.
 *
 *   node scripts/check-leads-visible.js        (part of `npm test`)
 *
 * leads_staging holds private-label briefs (volume, pack size, Incoterm,
 * launch date), market-brief signups and every gated guide download. Until
 * 2026-09-27 nothing read it: no page, no API, not the CRM, not the analytics
 * dashboard. The only route to a person was an email that is switched off, so
 * these requests had been reaching nobody since the forms went live. The owner
 * asked for them in the CRM's Enquiries.
 *
 * Holds the whole path to that:
 *   - GET /api/leads refuses anyone without a CRM or dashboard session, before
 *     reading a row; returns rows to either session; never returns client_ip;
 *     says whether each address has opted out.
 *   - Every form segment has a staff label on the page, and every detail the
 *     forms collect is shown -- so nothing collected stays hidden again.
 *   - An opted-out address gets no Reply button, and a market-brief signup is
 *     shown as consent to hear about the brief, not to a sales approach.
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

const SECRET = 'test-secret-not-a-real-one';
process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = SECRET;
process.env.SESSION_SECRET = SECRET + '-admin';

let reads = [];
let audits = [];
const EXPORT_ROWS = [
  { email: 'a@example.com', company_name: '=HYPERLINK("http://x","click")', country_region: 'UK', buyer_type: 'importer', signed_up: '2026-09-01' },
  { email: 'b@example.com', company_name: 'شركة الزيتون', country_region: 'Egypt', buyer_type: 'distributor', signed_up: '2026-09-20' },
];
const ROW = {
  id: 7, created_at: '2026-09-20T10:00:00.000Z', email: 'buyer@example.com', company_name: 'Example Imports BV',
  country_region: 'Netherlands', buyer_type: 'importer', consent: true, source_page: '/resources/private-label',
  segment: 'private_label', target_market: 'Benelux', variety: 'Aggizi', format: 'Glass jar', pack_size: '370 ml',
  volume: '2 x 40ft', certification_requirements: 'BRCGS', launch_date: 'Q1 2027', incoterm: 'CIF', opted_out: false,
};
const sql = (strings, ...vals) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  if (/INSERT INTO crm_audit_log/i.test(q)) { audits.push(vals); return Promise.resolve([]); }
  if (/DISTINCT ON/i.test(q) && /FROM leads_staging/i.test(q)) { reads.push(q); return Promise.resolve(EXPORT_ROWS.map((r) => ({ ...r }))); }
  if (/FROM leads_staging/i.test(q)) { reads.push(q); return Promise.resolve([ROW]); }
  return Promise.resolve([]);
};
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
Object.assign(require.cache[neonId], { filename: neonId, loaded: true, exports: { neon: () => sql } });

const { signCrmSession: signCrm, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const { signSession: signAdmin, COOKIE_NAME: ADMIN_COOKIE } = require(path.join(FN, '_lib.js'));
const leads = require(path.join(FN, 'leads.js'));
const src = fs.readFileSync(path.join(FN, 'leads.js'), 'utf8');

const get = async (cookie) => {
  reads = [];
  const r = await leads.handler({ httpMethod: 'GET', headers: cookie ? { cookie } : {}, queryStringParameters: {} });
  return { status: r.statusCode, body: JSON.parse(r.body || 'null'), reads: reads.length, headers: r.headers || {} };
};

(async () => {
  // ---- access -----------------------------------------------------------------
  let r = await get(null);
  t('no session: refused', r.status === 401, r.status);
  t('   before a single request is read', r.reads === 0, r.reads);
  r = await get(`${CRM_COOKIE_NAME}=forged.value`);
  t('a forged CRM cookie is refused', r.status === 401, r.status);
  r = await get(`${CRM_COOKIE_NAME}=${signCrm('staff')}`);
  t('CRM staff can read them', r.status === 200 && Array.isArray(r.body) && r.body.length === 1, JSON.stringify(r.body).slice(0, 120));
  t('   never cached', /no-store/.test(r.headers['Cache-Control'] || ''), JSON.stringify(r.headers));
  t('   each carries a readable label', r.body[0] && r.body[0].segment_label === 'private-label brief', r.body[0] && r.body[0].segment_label);
  r = await get(`${ADMIN_COOKIE}=${signAdmin('owner', SECRET + '-admin')}`);
  t('the analytics-dashboard session can read them too', r.status === 200, r.status);

  // ---- what is read -------------------------------------------------------------
  const sel = (src.match(/async function handleGet[\s\S]*?FROM leads_staging l/) || [''])[0];
  t('the list never returns the visitor\'s IP address', sel && !/client_ip/.test(sel), sel.slice(-400));
  t('   and says whether each address has opted out',
    /LEFT JOIN contact_opt_outs o ON o\.email = lower\(trim\(l\.email\)\)/.test(src) && /AS opted_out/.test(sel));
  t('the POST path the forms use is unchanged', /if \(method === 'GET'\) return await handleGet\(event, sql\);\s*(?:if \(method === 'DELETE'\) return await deleteSubmission\(event, sql, 'lead'\);\s*)?return await handlePost\(event, sql\);/.test(src));

  // ---- the page -------------------------------------------------------------------
  const page = fs.readFileSync(path.join(ROOT, 'crm/inquiries/index.html'), 'utf8');
  t('the Enquiries page loads these requests', /CRM\.fetchJson\('\/api\/leads'\)/.test(page));
  t('   independently, so one list failing cannot hide the other', /Promise\.all\(\[settle\(CRM\.fetchJson\('\/api\/inquiries'\)\), settle\(CRM\.fetchJson\('\/api\/leads'\)\)\]\)/.test(page));

  const segs = [...(src.match(/const SEGMENTS = new Set\(\[([\s\S]*?)\]\)/) || ['', ''])[1].matchAll(/'([a-z_]+)'/g)].map((m) => m[1]);
  const labels = page.match(/var LEAD_LABELS = \{([\s\S]*?)\};/);
  const labelled = labels ? [...labels[1].matchAll(/^\s*([a-z_]+):/gm)].map((m) => m[1]) : [];
  const unlabelled = segs.filter((s) => !labelled.includes(s));
  t(`every form segment has a staff label (${segs.length} segments)`, segs.length >= 10 && unlabelled.length === 0, `unlabelled: ${unlabelled.join(', ')}`);

  const cols = [...(src.match(/CREATE TABLE IF NOT EXISTS leads_staging \(([\s\S]*?)\n\s*\)/) || ['', ''])[1].matchAll(/^\s*([a-z_]+)\s+\w/gm)].map((m) => m[1]);
  const shownElsewhere = { id: 'row key', created_at: 'Received column', email: 'From column', company_name: 'From column',
    country_region: 'Country column', segment: 'Asked for column', consent: 'the consent line', client_ip: 'deliberately not shown' };
  const detail = (page.match(/function leadDetail\(r\) \{[\s\S]*?\n        \}/) || [''])[0];
  const hidden = cols.filter((c) => !shownElsewhere[c] && !new RegExp(`r\\.${c}\\b`).test(detail));
  t(`every detail the forms collect is shown to staff (${cols.length} columns)`, cols.length >= 18 && hidden.length === 0, `not shown: ${hidden.join(', ')}`);

  if (detail) {
    const sb = { esc: (v) => String(v == null ? '' : v), encodeURIComponent,
      BUYER_TYPES: { importer: 'Importer' },
      line: (l, v) => (v ? `<div>${l}: ${v}</div>` : ''),
      replyButton: (e, s) => (e ? `<a href="mailto:${e}">Reply by email</a>` : ''),
      deleteButton: () => '<button class="delete-row-btn">Delete</button>' };
    vm.createContext(sb);
    const f = vm.runInContext('(' + detail + ')', sb);
    const live = f(Object.assign({}, ROW));
    t('   a brief shows volume, Incoterm, launch date and a Reply button',
      /2 x 40ft/.test(live) && /CIF/.test(live) && /Q1 2027/.test(live) && /Reply by email/.test(live), live.slice(0, 200));
    const out = f(Object.assign({}, ROW, { opted_out: true }));
    t('an opted-out address gets no Reply button, and a warning instead', !/Reply by email/.test(out) && /opted out of contact\. Do not email it\./.test(out), out.slice(-200));
    const mb = f(Object.assign({}, ROW, { segment: 'market_report' }));
    t('a market-brief signup is shown as consent to the brief only, not a sales enquiry', /quarterly market brief only/.test(mb) && /not a sales enquiry/.test(mb));
    t('   every request, opted out or not, can be deleted', /delete-row-btn/.test(live) && /delete-row-btn/.test(out) && /delete-row-btn/.test(mb));
  }

  // ---- the market-brief subscriber export ---------------------------------------------
  const exp = async (qs, cookie) => {
    reads = []; audits = [];
    const r = await leads.handler({ httpMethod: 'GET', headers: cookie ? { cookie } : {}, queryStringParameters: qs });
    return { status: r.statusCode, body: r.body, headers: r.headers || {}, reads: reads.length, audits: audits.slice() };
  };
  const staff = `${CRM_COOKIE_NAME}=${signCrm('staff')}`;
  let x = await exp({ export: 'market_report', confirmed: '1' }, null);
  t('the subscriber export refuses anyone without a session', x.status === 401 && x.reads === 0, x.status);
  x = await exp({ export: 'market_report' }, staff);
  t('   and needs an explicit confirmation, like the buyer export', x.status === 400 && x.reads === 0, x.status);
  x = await exp({ export: 'market_report', confirmed: '1' }, staff);
  t('   downloads as a CSV file, never cached', x.status === 200 && /text\/csv/.test(x.headers['Content-Type']) &&
    /^attachment; filename="market-brief-subscribers-\d{4}-\d{2}-\d{2}\.csv"$/.test(x.headers['Content-Disposition']) && /no-store/.test(x.headers['Cache-Control']), JSON.stringify(x.headers));
  const lines = x.body.split('\r\n');
  t('   with a byte-order mark, so Arabic names open correctly', x.body.charCodeAt(0) === 0xFEFF);
  t('   a header and one row per subscriber, newest first', lines[0] === '\uFEFFemail,company,country,business_type,signed_up' && lines.length === 3 &&
    lines[1].startsWith('b@example.com'), JSON.stringify(lines));
  t('   and a formula in a company name is neutralised', /"'=HYPERLINK\(""http:\/\/x"",""click""\)"/.test(x.body), lines[2]);
  {
    const { csvCell } = require(path.join(FN, '_crm_lib.js'));
    t('   and so is a formula behind a leading TAB or CR (audit run 1, C7)',
      csvCell('\t=1+1').startsWith("'\t") && csvCell('\r=1') === '"\'\r=1"' && csvCell('plain') === 'plain');
  }
  t('   every export is recorded in the audit log, with the row count', x.audits.length === 1 && x.audits[0][0] === 'staff' && x.audits[0][1] === 'rows=2', JSON.stringify(x.audits));
  const eq = (src.match(/async function handleExport[\s\S]*?ORDER BY lower\(trim\(l\.email\)\), l\.created_at DESC/) || [''])[0];
  t('   it includes only market-brief signups who consented', /WHERE l\.segment = 'market_report' AND l\.consent = true/.test(eq));
  t('   leaves out every address that has opted out', /COALESCE\(o\.status, ''\) <> 'unsubscribed'/.test(eq) && /LEFT JOIN contact_opt_outs o ON o\.email = lower\(trim\(l\.email\)\)/.test(eq));
  t('   and lists each address once', /SELECT DISTINCT ON \(lower\(trim\(l\.email\)\)\)/.test(eq));
  t('the Enquiries page has the button, asks first, and reports failures',
    /id="export-mb-btn"/.test(page) && /window\.confirm\('Download the email addresses/.test(page) &&
    /fetch\('\/api\/leads\?export=market_report&confirmed=1'/.test(page) && /showStatus\('The export failed: '/.test(page) &&
    /CRM\.noReplyMessage\(e, 'The export'/.test(page));

  const ok = fail === 0;
  console.log(`\nleads-visible ${ok ? 'OK' : 'FAILED'} -- every request the forms collect is visible to staff, and only staff.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('check-leads-visible CRASHED:', e && e.stack ? e.stack : e); process.exit(1); });
