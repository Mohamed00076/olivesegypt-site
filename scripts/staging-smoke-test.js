#!/usr/bin/env node
'use strict';

/*
 * Staging smoke test for sign-in and password reset (release 1). Run on your
 * own computer against the staging branch deploy, never the live site:
 *
 *   node scripts/staging-smoke-test.js <staging-base-url>
 *   node scripts/staging-smoke-test.js <staging-base-url> --send-one-email owner-test-2
 *
 * Needs Node.js 18 or later and nothing else (no npm install). It asks for
 * one thing, hidden: the password of the staging account "smoke-nonadmin"
 * (docs/staging-setup.md, step N5). Nothing is saved or sent anywhere but the
 * staging address.
 *
 * What it checks:
 *   1. noindex, no-store and no-referrer on the sign-in, forgot-password,
 *      reset and change-password pages (headers and the page's own tags)
 *   2. forgot-password: the same answer, and about the same time, for an
 *      account that exists (smoke-nonadmin) and one that does not
 *   3. forgot-password past its limit (5 per 15 minutes): still the same
 *      answer -- by design the limit is invisible from outside
 *   4. reset page: made-up links are refused, then 429 after 10 failures
 *   5. CRM sign-in: smoke-nonadmin signs in; then 429 after 10 attempts
 *   6. analytics sign-in: smoke-nonadmin is refused ("no access to
 *      analytics"); then 429 after 10 attempts
 *
 * It sends no email: smoke-nonadmin has no email address, so no reset link
 * is ever sent, and the other names it uses do not exist.
 *
 * --send-one-email <owner-test account> is the one exception, and only when
 * asked for: the 5th forgot-password request goes to that account instead of
 * a made-up name, so exactly one real reset email reaches its inbox, and its
 * response time is compared with the made-up-account times. Only the staging
 * test accounts owner-test and owner-test-2 are accepted. It is one of the
 * five forgot-password requests the run makes anyway, so the run still uses
 * five of the 5-per-15-minutes allowance, and one of that account's three
 * per hour. If no email arrives, the request was limited by an earlier run
 * and the timing it measured means nothing: wait 15 minutes and run again.
 *
 * Run it at most
 * twice an hour -- a third run in the same hour can add up to the
 * site-wide alert threshold and send one alert to NOTIFY_EMAIL.
 *
 * Afterwards it uses up your 15-minute allowance on the reset page and both
 * sign-ins. Wait 15 minutes before testing by hand; it prints the time.
 */

const crypto = require('crypto');
const { ask } = require('./_prompt');

const TEST_ACCOUNT = 'smoke-nonadmin';
const EMAIL_ACCOUNTS = /^owner-test(-2)?$/;   // the staging inbox accounts (docs/staging-setup.md N4)
const LIMIT_WINDOW_MINUTES = 15;
const PAGES = ['/crm/login/', '/crm/forgot-password/', '/crm/reset-password/', '/crm/change-password/'];
const TIMING_TOLERANCE_MS = 500;
const EMAIL_MARGIN_MS = 200;   // one email sample against the slowest of four; see checkForgot
const ANSWER_FLOOR_MS = 1400;   // the server pads every forgot-password answer to 1.5 s

// ---- 1. where it may run -----------------------------------------------------

// Allowed: a Netlify branch deploy or deploy preview (<name>--<site>.netlify.app)
// and this computer. Refused: olivesegypt.com, any of its subdomains, the
// site's own <site>.netlify.app address (that IS production), anything else.
function stagingTarget(raw) {
  let u;
  try { u = new URL(raw); } catch { return { error: `"${raw}" is not an address. Example: https://claude-auth-release-1--stirring-manatee-ca2643.netlify.app` }; }
  const host = u.hostname.toLowerCase().replace(/\.$/, '');
  if (host === 'olivesegypt.com' || host.endsWith('.olivesegypt.com')) {
    return { error: `REFUSED: ${host} is the live site. This test only runs against staging.` };
  }
  if (u.username || u.password) return { error: 'REFUSED: the address must not contain a user name or password.' };
  const local = host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
  if (local) return { origin: u.origin };
  if (u.protocol !== 'https:') return { error: 'REFUSED: use the https:// address.' };
  if (!/^[a-z0-9-]+--[a-z0-9-]+\.netlify\.app$/.test(host)) {
    return {
      error: /^[a-z0-9-]+\.netlify\.app$/.test(host)
        ? `REFUSED: ${host} is the site's production address on Netlify. Use the branch-deploy address, which has "--" in it.`
        : `REFUSED: ${host} is not a Netlify branch deploy or deploy preview (<name>--<site>.netlify.app).`,
    };
  }
  return { origin: u.origin };
}

