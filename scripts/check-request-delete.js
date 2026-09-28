#!/usr/bin/env node
'use strict';

/*
 * Deleting an enquiry or request: staff only, confirmed, recorded, and final.
 *
 *   node scripts/check-request-delete.js        (part of `npm test`)
 *
 * The owner asked for a way to delete entries from the Enquiries page and
 * chose "gone for good" over hidden (2026-09-27) -- for test entries, and for
 * a visitor who asks for their data to be deleted. Permanent deletion of
 * someone's details is the one action here that cannot be walked back, so:
 *
 *   - CRM staff only. The analytics-dashboard session may READ these, but not
 *     delete them: an audit entry needs a CRM actor.
 *   - Nothing happens without confirmed=1, or with a malformed id.
 *   - The row and its audit entry are one statement: never a delete without a
 *     record of who deleted what and when.
 *   - The audit entry holds the date received and the kind of request --
 *     never the person's details.
 *   - The opt-out list is never touched: an unsubscribed address stays so.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

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
let exists = true;
const sql = (strings, ...vals) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  const params = Array.isArray(strings) ? vals : (vals[0] || []);
  calls.push({ q, params });
  if (/DELETE FROM/i.test(q)) return Promise.resolve(exists ? [{ record_id: params[0] }] : []);
  return Promise.resolve([]);
};
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
Object.assign(require.cache[neonId], { filename: neonId, loaded: true, exports: { neon: () => sql } });

const { signCrmSession: signCrm, CRM_COOKIE_NAME } = require(path.join(FN, '_crm_lib.js'));
const { signSession: signAdmin, COOKIE_NAME: ADMIN_COOKIE } = require(path.join(FN, '_lib.js'));
const staff = `${CRM_COOKIE_NAME}=${signCrm('staff')}`;
const dashboard = `${ADMIN_COOKIE}=${signAdmin('owner', SECRET + '-admin')}`;

const ENDPOINTS = [
  { file: 'inquiries.js', kind: 'inquiry', table: 'inquiries' },
  { file: 'leads.js', kind: 'lead', table: 'leads_staging' },
];

(async () => {
  for (const ep of ENDPOINTS) {
    const h = require(path.join(FN, ep.file)).handler;
    const del = async (qs, cookie) => {
      calls = [];
      const r = await h({ httpMethod: 'DELETE', headers: cookie ? { cookie } : {}, queryStringParameters: qs });
      const deletes = calls.filter((c) => /DELETE FROM/i.test(c.q));
      return { status: r.statusCode, body: JSON.parse(r.body || '{}'), deletes };
    };
    const tag = `${ep.file}:`;

    let r = await del({ id: '5', confirmed: '1' }, null);
    t(`${tag} no session: refused, nothing deleted`, r.status === 401 && r.deletes.length === 0, r.status);
    r = await del({ id: '5', confirmed: '1' }, dashboard);
    t(`${tag} the analytics-dashboard session may read but not delete`, r.status === 401 && r.deletes.length === 0, r.status);
    r = await del({ id: '5' }, staff);
    t(`${tag} no confirmation: refused, nothing deleted`, r.status === 400 && r.deletes.length === 0, r.status);
    r = await del({ id: '5; DROP TABLE x', confirmed: '1' }, staff);
    t(`${tag} a malformed id is refused, nothing deleted`, r.status === 400 && r.deletes.length === 0, JSON.stringify(r));
    r = await del({ id: '5abc', confirmed: '1' }, staff);
    t(`${tag} digits with anything after them are refused, not read as a number`, r.status === 400 && r.deletes.length === 0, r.status);
    r = await del({ id: '0', confirmed: '1' }, staff);
    t(`${tag} id 0 is refused`, r.status === 400 && r.deletes.length === 0, r.status);
    r = await del({ id: 'abc', confirmed: '1' }, staff);
    t(`${tag} a non-numeric id is refused`, r.status === 400 && r.deletes.length === 0, r.status);

    exists = false;
    r = await del({ id: '5', confirmed: '1' }, staff);
    t(`${tag} an id that is not there answers 404, saying it may already be gone`, r.status === 404 && /may already have been deleted/.test(r.body.error), JSON.stringify(r.body));
    exists = true;

    r = await del({ id: '5', confirmed: '1' }, staff);
    const d = r.deletes[0] || { q: '', params: [] };
    t(`${tag} staff with confirmation: deleted`, r.status === 200 && r.body.ok === true && r.deletes.length === 1, JSON.stringify(r));
    t(`${tag}    from ${ep.table}, by id`, new RegExp(`DELETE FROM ${ep.table} WHERE id = \\$1`).test(d.q) && d.params[0] === 5, d.q.slice(0, 80));
    t(`${tag}    with its audit entry in the SAME statement`, /WITH gone AS \(DELETE[\s\S]*INSERT INTO crm_audit_log[\s\S]*FROM gone/.test(d.q), d.q);
    t(`${tag}    recording who and what kind`, d.params[1] === 'staff' && d.params[2] === ep.kind, JSON.stringify(d.params));
  }

  // ---- what the audit entry can contain ------------------------------------------
  const lib = read('netlify/functions/_crm_lib.js');
  const stmt = (lib.match(/WITH gone AS \(DELETE FROM \$\{k\.table\}[\s\S]*?RETURNING record_id/) || [''])[0];
  t('the audit entry is built only from the date received and the kind of request',
    /RETURNING id, created_at, \$\{k\.kindColumn\} AS kind/.test(stmt) && !/email|name|company|phone|message|client_ip/.test(stmt), stmt);
  t('the table and column come from a fixed list in code, never from the request',
    /const SUBMISSION_KINDS = \{\s*inquiry: \{ table: 'inquiries', kindColumn: 'request_type' \},\s*lead: \{ table: 'leads_staging', kindColumn: 'segment' \},\s*\};/.test(lib) &&
    /deleteSubmission\(event, sql, 'inquiry'\)/.test(read('netlify/functions/inquiries.js')) &&
    /deleteSubmission\(event, sql, 'lead'\)/.test(read('netlify/functions/leads.js')));

  // ---- what it must never touch ------------------------------------------------------
  const touchesOptOuts = ['netlify/functions/_crm_lib.js', 'netlify/functions/inquiries.js', 'netlify/functions/leads.js']
    .filter((f) => /DELETE FROM contact_opt_outs/.test(read(f)));
  t('nothing in the delete path can remove an opt-out', touchesOptOuts.length === 0, touchesOptOuts.join(', '));

  // ---- the page -------------------------------------------------------------------------
  const page = read('crm/inquiries/index.html');
  const fn = (page.match(/function deleteRow\(r\) \{[\s\S]*?\n        \}/) || [''])[0];
  t('the Enquiries page asks first, and says it cannot be undone', /window\.confirm\(msg\)/.test(fn) && /This cannot be undone\./.test(fn));
  t('   says a linked buyer is NOT deleted, and an opted-out address stays opted out',
    /The buyer record is NOT deleted/.test(fn) && /stays opted out/.test(fn));
  t('   sends the delete to the right endpoint, confirmed', /\(r\.kind === 'lead' \? '\/api\/leads' : '\/api\/inquiries'\) \+ '\?id=' \+ encodeURIComponent\(r\.id\) \+ '&confirmed=1'/.test(fn));
  t('   and only removes the row once the server says it is gone',
    /if \(!result\.ok\) \{ showStatus[\s\S]*?return; \}\s*rows = rows\.filter/.test(fn));
  t('every opened enquiry and request has a Delete button',
    /replyButton\(r\.email, 'Re: your enquiry to Triple Company'\) \+ deleteButton\(r\)/.test(page) &&
    /replyButton\(r\.email, 'Re: your request to Triple Company'\)\) \+ deleteButton\(r\)/.test(page));

  const ok = fail === 0;
  console.log(`\nrequest-delete ${ok ? 'OK' : 'FAILED'} -- deleting an enquiry is staff-only, confirmed, recorded and final.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('check-request-delete CRASHED:', e && e.stack ? e.stack : e); process.exit(1); });
