#!/usr/bin/env node
'use strict';

/*
 * Sign-in and password reset, release 1: every protection, against fakes.
 *
 *   node scripts/check-password-reset.js        (part of `npm test`)
 *
 * The real handlers (crm-auth-forgot, crm-auth-reset, crm-auth-change,
 * crm-auth-login, auth-login) run against an in-memory database with its own
 * clock, and a fake mailbox. No network, no real database, no real email:
 * the email library is replaced, and NOTIFY_DRY_RUN is set besides.
 *
 * scripts/check-password-reset-mutations.js runs this file again with each
 * protection removed in turn, and requires the matching check here to fail.
 * The SQL each fake method stands for was run against PostgreSQL 16 when this
 * was written (see the release-1 pull request).
 *
 * AUTH_FN_DIR points the suite at a copy of netlify/functions; the mutation
 * harness uses it. Nothing else should set it.
 */

const path = require('path');
const crypto = require('crypto');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
const FN = process.env.AUTH_FN_DIR || path.join(ROOT, 'netlify', 'functions');

process.env.DATABASE_URL = 'postgres://stub';
process.env.CRM_SESSION_SECRET = 'test-crm-secret-not-real';
process.env.SESSION_SECRET = 'test-admin-secret-not-real';
process.env.APP_BASE_URL = 'https://olivesegypt.example';
process.env.NOTIFY_DRY_RUN = '1';
delete process.env.RESEND_API_KEY;
delete process.env.DEPLOY_ENV;
delete process.env.ADMIN_FALLBACK_LOGIN;

// ---- capture every log line, to prove no token or password reaches one ----
const logged = [];
for (const k of ['log', 'error', 'warn', 'info']) {
  const orig = console[k].bind(console);
  console[k] = (...a) => { logged.push(a.map(String).join(' ')); if (k === 'log' && /^(PASS|FAIL)|passed,/.test(String(a[0]))) orig(...a); };
}
const out = (s) => process.stdout.write(s + '\n');

// ---- the Neon driver: never reached; the store is replaced below ----
const neonId = require.resolve('@neondatabase/serverless', { paths: [ROOT] });
require.cache[neonId] = Object.assign(new Module(neonId, null), {
  filename: neonId, loaded: true,
  exports: { neon: () => { const f = () => Promise.resolve([]); f.query = f; f.transaction = async () => []; return f; } },
});

const auth = require(path.join(FN, '_auth_lib.js'));
const emailLib = require(path.join(FN, '_email_lib.js'));
const { verifySession, parseCookies, COOKIE_NAME } = require(path.join(FN, '_lib.js'));
const crmLib = require(path.join(FN, '_crm_lib.js'));

auth.timing.floorMs = 150;
auth.timing.jitterMs = 0;
const sleeps = [];
auth.sleep = async (ms) => { sleeps.push(ms); };

// ---- the fake mailbox ----
let mail = [];
let notices = [];
const everyToken = [];
emailLib.sendEmail = async (to, subject, text, opts) => {
  mail.push({ to, subject, text, opts });
  const m = /#token=([A-Za-z0-9_-]+)/.exec(text || '');
  if (m) everyToken.push(m[1]);
  return true;
};
emailLib.sendNotification = async (subject, text) => { notices.push({ subject, text }); return true; };

