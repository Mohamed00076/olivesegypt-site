#!/usr/bin/env node
'use strict';

/*
 * Proves that each check in check-password-reset.js guards something.
 *
 *   node scripts/check-password-reset-mutations.js        (npm run test:auth-mutations)
 *
 * For every protection below: copy netlify/functions to a temporary folder,
 * remove that one protection, run check-password-reset.js against the copy,
 * and require that it fails -- and fails on the check named for that
 * protection. A check that still passes with its protection removed proves
 * nothing, and this says so.
 *
 * Each mutation's "find" text must occur exactly once in its file, so when
 * the code changes, this fails loudly instead of quietly testing nothing.
 *
 * Protections enforced inside SQL statements (single use, expiry window,
 * cancelling earlier links, the session-number rise, matching the token
 * hash) are proven against a real PostgreSQL in the release-1 pull request;
 * the fake database cannot stand in for the SQL itself.
 *
 * Takes a few minutes (one full run per mutation), so it is not part of
 * `npm test`. Run it whenever the sign-in or reset code changes.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

const M = [
  ['_auth_lib.js', 'const HASH = { N: 32768, r: 8, p: 3,', 'const HASH = { N: 16384, r: 8, p: 1,', '[hash] new hashes use scrypt N=32768 r=8 p=3'],
  ['_auth_lib.js', 'const PASSWORD_MIN = 12;', 'const PASSWORD_MIN = 1;', '[rules] fewer than 12 characters is refused'],
  ['_auth_lib.js', 'if (COMMON_PASSWORDS.has(lower))', 'if (false)', '[rules] a common password is refused'],
  ['crm-auth-forgot.js', 'if (!user) return answer(200, GENERIC);', "if (!user) return answer(200, { ok: true, message: 'No such account.' });", '[enumeration] same status and words for a real and a missing account'],
  ['crm-auth-forgot.js', '    await auth.padTo(startedAt);\n', '', '[enumeration] similar timing: both answers take at least the floor'],
  ['crm-auth-forgot.js', 'const base = auth.appBaseUrl();', "const base = 'https://' + (event.headers.host || 'olivesegypt.example');", '[host] the link is built from APP_BASE_URL; a spoofed Host header is ignored'],
  ['_auth_lib.js', "if (u.protocol !== 'https:' ||", 'if (false ||', '[host] an http:// base address sends no email (https only)'],
  ['_auth_lib.js', 'return ROLE_MAILBOXES.has(local);', 'return false;', "[email] a role mailbox (sales@) never receives a reset link"],
  ['crm-auth-forgot.js', 'tokenHash: hash, ipHash: ipH', 'tokenHash: token, ipHash: ipH', '[token] only its SHA-256 is stored, never the token'],
  ['_auth_lib.js', 'const RESET_TTL_MINUTES = 30;', 'const RESET_TTL_MINUTES = 60 * 24;', '[expiry] a link older than 30 minutes is refused'],
  ['crm-auth-forgot.js', 'ip15 >= auth.LIMITS_PER.forgotPerIp15', 'ip15 >= 1e9', '[rate] and sends nothing (per-IP limit 5 per 15 minutes)'],
  ['crm-auth-forgot.js', 'perAccount > auth.LIMITS_PER.forgotPerAccountHour', 'perAccount > 1e9', '[rate] the 4th request for one account in an hour sends nothing (3 per hour)'],
  ['crm-auth-reset.js', 'recent >= auth.LIMITS_PER.resetPerIp15', 'recent >= 1e9', '[rate] reset-page submits: the 11th failure from one IP gets 429'],
  ['crm-auth-login.js', 'attempts >= auth.LIMITS_PER.loginPerIp15', 'attempts >= 1e9', '[rate] sign-in: the 11th attempt from one IP gets 429'],
  ['_auth_lib.js', "const ip = h['x-nf-client-connection-ip'];", "const ip = (h['x-forwarded-for'] || '').split(',')[0] || h['x-nf-client-connection-ip'];", "[ip] a changing X-Forwarded-For does not escape the limit (Netlify's header only)"],
  ['crm-auth-login.js', 'if (failures >= auth.LIMITS_PER.loginFailuresPerAccount15) await auth.sleep(2000);', '', '[slow] an account with 10 recent failures is slowed, not locked'],
  ['_auth_lib.js', '    if (recent > 0) return false;\n', '', '[alert] at most one alert an hour'],
  ['crm-auth-reset.js', 'const reply = (status, body) => json(status, body, auth.NO_STORE);', "const reply = (status, body) => json(status, body, { ...auth.NO_STORE, 'Set-Cookie': 'tc_crm_session=x' });", '[success] no automatic sign-in: no cookie is set'],
  ['crm-auth-reset.js', "await emailLib.sendEmail(user.email.trim(), 'Your olivesegypt.com password was changed'", "void (user.email.trim(), 'Your olivesegypt.com password was changed'", '[success] a "password changed" email goes to the account'],
  ['crm-auth-reset.js', "await auth.audit(store, { app, event: 'reset_completed', userId: user.id, ipHash: ipH });", '', '[audit] a reset_completed row is written'],
  ['crm-auth-reset.js', 'if (confirm === null || confirm !== newPassword) {', 'if (false) {', '[confirm] mismatched confirmation is refused and the link stays usable'],
  ['_crm_lib.js', '  if (session && session.mc && !(opts && opts.allowMustChange)) return null;\n', '', '[must change] that session opens no CRM endpoint'],
  ['crm-auth-login.js', '    if (needsRehash) {', '    if (false) {', '[hash] an old hash is upgraded at the next sign-in'],
  ['auth-login.js', 'if (user.is_admin !== true) {', 'if (false) {', '[analytics] a CRM account without admin is refused'],
  ['auth-login.js', "return String(process.env.ADMIN_FALLBACK_LOGIN || '').trim().toLowerCase() === 'on';", 'return true;', '[fallback] the old Netlify-settings login is refused while ADMIN_FALLBACK_LOGIN is off'],
  ['_auth_lib.js', "if (env === 'staging' && marker !== 'staging') {", 'if (false) {', '[guard] a staging deploy on an unlabelled database changes nothing'],
  ['_auth_lib.js', "if (env === 'production' && marker === 'staging') {", 'if (false) {', '[guard] a production deploy on the staging-labelled database is refused'],
  ['crm-auth-forgot.js', 'const link = `${base}/crm/reset-password/#token=${token}`;', "const link = `${base}/crm/reset-password/#token=${token}`; console.log('[crm-auth-forgot] sent', link);", '[logs] none of the'],
];

let proven = 0;
const problems = [];
const started = Date.now();
for (const [file, find, replace, expect] of M) {
  const src = fs.readFileSync(path.join(FN, file), 'utf8');
  const count = src.split(find).length - 1;
  if (count !== 1) { problems.push(`${file}: the text to remove occurs ${count} times, not once -- update this harness: ${find.slice(0, 60)}`); continue; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-mut-'));
  try {
    fs.cpSync(FN, dir, { recursive: true });
    fs.writeFileSync(path.join(dir, file), src.replace(find, replace));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'check-password-reset.js')], {
      env: { ...process.env, AUTH_FN_DIR: dir, AUTH_REPORT_FAILED: '1', NODE_PATH: path.join(ROOT, 'node_modules') },
      encoding: 'utf8', timeout: 180000,
    });
    const m = /FAILED_NAMES (\[.*\])/.exec(r.stdout || '');
    const names = m ? JSON.parse(m[1]) : [];
    const hit = names.some((n) => n.startsWith(expect));
    if (r.status !== 0 && hit) {
      proven++;
      console.log(`PASS  removing it fails: ${expect}`);
    } else {
      problems.push(`${expect}: the suite ${r.status === 0 ? 'still PASSED' : 'failed, but not on this check (' + (names.join('; ') || (r.stdout || '').split('\n').filter((l) => /ERROR/.test(l)).join(' ').slice(0, 200)) + ')'} with ${file} changed`);
      console.log(`FAIL  removing it does not fail its check: ${expect}`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
console.log(`\n${proven} of ${M.length} protections proven (${Math.round((Date.now() - started) / 1000)} s)`);
if (problems.length) { console.log('\n' + problems.join('\n')); process.exit(1); }
