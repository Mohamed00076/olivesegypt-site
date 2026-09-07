#!/usr/bin/env node
'use strict';

/*
 * Who may read the enquiries a buyer sends through the website.
 *
 *   node scripts/check-inquiries-access.js        (part of `npm test`)
 *
 * GET /api/inquiries returns names, email addresses, phone numbers and
 * messages from real people. On 2026-09-07 it was opened to CRM staff as well
 * as the site owner, because it had accepted only the /admin/analytics session
 * and so no page under /crm/ could display enquiries at all -- they were
 * stored correctly and shown nowhere, which is how the owner came to believe
 * they had stopped arriving.
 *
 * Widening who can read personal data is exactly the kind of change that
 * should not rest on having read the diff carefully, so it is tested from
 * both directions:
 *
 *   - each of the two sessions is accepted
 *   - no session, a forged one, and one signed with the wrong secret are all
 *     refused, and refused BEFORE any row is read
 *   - POST stays public, because that is the form every visitor submits
 *
 * The last one matters as much as the rest. This endpoint is both the private
 * reader and the public writer, and a mistake in the guard could as easily
 * lock buyers out of the contact form as let strangers read it.
 */

const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

let rowsRead = 0;
let rowsWritten = 0;

function fakeSql(strings) {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  if (/^\s*CREATE|^\s*ALTER/i.test(q.trim())) return Promise.resolve([]);
  if (/INSERT INTO inquiries/i.test(q)) { rowsWritten += 1; return Promise.resolve([]); }
  if (/FROM inquiries/i.test(q)) {
    rowsRead += 1;
    return Promise.resolve([{ id: 1, created_at: '2026-09-07T00:00:00.000Z', name: 'A Buyer',
      email: 'buyer@example.test', company: 'Example Trading', country: 'Egypt', phone: null,
      product_interest: null, estimated_volume: null, request_type: 'Quote Request',
      message: 'Please quote 2 containers.', source_page: '/contact' }]);
  }
  if (/count\(/i.test(q)) return Promise.resolve([{ n: 0 }]);
  return Promise.resolve([]);
}
fakeSql.query = () => Promise.resolve([]);

const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
require.cache[neonId].filename = neonId;
require.cache[neonId].loaded = true;
require.cache[neonId].exports = { neon: () => fakeSql };

const ADMIN_SECRET = 'admin-secret-not-a-real-one';
const CRM_SECRET = 'crm-secret-not-a-real-one';
process.env.DATABASE_URL = 'postgres://stub';
process.env.SESSION_SECRET = ADMIN_SECRET;
process.env.CRM_SESSION_SECRET = CRM_SECRET;

const lib = require(path.join(FN, '_lib.js'));
const crmLib = require(path.join(FN, '_crm_lib.js'));
const inquiries = require(path.join(FN, 'inquiries.js'));

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : extra)}`);
};

const adminCookie = `${lib.COOKIE_NAME}=${lib.signSession('owner', ADMIN_SECRET)}`;
const crmCookie = `${crmLib.CRM_COOKIE_NAME}=${crmLib.signSession('staff', CRM_SECRET)}`;

function get(cookie) {
  return inquiries.handler({
    httpMethod: 'GET',
    headers: cookie ? { cookie } : {},
    queryStringParameters: {},
  });
}

(async () => {
  // ---- accepted --------------------------------------------------------
  for (const [label, cookie] of [['the site owner', adminCookie], ['CRM staff', crmCookie]]) {
    const before = rowsRead;
    const res = await get(cookie);
    const body = JSON.parse(res.body);
    t(`${label} can read enquiries`, res.statusCode === 200 && Array.isArray(body), res.statusCode);
    t('   and the query actually ran', rowsRead === before + 1);
    t('   the response is marked private, never cached', /no-store/.test(res.headers['Cache-Control'] || ''), res.headers['Cache-Control']);
  }

  // ---- refused, before touching the table ------------------------------
  const forgedAdmin = `${lib.COOKIE_NAME}=${lib.signSession('owner', 'the-wrong-secret')}`;
  const forgedCrm = `${crmLib.CRM_COOKIE_NAME}=${crmLib.signSession('staff', 'the-wrong-secret')}`;

  for (const [label, cookie] of [
    ['no cookie at all', null],
    ['an empty cookie', ''],
    ['a junk cookie', 'tc_session=not-a-token'],
    ['an admin token signed with the wrong secret', forgedAdmin],
    ['a CRM token signed with the wrong secret', forgedCrm],
    ['a CRM token presented in the admin cookie', `${lib.COOKIE_NAME}=${crmLib.signSession('staff', CRM_SECRET)}`],
  ]) {
    const before = rowsRead;
    const res = await get(cookie);
    t(`refused: ${label}`, res.statusCode === 401, res.statusCode);
    t('   and no row was read', rowsRead === before, rowsRead - before);
  }

  // ---- the public half must stay public --------------------------------
  //
  // This endpoint is the private reader AND the writer every visitor uses.
  // A guard applied one line too high would silently close the contact form.
  {
    const before = rowsWritten;
    const res = await inquiries.handler({
      httpMethod: 'POST',
      headers: {},
      queryStringParameters: {},
      body: JSON.stringify({
        name: 'A Buyer', email: 'buyer@example.test', company: 'Example Trading',
        country: 'Egypt', message: 'Please quote two containers of Aggizi.',
        request_type: 'Quote Request',
      }),
    });
    t('a visitor with no session can still submit the contact form',
      res.statusCode === 200 && JSON.parse(res.body).ok === true, res.body);
    t('   and the enquiry was stored', rowsWritten === before + 1, rowsWritten - before);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail === 0 ? 0 : 1);
})().catch((err) => {
  console.error('check-inquiries-access CRASHED:', err && err.stack ? err.stack : err);
  process.exit(1);
});