// ---- the fake database ----
const everyAuditRow = [];
function makeStore() {
  const db = { now: Date.now(), users: [], resets: [], events: [], marker: null, ensured: 0, slow: 0 };
  const iso = () => new Date(db.now).toISOString();
  const delay = () => (db.slow ? new Promise((r) => setTimeout(r, db.slow)) : Promise.resolve());
  const store = {
    db,
    async readMarker() { return db.marker; },
    async ensureSchema() { db.ensured++; },
    async userByUsername(u) { await delay(); return db.users.find((x) => x.username === u) || null; },
    async userById(id) { return db.users.find((x) => x.id === id) || null; },
    async countEvents({ app, events, minutes, ipHash = null, userId = null }) {
      return db.events.filter((e) => e.app === app && events.includes(e.event) && e.at > db.now - minutes * 60000 &&
        (ipHash == null || e.ipHash === ipHash) && (userId == null || e.userId === userId)).length;
    },
    async recordEvent(row) { db.events.push({ ...row, at: db.now }); everyAuditRow.push(row); },
    async issueResetToken({ userId, tokenHash, ipHash, minutes }) {
      await delay();
      db.resets.filter((r) => r.userId === userId && !r.usedAt && !r.invalidatedAt).forEach((r) => { r.invalidatedAt = db.now; });
      db.resets.push({ id: db.resets.length + 1, userId, tokenHash, ipHash, expiresAt: db.now + minutes * 60000, usedAt: null, invalidatedAt: null });
    },
    async activeReset(h) {
      const r = db.resets.find((x) => x.tokenHash === h && !x.usedAt && !x.invalidatedAt && x.expiresAt > db.now);
      return r ? { id: r.id, user_id: r.userId, token_hash: r.tokenHash } : null;
    },
    async completeReset({ resetId, passwordHash }) {
      const r = db.resets.find((x) => x.id === resetId && !x.usedAt && !x.invalidatedAt && x.expiresAt > db.now);
      if (!r) return false;
      r.usedAt = db.now;
      const u = db.users.find((x) => x.id === r.userId);
      Object.assign(u, { password_hash: passwordHash, password_changed_at: iso(), must_change_password: false, session_version: u.session_version + 1 });
      db.resets.filter((x) => x.userId === u.id && x.id !== resetId && !x.usedAt && !x.invalidatedAt).forEach((x) => { x.invalidatedAt = db.now; });
      return true;
    },
    async changePassword({ userId, passwordHash }) {
      const u = db.users.find((x) => x.id === userId);
      if (!u) return false;
      Object.assign(u, { password_hash: passwordHash, password_changed_at: iso(), must_change_password: false, session_version: u.session_version + 1 });
      db.resets.filter((x) => x.userId === userId && !x.usedAt && !x.invalidatedAt).forEach((x) => { x.invalidatedAt = db.now; });
      return true;
    },
    async rehash({ userId, oldHash, newHash }) {
      const u = db.users.find((x) => x.id === userId);
      if (u && u.password_hash === oldHash) u.password_hash = newHash;
    },
  };
  return store;
}

let store;
auth.createStore = () => store;

const OWNER_PW = 'a quiet orchard by the river';
const STAFF_PW = 'blue tractors in the morning';
async function fresh() {
  store = makeStore();
  auth.resetPreparedForTests();
  mail = []; notices = []; sleeps.length = 0;
  store.db.users.push(
    { id: 1, username: 'owner', display_name: 'Owner', email: 'owner.personal@example.com', password_hash: await auth.hashPassword(OWNER_PW), is_admin: true, session_version: 1, must_change_password: false },
    { id: 2, username: 'staff', display_name: 'Staff', email: 'staff.person@example.com', password_hash: await auth.hashPassword(STAFF_PW), is_admin: false, session_version: 1, must_change_password: false },
    { id: 3, username: 'shared', display_name: 'Shared', email: 'sales@olivesegypt.com', password_hash: auth.DUMMY_HASH, is_admin: false, session_version: 1, must_change_password: false },
  );
}

const fn = (name) => require(path.join(FN, name + '.js')).handler;
const forgot = fn('crm-auth-forgot');
const reset = fn('crm-auth-reset');
const change = fn('crm-auth-change');
const crmLogin = fn('crm-auth-login');
const adminLogin = fn('auth-login');

