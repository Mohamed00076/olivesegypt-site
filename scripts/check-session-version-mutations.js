#!/usr/bin/env node
'use strict';

/*
 * Proves that each check in check-session-version.js guards something.
 *
 *   node scripts/check-session-version-mutations.js        (npm run test:session-mutations)
 *
 * For every protection below: copy netlify/functions to a temporary folder,
 * remove that one protection, run check-session-version.js against the copy,
 * and require that it fails on the check named for that protection. Each
 * "find" text must occur exactly once, so a code change fails this loudly.
 *
 * Two guards in _sessions.js are not listed because removing either changes
 * nothing that can be observed: the account-id shape check (a session with
 * no id finds no account anyway) and the admin mark (a session for a
 * non-admin account is refused by is_admin anyway). They stay as cheap
 * second locks.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const FN = path.join(ROOT, 'netlify', 'functions');

// Snippets below are code for the copied functions folder, not requires of
// this script; R keeps check-script-integrity from reading them as such.
const R = 'require';
const M = [
  ['_sessions.js', '  if (Number(row.session_version) !== sv) return false;\n', '', '[crm] an old session (its session number is out of date after a reset): refused'],
  ['_sessions.js', '  if (Number(row.session_version) !== sv) return false;\n', '', '[admin] an old session (session number out of date): refused'],
  ['_sessions.js', '  if (row.username !== session.sub) return false;\n', '', '[crm] a session naming another account than its id: refused'],
  ['_sessions.js', 'if (admin && (row.is_admin !== true || row.must_change_password === true)) return false;', 'if (admin && (row.must_change_password === true)) return false;', "[admin] a non-admin account's session: refused"],
  ['_sessions.js', 'if (admin && (row.is_admin !== true || row.must_change_password === true)) return false;', 'if (admin && (row.is_admin !== true)) return false;', '[admin] the account must change its password first: refused'],
  ['_sessions.js', "return fallbackOn() && process.env.ADMIN_USERNAME && session.sub === process.env.ADMIN_USERNAME ? session : null;", 'return session;', '[admin] the emergency fallback session while ADMIN_FALLBACK_LOGIN is off: refused'],
  ['_sessions.js', "return fallbackOn() && process.env.ADMIN_USERNAME && session.sub === process.env.ADMIN_USERNAME ? session : null;", 'return fallbackOn() ? session : null;', '[admin]    but only for ADMIN_USERNAME'],
  ['_sessions.js', "    await reportFailure(cs ? neon(cs) : null, { source: 'session-check', step: 'checking a session against its account' }, err);\n    return false;", '    return true;', '[crm] the account cannot be read (database down): refused, never waved through'],
  ['_sessions.js', "    await reportFailure(cs ? neon(cs) : null, { source: 'session-check', step: 'checking a session against its account' }, err);\n    return false;", '    return true;', '[admin] the account cannot be read (database down): refused'],
  ['_sessions.js', "  return (await currentAdminSession(event)) || (await currentCrmSession(event));", `  return (await currentAdminSession(event)) || ${R}('./_crm_lib').requireCrmSession(event);`, '[reader] an old CRM session: refused'],
  // Call sites: one of each kind going back to the unchecked gate.
  ['crm-buyers.js', 'const session = await currentCrmSession(event);', `const session = ${R}('./_crm_lib').requireCrmSession(event);`, '[crm] an old session (its session number is out of date after a reset): refused'],
  ['crm-buyers.js', 'const session = await currentCrmSession(event);', `const session = ${R}('./_crm_lib').requireCrmSession(event);`, 'no function checks a session without _sessions.js'],
  ['analytics-report.js', 'const requireAdmin = currentAdminSession;', `const requireAdmin = (e) => { const l = ${R}('./_lib'); const tk = l.parseCookies(e.headers)[l.COOKIE_NAME]; return tk ? l.verifySession(tk, process.env.SESSION_SECRET) : null; };`, '[admin] an old session (session number out of date): refused'],
  ['unsubscribe.js', '  return !!(await currentAdminSession(event));', '  return true;', '[admin] no session: refused'],
  ['_crm_lib.js', `const session = await ${R}('./_sessions').currentCrmSession(event);`, 'const session = requireCrmSession(event);', '[crm] an old session (its session number is out of date after a reset): refused'],
  ['crm-auth-change.js', 'const session = await currentCrmSession(event, { allowMustChange: true });', 'const session = await currentCrmSession(event);', '[crm]    and does open change-password'],
];

let proven = 0;
const problems = [];
const started = Date.now();
for (const [file, find, replace, expect] of M) {
  const src = fs.readFileSync(path.join(FN, file), 'utf8');
  const count = src.split(find).length - 1;
  if (count !== 1) { problems.push(`${file}: the text to change occurs ${count} times, not once -- update this harness: ${find.slice(0, 60)}`); continue; }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-mut-'));
  try {
    fs.cpSync(FN, dir, { recursive: true });
    fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'), 'dir');
    fs.writeFileSync(path.join(dir, file), src.replace(find, replace));
    const r = spawnSync(process.execPath, [path.join(__dirname, 'check-session-version.js')], {
      env: { ...process.env, SESSION_FN_DIR: dir, SESSION_REPORT_FAILED: '1' }, encoding: 'utf8', timeout: 180000,
    });
    const m = /FAILED_NAMES (\[.*\])/.exec(r.stdout || '');
    const names = m ? JSON.parse(m[1]) : [];
    if (r.status !== 0 && names.some((n) => n.startsWith(expect))) {
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