// ---- results -----------------------------------------------------------------

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

// ---- requests ----------------------------------------------------------------

let ORIGIN;
async function request(method, path, body) {
  const started = Date.now();
  const res = await fetch(ORIGIN + path, {
    method,
    redirect: 'manual',
    headers: body ? { 'content-type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* an HTML page */ }
  return { status: res.status, headers: res.headers, text, data, ms: Date.now() - started };
}
const post = (path, body) => request('POST', path, body);

const randomName = () => 'smoke-no-such-user-' + crypto.randomBytes(4).toString('hex');
// Shaped exactly like a real reset code (43 base64url characters), so the
// server looks it up instead of rejecting its shape.
const randomToken = () => crypto.randomBytes(32).toString('base64url');
const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const summary = (r) => `${r.status} ${r.data ? JSON.stringify(r.data) : r.text.slice(0, 80)}`;

// A 503 here means the database guard refused: say what to fix.
function guardHint(r) {
  if (r.status === 503) {
    return 'the site answered "temporarily unavailable": check DEPLOY_ENV=staging for Branch deploys, the staging DATABASE_URL, and the deployment_marker row (docs/staging-setup.md N3, L2)';
  }
  return null;
}

// ---- the checks --------------------------------------------------------------

async function checkPages() {
  console.log('\n-- 1. Page headers');
  for (const p of PAGES) {
    const r = await request('GET', p);
    if (r.status !== 200) { check(`${p} loads`, false, `HTTP ${r.status}`); continue; }
    const robots = r.headers.get('x-robots-tag') || '';
    const cache = r.headers.get('cache-control') || '';
    const referrer = r.headers.get('referrer-policy') || '';
    check(`${p} noindex header`, /noindex/i.test(robots), `X-Robots-Tag: ${robots || 'missing'}`);
    check(`${p} no-store header`, /no-store/i.test(cache), `Cache-Control: ${cache || 'missing'}`);
    check(`${p} no-referrer header`, /^no-referrer$/i.test(referrer.trim()), `Referrer-Policy: ${referrer || 'missing'}`);
    check(`${p} noindex and no-referrer tags in the page`,
      /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(r.text) && /<meta\s+name="referrer"\s+content="no-referrer"/i.test(r.text));
  }
}

async function checkForgot(emailAccount) {
  console.log('\n-- 2. Forgot password: an existing account and a made-up one look the same');
  const real = [], fake = [];
  // Alternate, so a slow moment on the network does not land on one side only.
  for (let i = 0; i < 2; i++) {
    real.push(await post('/api/crm/auth/forgot', { username: TEST_ACCOUNT }));
    fake.push(await post('/api/crm/auth/forgot', { username: randomName() }));
  }
  const hint = guardHint(real[0]);
  if (hint) { check('forgot-password is available', false, hint); return false; }

  const all = real.concat(fake);
  const first = all[0];
  check('every answer is HTTP 200', all.every((r) => r.status === 200), all.map((r) => r.status).join(', '));
  check('every answer has the same words', all.every((r) => r.text === first.text), summary(first));
  check('the answer does not say whether the account exists',
    !!first.data && first.data.ok === true && /If that account exists/.test(first.data.message || ''));
  const headerNames = (r) => ['content-type', 'cache-control', 'x-robots-tag'].map((h) => `${h}=${r.headers.get(h)}`).join('; ');
  check('every answer has the same headers', all.every((r) => headerNames(r) === headerNames(first)), headerNames(first));
  check('the answer is not cached (no-store)', /no-store/i.test(first.headers.get('cache-control') || ''));
  const mr = median(real.map((r) => r.ms)), mf = median(fake.map((r) => r.ms));
  check(`similar timing (within ${TIMING_TOLERANCE_MS} ms)`, Math.abs(mr - mf) <= TIMING_TOLERANCE_MS,
    `existing: ${real.map((r) => r.ms).join(', ')} ms; made-up: ${fake.map((r) => r.ms).join(', ')} ms`);
  check('every answer took at least the padded 1.5 s', all.every((r) => r.ms >= ANSWER_FLOOR_MS),
    `fastest ${Math.min(...all.map((r) => r.ms))} ms`);

  if (emailAccount) {
    console.log(`\n-- 2b. One real reset email, to ${emailAccount}`);
    const sent = await post('/api/crm/auth/forgot', { username: emailAccount });
    sentAt = new Date();
    check(`the answer for ${emailAccount} has the same status, words and headers`,
      sent.status === first.status && sent.text === first.text && headerNames(sent) === headerNames(first), summary(sent));
    // The server pads every answer to 1.5 s plus up to 0.25 s of random
    // jitter. An emailed answer slower than every answer without an email,
    // by more than network noise, means sending outran the padding.
    const others = all.map((r) => r.ms), slowest = Math.max(...others);
    check(`its timing is no slower than the answers without an email (+${EMAIL_MARGIN_MS} ms for network noise)`, sent.ms <= slowest + EMAIL_MARGIN_MS,
      `with email: ${sent.ms} ms; without: ${others.join(', ')} ms (slowest ${slowest}); difference ${sent.ms - slowest > 0 ? '+' : ''}${sent.ms - slowest} ms`);
  }

  console.log('\n-- 3. Forgot password past its limit (5 per 15 minutes)');
  const more = [];
  for (let i = emailAccount ? 1 : 0; i < 2; i++) more.push(await post('/api/crm/auth/forgot', { username: randomName() }));
  check(`the ${emailAccount ? '6th request gets' : '5th and 6th requests get'} the identical answer (the limit is silent by design)`,
    more.every((r) => r.status === 200 && r.text === first.text), more.map(summary).join(' | '));
  return true;
}
let sentAt = null;

// Sends requests until the 429 or `max` requests. Every answer before the 429
// must match `expect`.
async function untilThrottled(label, send, expect, max) {
  const seen = [];
  for (let i = 0; i < max; i++) {
    const r = await send();
    seen.push(r);
    if (r.status === 429) break;
  }
  const last = seen[seen.length - 1];
  const before = seen.slice(0, -1);
  check(`${label}: HTTP 429 "Too many attempts" once the limit of 10 is reached`,
    last.status === 429 && /Too many attempts/.test((last.data && last.data.error) || ''),
    `${seen.length} requests, last: ${summary(last)}`);
  check(`${label}: every earlier answer was the normal refusal`, before.every(expect),
    before.length ? summary(before[0]) : 'already throttled from an earlier run');
  return seen;
}

async function checkReset() {
  console.log('\n-- 4. Reset page: made-up links refused, then rate-limited');
  const first = await post('/api/crm/auth/reset', { token: randomToken(), new_password: 'never used for anything', confirm_password: 'never used for anything' });
  const hint = guardHint(first);
  if (hint) { check('reset page is available', false, hint); return; }
  check('a made-up reset link is refused', first.status === 400 && /invalid|expired|used/i.test((first.data && first.data.error) || ''), summary(first));
  await untilThrottled('reset page',
    () => post('/api/crm/auth/reset', { token: randomToken(), new_password: 'never used for anything', confirm_password: 'never used for anything' }),
    (r) => r.status === 400, 11);
}

async function checkCrmLogin(password) {
  console.log('\n-- 5. CRM sign-in');
  const ok = await post('/api/crm/auth/login', { username: TEST_ACCOUNT, password });
  const hint = guardHint(ok);
  if (hint) { check('CRM sign-in is available', false, hint); return; }
  if (ok.status === 429) { check('CRM sign-in', false, `already throttled from an earlier run; wait ${LIMIT_WINDOW_MINUTES} minutes and run again`); return; }
  check(`${TEST_ACCOUNT} signs in to the CRM with its password`, ok.status === 200 && ok.data && ok.data.ok === true, summary(ok));
  const cookie = ok.headers.get('set-cookie') || '';
  check('   the session cookie is HttpOnly, Secure and SameSite',
    /HttpOnly/i.test(cookie) && /Secure/i.test(cookie) && /SameSite=(Lax|Strict)/i.test(cookie), cookie.replace(/=[^;]+/, '=…').slice(0, 120));
  await untilThrottled('CRM sign-in',
    () => post('/api/crm/auth/login', { username: randomName(), password: 'wrong password for testing' }),
    (r) => r.status === 200 && r.data && r.data.ok === false, 11);
}

async function checkAnalyticsLogin(password) {
  console.log('\n-- 6. Analytics sign-in');
  const r = await post('/api/auth/login', { username: TEST_ACCOUNT, password });
  const hint = guardHint(r);
  if (hint) { check('analytics sign-in is available', false, hint); return; }
  if (r.status === 429) { check('analytics sign-in', false, `already throttled from an earlier run; wait ${LIMIT_WINDOW_MINUTES} minutes and run again`); return; }
  check(`${TEST_ACCOUNT} (not admin) is refused analytics`,
    r.status === 200 && r.data && r.data.ok === false && /does not have access to analytics/.test(r.data.error || ''), summary(r));
  check('   and gets no analytics session cookie', !/tc_session=/.test(r.headers.get('set-cookie') || ''));
  await untilThrottled('analytics sign-in',
    () => post('/api/auth/login', { username: randomName(), password: 'wrong password for testing' }),
    (x) => x.status === 200 && x.data && x.data.ok === false, 11);
}

// ---- main --------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  let emailAccount = null;
  const at = args.indexOf('--send-one-email');
  if (at !== -1) { emailAccount = args[at + 1] || ''; args.splice(at, 2); }
  if (args.length !== 1) {
    console.error('Usage: node scripts/staging-smoke-test.js <staging-base-url> [--send-one-email owner-test|owner-test-2]');
    process.exit(2);
  }
  if (emailAccount !== null && !EMAIL_ACCOUNTS.test(emailAccount)) {
    console.error('REFUSED: --send-one-email only accepts the staging test accounts owner-test or owner-test-2.');
    process.exit(2);
  }
  const target = stagingTarget(args[0]);
  if (target.error) { console.error(target.error); process.exit(2); }
  ORIGIN = target.origin;
  if (typeof fetch !== 'function') { console.error('Needs Node.js 18 or later.'); process.exit(2); }

  const password = await ask(`Password of the staging account "${TEST_ACCOUNT}": `, { hidden: true });
  if (!password) { console.error('No password entered.'); process.exit(2); }

  const startedAt = new Date();
  console.log(`Staging smoke test -- ${ORIGIN} -- ${startedAt.toISOString()}`);
  if (emailAccount) console.log(`This run sends ONE real reset email, to the address on ${emailAccount}.`);
  try {
    await checkPages();
    await checkForgot(emailAccount);
    await checkReset();
    await checkCrmLogin(password);
    await checkAnalyticsLogin(password);
  } catch (err) {
    check('the test ran to the end', false, `could not reach ${ORIGIN}: ${(err && err.cause && err.cause.code) || (err && err.message) || err}`);
  }

  const failed = results.filter((r) => !r.ok);
  const resume = new Date(Date.now() + LIMIT_WINDOW_MINUTES * 60000);
  console.log('\n==== SUMMARY (paste this back) ====');
  console.log(`Target: ${ORIGIN}`);
  console.log(`Run: ${startedAt.toISOString()}  Node ${process.version}`);
  console.log(`Result: ${failed.length === 0 ? 'PASS' : 'FAIL'} -- ${results.length - failed.length} passed, ${failed.length} failed`);
  for (const f of failed) console.log(`  FAIL  ${f.name}${f.detail ? `  (${f.detail})` : ''}`);
  const timing = results.find((r) => /^its timing is no slower/.test(r.name));
  if (timing) console.log(`Email timing: ${timing.detail}`);
  if (sentAt) {
    console.log(`CONFIRM BY HAND: one reset email to ${emailAccount}, requested at ${sentAt.toTimeString().slice(0, 5)}, shows Delivered in Resend -> Emails.`);
    console.log('  If it is not there, the request was limited by an earlier run: the timing above means nothing. Wait 15 minutes and run again.');
  }
  console.log(`Wait until ${resume.toTimeString().slice(0, 5)} (${LIMIT_WINDOW_MINUTES} minutes) before testing sign-in or reset by hand.`);
  process.exit(failed.length === 0 ? 0 : 1);
}

if (require.main === module) main();
module.exports = { stagingTarget, EMAIL_ACCOUNTS };
