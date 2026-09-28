#!/usr/bin/env node
'use strict';

/*
 * A CRM session is never an analytics-admin session, and never the reverse.
 *
 *   node scripts/check-session-separation.js        (part of `npm test`)
 *
 * Both apps sign sessions with _lib.js's signSession, and CRM_SESSION_SECRET
 * falls back to SESSION_SECRET, the admin's key. Until 2026-09-28 the fallback
 * was used as-is, so with CRM_SESSION_SECRET unset -- or set to the same value
 * -- a CRM user could copy their cookie into the admin cookie and open the
 * analytics report, settings, KPI manager and visitor-data deletion (system
 * health audit, run 1, C2). The CRM now signs with a key derived from its
 * secret under a fixed label (_crm_lib.js crmSessionKey).
 *
 * This runs the real login, the real CRM endpoints and the real admin
 * endpoints under all three configurations the environment can be in, and
 * checks each token is accepted by its own app and refused by the other.
 */

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
const lib = require(path.join(FN, '_lib.js'));
const PASSWORD = 'correct horse battery staple';
const USER = { id: 1, username: 'staff', password_hash: lib.hashPassword(PASSWORD), display_name: 'Staff' };
const sql = (strings) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  return Promise.resolve(/FROM crm_users/i.test(q) && /SELECT/i.test(q) ? [USER] : []);
};
const neonId = require.resolve('@neondatabase/serverless');
require.cache[neonId] = new Module(neonId, null);
Object.assign(require.cache[neonId], { filename: neonId, loaded: true, exports: { neon: () => sql } });

const crm = require(path.join(FN, '_crm_lib.js'));
const load = (f) => require(path.join(FN, f)).handler;
const ADMIN_ENDPOINTS = ['analytics-report.js', 'analytics-settings.js', 'analytics-privacy.js', 'kpi-definitions.js', 'kpi-values.js', 'kpi-dashboard.js', 'analytics.js', 'auth-me.js'];
const CRM_ENDPOINTS = ['crm-buyers.js', 'crm-dashboard.js', 'crm-documents.js', 'crm-data-quality.js', 'crm-csv.js', 'crm-auth-me.js'];

const quiet = async (fn) => { const e = console.error, l = console.log; console.error = console.log = () => {}; try { return await fn(); } finally { console.error = e; console.log = l; } };
const get = (file, cookie) => quiet(() => load(file)({ httpMethod: 'GET', headers: { cookie }, queryStringParameters: {} }, {}));
const authed = (r) => r.statusCode !== 401 && r.statusCode !== 403 && !(r.body && /"authenticated":\s*false/.test(r.body));

const CONFIGS = [
  ['CRM_SESSION_SECRET unset (falls back to SESSION_SECRET)', { SESSION_SECRET: 'admin-secret-for-test-only-000000000000' }],
  ['CRM_SESSION_SECRET set to the SAME value as SESSION_SECRET', { SESSION_SECRET: 'same-secret-for-test-only-00000000000000', CRM_SESSION_SECRET: 'same-secret-for-test-only-00000000000000' }],
  ['CRM_SESSION_SECRET set to a different value', { SESSION_SECRET: 'admin-secret-for-test-only-000000000000', CRM_SESSION_SECRET: 'crm-secret-for-test-only-0000000000000000' }],
];

(async () => {
  for (const [label, env] of CONFIGS) {
    delete process.env.SESSION_SECRET; delete process.env.CRM_SESSION_SECRET;
    Object.assign(process.env, env);
    console.log(`\n-- ${label}`);

    // A CRM token exactly as the real login issues it.
    const login = await quiet(() => load('crm-auth-login.js')({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': '198.51.100.' + (pass + fail) },
      body: JSON.stringify({ username: 'staff', password: PASSWORD }) }, {}));
    const setCookie = String((login.headers && (login.headers['Set-Cookie'] || login.headers['set-cookie'])) || '');
    const crmToken = (setCookie.match(/tc_crm_session=([^;]+)/) || [])[1];
    t('the real CRM login issues a session', login.statusCode === 200 && !!crmToken, login.body);
    const adminToken = lib.signSession(process.env.ADMIN_USERNAME || 'owner', process.env.SESSION_SECRET);   // as auth-login.js signs it

    const crmOwn = await get('crm-buyers.js', `${crm.CRM_COOKIE_NAME}=${crmToken}`);
    t('   the CRM accepts its own session', crmOwn.statusCode === 200, crmOwn.statusCode);
    const adminOwn = await get('analytics-settings.js', `${lib.COOKIE_NAME}=${adminToken}`);
    t('   the admin dashboard accepts its own session', authed(adminOwn), adminOwn.statusCode);

    const crossedIn = [];
    for (const f of ADMIN_ENDPOINTS) if (authed(await get(f, `${lib.COOKIE_NAME}=${crmToken}`))) crossedIn.push(f);
    t(`   a CRM session placed in the admin cookie opens none of ${ADMIN_ENDPOINTS.length} admin endpoints`, crossedIn.length === 0, crossedIn.join(', '));
    const crossedOut = [];
    for (const f of CRM_ENDPOINTS) if (authed(await get(f, `${crm.CRM_COOKIE_NAME}=${adminToken}`))) crossedOut.push(f);
    t(`   an admin session placed in the CRM cookie opens none of ${CRM_ENDPOINTS.length} CRM endpoints`, crossedOut.length === 0, crossedOut.join(', '));
  }

  // The fix itself, so it cannot be quietly undone.
  const fs = require('fs');
  const libSrc = fs.readFileSync(path.join(FN, '_crm_lib.js'), 'utf8');
  const loginSrc = fs.readFileSync(path.join(FN, 'crm-auth-login.js'), 'utf8');
  t('the CRM key is derived under a fixed label, never used raw',
    /createHmac\('sha256', secret\)\.update\(CRM_KEY_LABEL\)/.test(libSrc) && !/getCrmSession\(event, process\.env/.test(libSrc));
  t('   and the login signs with it', /signCrmSession\(user\.username\)/.test(loginSrc) && !/signSession\(user\.username/.test(loginSrc));

  const ok = fail === 0;
  console.log(`\nsession-separation ${ok ? 'OK' : 'FAILED'} -- a CRM session is never an admin session, whatever is configured.`);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error('check-session-separation CRASHED:', e && e.stack ? e.stack : e); process.exit(1); });