let ipCounter = 0;
const ev = (body, headers) => ({ httpMethod: 'POST', headers: { 'x-nf-client-connection-ip': `198.51.100.${(ipCounter++ % 250) + 1}`, ...(headers || {}) }, body: JSON.stringify(body) });
const call = async (h, body, headers) => {
  const r = await h(ev(body, headers));
  return { status: r.statusCode, headers: r.headers || {}, data: JSON.parse(r.body || '{}') };
};
const tokenFromMail = (m) => { const x = /#token=([A-Za-z0-9_-]+)/.exec(m.text); return x ? x[1] : null; };

let pass = 0, fail = 0;
const failed = [];
function t(name, cond, extra) {
  if (cond) pass++; else { fail++; failed.push(name); }
  out(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '   <-- ' + (extra === undefined ? '' : String(extra).slice(0, 300))}`);
}

(async () => {
  // ---------------------------------------------------------------- hashing
  await fresh();
  const h = await auth.hashPassword('x'.repeat(12));
  t('[hash] new hashes use scrypt N=32768 r=8 p=3', /^scrypt2\$32768\$8\$3\$[0-9a-f]{32}\$[0-9a-f]{64}$/.test(h), h);
  t('[hash] a correct password verifies, a wrong one does not',
    (await auth.verifyPassword('x'.repeat(12), h)).ok && !(await auth.verifyPassword('y'.repeat(12), h)).ok);
  const legacy = (() => { const salt = crypto.randomBytes(16); return `scrypt:${salt.toString('hex')}:${crypto.scryptSync('old password here', salt, 32).toString('hex')}`; })();
  const lv = await auth.verifyPassword('old password here', legacy);
  t('[hash] an old-format hash still verifies and is marked for upgrade', lv.ok && lv.needsRehash);
  // The cost settings are proven above; the rest of the suite hashes cheaply.
  auth.HASH.N = 1024; auth.HASH.p = 1;

  // ---------------------------------------------------------- password rules
  t('[rules] fewer than 12 characters is refused', /at least 12/.test(auth.passwordProblem('short pass', 'owner') || ''));
  t('[rules] more than 128 characters is refused', /at most 128/.test(auth.passwordProblem('a'.repeat(60) + 'b'.repeat(69), 'owner') || ''));
  t('[rules] a common password is refused', /common/.test(auth.passwordProblem('qwerty123456', 'owner') || ''));
  t('[rules] the username inside the password is refused', /username/.test(auth.passwordProblem('my-owner-account-9', 'owner') || ''));
  t('[rules] a site word padded with digits is refused', /easy/.test(auth.passwordProblem('Olivesegypt2026!', 'owner') || ''));
  t('[rules] a long ordinary sentence is accepted', auth.passwordProblem('the river is low in august', 'owner') === null);

  // ------------------------------------------------- forgot: no enumeration
  await fresh();
  store.db.slow = 120; // the real path writes and mails; the fake makes that slow
  let s0 = Date.now(); const known = await call(forgot, { username: 'owner' }); const tKnown = Date.now() - s0;
  s0 = Date.now(); const unknown = await call(forgot, { username: 'nobody-here' }); const tUnknown = Date.now() - s0;
  store.db.slow = 0;
  t('[enumeration] same status and words for a real and a missing account',
    known.status === unknown.status && JSON.stringify(known.data) === JSON.stringify(unknown.data), JSON.stringify([known, unknown]));
  t('[enumeration] similar timing: both answers take at least the floor',
    tKnown >= auth.timing.floorMs && tUnknown >= auth.timing.floorMs && Math.abs(tKnown - tUnknown) < 200, `${tKnown}ms vs ${tUnknown}ms`);
  t('[enumeration] the shared-mailbox account gets the same answer and no email',
    JSON.stringify((await call(forgot, { username: 'shared' })).data) === JSON.stringify(known.data) && !mail.some((m) => m.to === 'sales@olivesegypt.com'));

  // ---------------------------------------------------------- forgot: email
  await fresh();
  await call(forgot, { username: 'owner' }, { host: 'evil.example', 'x-forwarded-host': 'evil.example', origin: 'https://evil.example' });
  const m1 = mail[0];
  t('[email] the reset link goes to the account\'s own address only', mail.length === 1 && m1.to === 'owner.personal@example.com', JSON.stringify(mail.map((m) => m.to)));
  t('[host] the link is built from APP_BASE_URL; a spoofed Host header is ignored',
    m1 && m1.text.includes('https://olivesegypt.example/crm/reset-password/#token=') && !m1.text.includes('evil.example'), m1 && m1.text);
  t('[email] it says the time limit and "ignore this if it wasn\'t you", with no password', m1 && /30 minutes/.test(m1.text) && /wasn't you/.test(m1.text) && !/password is/i.test(m1.text));
  const tok1 = m1 && tokenFromMail(m1);
  t('[token] 256 random bits, base64url', !!tok1 && tok1.length === 43);
  t('[token] only its SHA-256 is stored, never the token', store.db.resets.length === 1 && store.db.resets[0].tokenHash === auth.tokenHash(tok1) && store.db.resets[0].tokenHash !== tok1);

  await fresh();
  process.env.APP_BASE_URL = 'http://olivesegypt.example';
  await call(forgot, { username: 'owner' });
  t('[host] an http:// base address sends no email (https only)', mail.length === 0);
  process.env.APP_BASE_URL = 'https://olivesegypt.example';

  await fresh();
  await call(forgot, { username: 'shared' });
  t('[email] a role mailbox (sales@) never receives a reset link', mail.length === 0 && store.db.events.some((e) => e.detail === 'shared_mailbox'));
  t('[email] NOTIFY_EMAIL membership alone does not block an address',
    (process.env.NOTIFY_EMAIL = 'owner.personal@example.com', await call(forgot, { username: 'owner' }), mail.length === 1));
  delete process.env.NOTIFY_EMAIL;

  // ----------------------------------------------------------- reset: token
  await fresh();
  await call(forgot, { username: 'owner' });
  let tok = tokenFromMail(mail[0]);
  store.db.now += 31 * 60000;
  let r = await call(reset, { token: tok, new_password: 'a fresh phrase for today', confirm_password: 'a fresh phrase for today' });
  t('[expiry] a link older than 30 minutes is refused', r.status === 400 && /expired/.test(r.data.error), JSON.stringify(r));

  await fresh();
  await call(forgot, { username: 'owner' });
  tok = tokenFromMail(mail[0]);
  store.db.now += 29 * 60000;
  r = await call(reset, { token: tok, new_password: 'a fresh phrase for today', confirm_password: 'a fresh phrase for today' });
  t('[expiry] the same link at 29 minutes works', r.status === 200 && r.data.ok, JSON.stringify(r));
  const owner = store.db.users[0];
  t('[sessions] success raises the account\'s session number (signs it out everywhere)', owner.session_version === 2);
  t('[success] the new password verifies with today\'s settings', (await auth.verifyPassword('a fresh phrase for today', owner.password_hash)).ok && owner.password_hash.startsWith('scrypt2$'));
  t('[success] no automatic sign-in: no cookie is set', !r.headers['Set-Cookie']);
  t('[success] a "password changed" email goes to the account', mail.some((m) => /was changed/.test(m.subject) && m.to === 'owner.personal@example.com'));
  t('[audit] a reset_completed row is written', store.db.events.some((e) => e.event === 'reset_completed' && e.userId === 1));
  r = await call(reset, { token: tok, new_password: 'another phrase entirely here', confirm_password: 'another phrase entirely here' });
  t('[reuse] the same link a second time is refused', r.status === 400 && owner.session_version === 2, JSON.stringify(r));

  await fresh();
  await call(forgot, { username: 'owner' });
  r = await call(reset, { token: auth.newResetToken().token, new_password: 'a fresh phrase for today', confirm_password: 'a fresh phrase for today' });
  t('[wrong token] a well-formed but wrong token is refused', r.status === 400 && store.db.users[0].session_version === 1, JSON.stringify(r));
  r = await call(reset, { token: 'abc', new_password: 'a fresh phrase for today', confirm_password: 'a fresh phrase for today' });
  t('[wrong token] a malformed token is refused', r.status === 400);

  await fresh();
  await call(forgot, { username: 'owner' });
  const first = tokenFromMail(mail[0]);
  await call(forgot, { username: 'owner' });
  r = await call(reset, { token: first, new_password: 'a fresh phrase for today', confirm_password: 'a fresh phrase for today' });
  t('[supersede] a new request cancels the earlier link', r.status === 400, JSON.stringify(r));

  await fresh();
  await call(forgot, { username: 'owner' });
  tok = tokenFromMail(mail[0]);
  r = await call(reset, { token: tok, new_password: 'a fresh phrase for today', confirm_password: 'a different phrase here' });
  t('[confirm] mismatched confirmation is refused and the link stays usable', r.status === 400 && /match/.test(r.data.error) && store.db.resets[0].usedAt === null);
  r = await call(reset, { token: tok, new_password: 'qwerty123456', confirm_password: 'qwerty123456' });
  t('[rules] a common password is refused at reset and the link stays usable', r.status === 400 && /common/.test(r.data.error) && store.db.resets[0].usedAt === null);

  // ------------------------------------------------------------ rate limits
  await fresh();
  const sameIp = { 'x-nf-client-connection-ip': '203.0.113.7' };
  for (let i = 0; i < 5; i++) await (async () => { const e = ev({ username: 'owner' }); e.headers = { ...e.headers, ...sameIp }; await forgot(e); })();
  const before = mail.length;
  { const e = ev({ username: 'staff' }); e.headers = { ...e.headers, ...sameIp }; const rr = await forgot(e); t('[rate] the 6th request from one IP in 15 minutes is answered the same', JSON.parse(rr.body).ok === true); }
  t('[rate] and sends nothing (per-IP limit 5 per 15 minutes)', mail.length === before && store.db.events.some((e) => e.event === 'reset_throttled' && e.detail === 'per_ip'));

  await fresh();
  for (let i = 0; i < 3; i++) await call(forgot, { username: 'owner' });
  const sent3 = mail.length;
  await call(forgot, { username: 'owner' });
  t('[rate] the 4th request for one account in an hour sends nothing (3 per hour)', sent3 === 3 && mail.length === 3, `${sent3} then ${mail.length}`);

  await fresh();
  const xffIp = { 'x-nf-client-connection-ip': '203.0.113.9' };
  for (let i = 0; i < 5; i++) { const e = ev({ username: 'nobody' }); e.headers = { ...xffIp, 'x-forwarded-for': `10.0.0.${i}` }; await forgot(e); }
  { const e = ev({ username: 'owner' }); e.headers = { ...xffIp, 'x-forwarded-for': '10.9.9.9' }; await forgot(e); }
  t('[ip] a changing X-Forwarded-For does not escape the limit (Netlify\'s header only)', mail.length === 0);

  await fresh();
  for (let i = 0; i < 10; i++) { const e = ev({ token: auth.newResetToken().token, new_password: 'x', confirm_password: 'x' }); e.headers = { 'x-nf-client-connection-ip': '203.0.113.20' }; await reset(e); }
  { const e = ev({ token: auth.newResetToken().token, new_password: 'x', confirm_password: 'x' }); e.headers = { 'x-nf-client-connection-ip': '203.0.113.20' }; const rr = await reset(e); t('[rate] reset-page submits: the 11th failure from one IP gets 429', rr.statusCode === 429, rr.statusCode); }

  await fresh();
  for (let i = 0; i < 10; i++) { const e = ev({ username: 'owner', password: 'wrong password number ' + i }); e.headers = { 'x-nf-client-connection-ip': '203.0.113.30' }; await crmLogin(e); }
  { const e = ev({ username: 'owner', password: OWNER_PW }); e.headers = { 'x-nf-client-connection-ip': '203.0.113.30' }; const rr = await crmLogin(e); t('[rate] sign-in: the 11th attempt from one IP gets 429', rr.statusCode === 429, rr.statusCode); }
  t('[alert] 10 failures on one account email the owner once', notices.length === 1, notices.length);
  { const e = ev({ username: 'owner', password: 'still wrong' }); e.headers = { 'x-nf-client-connection-ip': '203.0.113.31' }; await crmLogin(e); }
  t('[slow] an account with 10 recent failures is slowed, not locked', sleeps.includes(2000));
  t('[alert] at most one alert an hour', notices.length === 1, notices.length);

  // ---------------------------------------------------- sign-in and sessions
  await fresh();
  r = await call(crmLogin, { username: 'owner', password: OWNER_PW });
  const crmCookie = (r.headers['Set-Cookie'] || '').split(';')[0];
  const crmTok = crmCookie.split('=')[1];
  const crmPayload = crmTok && verifySession(crmTok, crmLib.crmSessionKey());
  t('[session] CRM sign-in carries the account id and session number', r.data.ok && crmPayload && crmPayload.uid === 1 && crmPayload.sv === 1, JSON.stringify(crmPayload));
  t('[cookie] CRM cookie is HttpOnly, Secure, SameSite=Lax', /HttpOnly/.test(r.headers['Set-Cookie']) && /Secure/.test(r.headers['Set-Cookie']) && /SameSite=Lax/.test(r.headers['Set-Cookie']));
  r = await call(crmLogin, { username: 'nobody', password: OWNER_PW });
  const rWrong = await call(crmLogin, { username: 'owner', password: 'not the right one at all' });
  t('[enumeration] sign-in gives the same answer for a missing user and a wrong password', r.data.error === rWrong.data.error && r.status === rWrong.status);

  await fresh();
  store.db.users[0].password_hash = legacy;
  r = await call(crmLogin, { username: 'owner', password: 'old password here' });
  t('[hash] an old hash is upgraded at the next sign-in', r.data.ok && store.db.users[0].password_hash.startsWith('scrypt2$'));

  await fresh();
  store.db.users[0].must_change_password = true;
  r = await call(crmLogin, { username: 'owner', password: OWNER_PW });
  const mcCookie = (r.headers['Set-Cookie'] || '').split(';')[0];
  t('[must change] sign-in says so', r.data.ok && r.data.must_change === true);
  t('[must change] that session opens no CRM endpoint', crmLib.requireCrmSession({ headers: { cookie: mcCookie } }) === null);
  r = await (async () => { const e = ev({ current_password: OWNER_PW, new_password: 'a brand new long phrase', confirm_password: 'a brand new long phrase' }); e.headers.cookie = mcCookie; const x = await change(e); return { status: x.statusCode, data: JSON.parse(x.body), headers: x.headers }; })();
  t('[must change] but it can change the password', r.status === 200 && r.data.ok && store.db.users[0].must_change_password === false, JSON.stringify(r.data));
  t('[change] changing signs the account out everywhere and clears this cookie', store.db.users[0].session_version === 2 && /Max-Age=0/.test(r.headers['Set-Cookie'] || ''));

  // ------------------------------------------------------------- analytics
  await fresh();
  r = await call(adminLogin, { username: 'owner', password: OWNER_PW });
  const admCookie = (r.headers['Set-Cookie'] || '').split(';')[0];
  const admPayload = verifySession(parseCookies({ cookie: admCookie })[COOKIE_NAME], process.env.SESSION_SECRET);
  t('[analytics] a CRM admin account opens analytics', r.data.ok && admPayload && admPayload.adm === 1 && admPayload.uid === 1, JSON.stringify(r.data));
  r = await call(adminLogin, { username: 'staff', password: STAFF_PW });
  t('[analytics] a CRM account without admin is refused', r.data.ok === false && !r.headers['Set-Cookie'], JSON.stringify(r.data));
  process.env.ADMIN_USERNAME = 'legacyadmin';
  process.env.ADMIN_PASSWORD_HASH = await auth.hashPassword('legacy fallback password');
  r = await call(adminLogin, { username: 'legacyadmin', password: 'legacy fallback password' });
  t('[fallback] the old Netlify-settings login is refused while ADMIN_FALLBACK_LOGIN is off', r.data.ok === false, JSON.stringify(r.data));
  process.env.ADMIN_FALLBACK_LOGIN = 'on';
  notices = [];
  r = await call(adminLogin, { username: 'legacyadmin', password: 'legacy fallback password' });
  t('[fallback] it works when switched on, and emails the owner', r.data.ok === true && notices.length === 1, JSON.stringify(r.data));
  delete process.env.ADMIN_FALLBACK_LOGIN;

  // --------------------------------------------------------- database guard
  await fresh();
  process.env.DEPLOY_ENV = 'staging';
  r = await call(forgot, { username: 'owner' });
  t('[guard] a staging deploy on an unlabelled database changes nothing', r.status === 503 && store.db.ensured === 0 && mail.length === 0);
  store.db.marker = 'staging';
  auth.resetPreparedForTests();
  r = await call(forgot, { username: 'owner' });
  t('[guard] a staging deploy on the staging-labelled database works', r.status === 200 && store.db.ensured === 1);
  delete process.env.DEPLOY_ENV;
  auth.resetPreparedForTests();
  store.db.ensured = 0;
  r = await call(crmLogin, { username: 'owner', password: OWNER_PW });
  t('[guard] a production deploy on the staging-labelled database is refused', r.status === 503 && store.db.ensured === 0);

  // ---------------------------------------------------------------- logs
  const leaked = logged.filter((l) => everyToken.some((tk) => l.includes(tk)));
  t('[logs] none of the ' + everyToken.length + ' reset tokens mailed in this run appears in any log line', everyToken.length > 5 && leaked.length === 0, leaked[0]);
  const auditText = JSON.stringify(everyAuditRow);
  t('[logs] no token in any of the ' + everyAuditRow.length + ' audit rows written in this run', everyAuditRow.length > 20 && !everyToken.some((tk) => auditText.includes(tk)));
  const pwLeak = logged.filter((l) => [OWNER_PW, STAFF_PW, 'a fresh phrase for today', 'a brand new long phrase', 'legacy fallback password'].some((p) => l.includes(p)));
  t('[logs] no password appears in any log line', pwLeak.length === 0, pwLeak[0]);

  out(`\n${pass} passed, ${fail} failed`);
  if (process.env.AUTH_REPORT_FAILED) out('FAILED_NAMES ' + JSON.stringify(failed));
  process.exit(fail ? 1 : 0);
})().catch((e) => { out('ERROR ' + (e && e.stack || e)); process.exit(1); });
