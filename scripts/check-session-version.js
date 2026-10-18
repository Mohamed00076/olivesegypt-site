#!/usr/bin/env node
'use strict';

/*
 * Password reset, release 2: a reset or password change ends every session.
 *
 *   node scripts/check-session-version.js        (part of `npm test`)
 *
 * Every function that reads a session now checks it against its account
 * (netlify/functions/_sessions.js). This calls each of those endpoints, for
 * real, with every kind of session that must be refused -- none, one issued
 * before release 1, one whose session number is out of date, one for a
 * deleted or renamed account, and on the analytics endpoints one for an
 * account that is not admin -- and with a current session, which must be
 * accepted (otherwise "refused" would prove nothing).
 *
 * The account lookup is the real one, against a stand-in for the Neon driver
 * that answers only that one query; every other query gets no rows.
 *
 * Last, it reads the functions folder: any function that checks a session
 * without _sessions.js, or a gated function this list does not call, fails.
 *
 * The protections themselves are proven by
 * scripts/check-session-version-mutations.js.
 */

const fs = require('fs');
const path = require('path');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = process.env.SESSION_FN_DIR || path.join(ROOT, 'netlify', 'functions');

let pass = 0, fail = 0;
const failed = [];
const t = (name, cond, extra) => {
  if (cond) pass++; else { fail++; failed.push(name); }
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : String(extra).slice(0, 300))}`);
};

Object.assign(process.env, {
  DATABASE_URL: 'postgres://stub',
  SESSION_SECRET: 'test-admin-secret-not-real-000000000000',
  CRM_SESSION_SECRET: 'test-crm-secret-not-real-0000000000000',
  ADMIN_USERNAME: 'legacyadmin',
  NOTIFY_DRY_RUN: '1',
});
delete process.env.ADMIN_FALLBACK_LOGIN;
delete process.env.RESEND_API_KEY;

// ---- accounts, as crm_users holds them ----
const ACCOUNTS = new Map();
function resetAccounts() {
  ACCOUNTS.clear();
  ACCOUNTS.set(1, { username: 'staff', session_version: 3, is_admin: false, must_change_password: false });
  ACCOUNTS.set(2, { username: 'owner', session_version: 5, is_admin: true, must_change_password: false });
}
let dbDown = false;
const accountQueries = [];

// ---- the Neon driver: answers the account lookup; nothing else has rows ----
const sql = (strings, ...values) => {
  const q = Array.isArray(strings) ? strings.join('?') : String(strings);
  if (/FROM crm_users WHERE id = \?/.test(q)) {
    accountQueries.push(values[0]);
    if (dbDown) return Promise.reject(new Error('Error connecting to database: fetch failed'));
    const a = ACCOUNTS.get(values[0]);
    return Promise.resolve(a ? [{ ...a }] : []);
  }
  // change-password then loads the account by name (and finds its password wrong)
  if (/FROM crm_users WHERE username = \?/.test(q)) {
    const hit = [...ACCOUNTS].find(([, a]) => a.username === values[0]);
    return Promise.resolve(hit ? [{ id: hit[0], ...hit[1], password_hash: 'scrypt:00:00' }] : []);
  }
  return Promise.resolve([]);
};
sql.query = sql;
sql.transaction = async () => [];
const neonId = require.resolve('@neondatabase/serverless', { paths: [ROOT] });
require.cache[neonId] = Object.assign(new Module(neonId, null), { filename: neonId, loaded: true, exports: { neon: () => sql } });

const quiet = async (fn) => {
  const l = console.log, e = console.error, w = console.warn;
  console.log = console.error = console.warn = () => {};
  try { return await fn(); } finally { console.log = l; console.error = e; console.warn = w; }
};

const lib = require(path.join(FN, '_lib.js'));
const crm = require(path.join(FN, '_crm_lib.js'));
const { _resetThrottle } = require(path.join(FN, '_failure_lib.js'));

// ---- the endpoints, and a request that reaches each one's gate ----
const CRM = [
  ['crm-activity.js', 'GET'], ['crm-auth-me.js', 'GET'], ['crm-buyers.js', 'GET'], ['crm-csv.js', 'GET'],
  ['crm-dashboard.js', 'GET'], ['crm-data-quality.js', 'GET'], ['crm-documents.js', 'GET'],
  ['crm-auth-change.js', 'POST', { current_password: 'x', new_password: 'y', confirm_password: 'y' }],
  ['inquiries.js', 'DELETE', null, { id: '1' }], ['leads.js', 'DELETE', null, { id: '1' }],
];
const ADMIN = [
  ['analytics.js', 'GET'], ['analytics-privacy.js', 'GET'], ['analytics-report.js', 'GET'],
  ['analytics-settings.js', 'GET'], ['auth-me.js', 'GET'], ['consent.js', 'GET'],
  ['kpi-dashboard.js', 'GET'], ['kpi-definitions.js', 'GET'], ['kpi-values.js', 'GET'],
  ['unsubscribe.js', 'GET', null, { list: '1' }],
];
const READER = [['inquiries.js', 'GET'], ['leads.js', 'GET']];   // either app's session

const call = (spec, cookie) => {
  const [file, method, body, qs] = spec;
  const headers = { 'x-nf-client-connection-ip': '198.51.100.9' };
  if (cookie) headers.cookie = cookie;
  return quiet(() => require(path.join(FN, file)).handler({
    httpMethod: method, headers, queryStringParameters: qs || {}, body: body ? JSON.stringify(body) : null,
  }, {}));
};
// Refused: 401/403, or auth-me's "not signed in" answer.
const refused = (r) => r.statusCode === 401 || r.statusCode === 403 || /"authenticated":\s*false/.test(r.body || '');

const crmCookie = (sub, claims) => `${crm.CRM_COOKIE_NAME}=${crm.signCrmSession(sub, claims)}`;
const adminCookie = (sub, claims) => `${lib.COOKIE_NAME}=${lib.signSession(sub, process.env.SESSION_SECRET, claims)}`;

let section = '';
async function matrix(label, specs, cookie, expectAccepted) {
  const wrong = [];
  for (const spec of specs) {
    _resetThrottle();
    const r = await call(spec, typeof cookie === 'function' ? cookie() : cookie);
    if (expectAccepted ? refused(r) : !refused(r)) wrong.push(`${spec[0]} ${spec[1]} -> ${r.statusCode}`);
  }
  t(`${section} ${label} (${specs.length} endpoints)`, wrong.length === 0, wrong.join('; '));
}

(async () => {
  resetAccounts();
  const staffNow = { uid: 1, sv: 3 };
  const ownerNow = { uid: 2, sv: 5, adm: 1 };

  // ------------------------------------------------------------- CRM
  console.log('\n-- CRM endpoints (and deleting an enquiry or lead)'); section = '[crm]';
  await matrix('a current CRM session is accepted', CRM, crmCookie('staff', staffNow), true);
  await matrix('no session: refused', CRM, null, false);
  await matrix('a session issued before release 1 (no account id or session number): refused', CRM, crmCookie('staff'), false);
  await matrix('an old session (its session number is out of date after a reset): refused', CRM, crmCookie('staff', { uid: 1, sv: 2 }), false);
  await matrix('a session from the future (a session number the account never had): refused', CRM, crmCookie('staff', { uid: 1, sv: 4 }), false);
  await matrix('a session whose account was deleted: refused', CRM, crmCookie('ghost', { uid: 99, sv: 1 }), false);
  await matrix('a session naming another account than its id: refused', CRM, crmCookie('owner', { uid: 1, sv: 3 }), false);
  const mustChange = CRM.filter((s) => s[0] !== 'crm-auth-change.js');
  await matrix('a "must change password" session opens nothing but change-password', mustChange, crmCookie('staff', { ...staffNow, mc: 1 }), false);
  await matrix('   and does open change-password', CRM.filter((s) => s[0] === 'crm-auth-change.js'), crmCookie('staff', { ...staffNow, mc: 1 }), true);
  ACCOUNTS.get(1).session_version = 4;   // a reset, as completeReset() does it
  await matrix('after a reset, the session issued before it is refused everywhere', CRM, crmCookie('staff', staffNow), false);
  resetAccounts();
  dbDown = true;
  await matrix('the account cannot be read (database down): refused, never waved through', CRM, crmCookie('staff', staffNow), false);
  dbDown = false;

  // ------------------------------------------------------------- analytics
  console.log('\n-- Analytics (admin) endpoints'); section = '[admin]';
  await matrix('a current admin session is accepted', ADMIN, adminCookie('owner', ownerNow), true);
  await matrix('no session: refused', ADMIN, null, false);
  await matrix('a session issued before release 1 (the old Netlify-settings login): refused', ADMIN, adminCookie('owner'), false);
  await matrix('an old session (session number out of date): refused', ADMIN, adminCookie('owner', { uid: 2, sv: 4, adm: 1 }), false);
  await matrix('a non-admin account\'s session: refused', ADMIN, adminCookie('staff', { uid: 1, sv: 3, adm: 1 }), false);
  await matrix('   also without the admin mark', ADMIN, adminCookie('staff', { uid: 1, sv: 3 }), false);
  await matrix('a CRM session placed in the analytics cookie: refused', ADMIN, `${lib.COOKIE_NAME}=${crm.signCrmSession('owner', ownerNow)}`, false);
  ACCOUNTS.get(2).is_admin = false;
  await matrix('admin access removed from the account: its session is refused at once', ADMIN, adminCookie('owner', ownerNow), false);
  resetAccounts();
  ACCOUNTS.get(2).must_change_password = true;
  await matrix('the account must change its password first: refused', ADMIN, adminCookie('owner', ownerNow), false);
  resetAccounts();
  await matrix('the emergency fallback session while ADMIN_FALLBACK_LOGIN is off: refused', ADMIN, adminCookie('legacyadmin', { fb: 1 }), false);
  process.env.ADMIN_FALLBACK_LOGIN = 'on';
  await matrix('   accepted while it is on', ADMIN, adminCookie('legacyadmin', { fb: 1 }), true);
  await matrix('   but only for ADMIN_USERNAME', ADMIN, adminCookie('owner', { fb: 1 }), false);
  delete process.env.ADMIN_FALLBACK_LOGIN;
  dbDown = true;
  await matrix('the account cannot be read (database down): refused', ADMIN, adminCookie('owner', ownerNow), false);
  dbDown = false;

  // ------------------------------------------------------------- readers
  console.log('\n-- Enquiries and leads (read from either app)'); section = '[reader]';
  await matrix('a current CRM session reads them', READER, crmCookie('staff', staffNow), true);
  await matrix('a current admin session reads them', READER, adminCookie('owner', ownerNow), true);
  await matrix('no session: refused', READER, null, false);
  await matrix('an old CRM session: refused', READER, crmCookie('staff', { uid: 1, sv: 2 }), false);
  await matrix('an old admin session: refused', READER, adminCookie('owner', { uid: 2, sv: 4, adm: 1 }), false);
  await matrix('a non-admin account\'s analytics session: refused', READER, adminCookie('staff', { uid: 1, sv: 3, adm: 1 }), false);

  // ------------------------------------------------------------- the lookup
  accountQueries.length = 0;
  await call(CRM[0], crmCookie('staff', staffNow));
  t('the check reads the account by the id the session carries', accountQueries.length === 1 && accountQueries[0] === 1, JSON.stringify(accountQueries));

  // ------------------------------------------------------------- coverage
  console.log('\n-- Every function that reads a session uses the checked gate');
  const ALLOWED_DIRECT = {
    '_sessions.js': 'the checked gate itself',
    '_crm_lib.js': 'defines the signed-cookie layer _sessions.js builds on',
    '_lib.js': 'defines verifySession',
    '_guide_token.js': 'guide-download tokens, not sessions',
  };
  const files = fs.readdirSync(FN).filter((f) => /\.(m?js)$/.test(f));
  const direct = [];
  for (const f of files) {
    if (ALLOWED_DIRECT[f]) continue;
    const src = fs.readFileSync(path.join(FN, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
    if (/\b(requireCrmSession|getCrmSession|verifySession)\s*\(/.test(src)) direct.push(f);
  }
  t('no function checks a session without _sessions.js', direct.length === 0, direct.join(', '));
  const gated = files.filter((f) => f !== '_sessions.js' && /require\('\.\/_sessions'\)/.test(fs.readFileSync(path.join(FN, f), 'utf8')));
  const tested = new Set([...CRM, ...ADMIN, ...READER].map((s) => s[0]).concat(['_crm_lib.js']));
  const untested = gated.filter((f) => !tested.has(f));
  t(`every gated function (${gated.length}) is called by this check`, gated.length >= 21 && untested.length === 0, 'not called: ' + untested.join(', '));

  console.log(`\n${pass} passed, ${fail} failed`);
  if (process.env.SESSION_REPORT_FAILED) console.log('FAILED_NAMES ' + JSON.stringify(failed));
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.log('ERROR ' + (e && e.stack || e)); process.exit(1); });
