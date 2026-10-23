#!/usr/bin/env node
'use strict';

/*
 * Sets or checks the EMERGENCY FALLBACK password for /admin/analytics.
 *
 *   node scripts/admin-password.js set
 *   node scripts/admin-password.js check
 *
 * Since 2026-10-17 analytics is opened with a CRM account marked is_admin.
 * ADMIN_USERNAME / ADMIN_PASSWORD_HASH in Netlify are only the emergency
 * fallback, which works while ADMIN_FALLBACK_LOGIN is "on". The password is
 * asked for, hidden -- never an argument, which would land in the shell's
 * history and the process list.
 *
 * The sibling of scripts/crm-create-user.js. The CRM has had one since its
 * users live in the database; the admin login reads two environment
 * variables instead and had nothing, so recovering it meant pasting
 * one-liners at a shell. That is the kind of gap that turns a two-minute job
 * into an afternoon.
 *
 * Nothing here is written to disk or sent anywhere. It prints a hash for you
 * to paste into Netlify, and neither the password you type nor the hash it
 * prints is committed, logged, or visible to anyone else.
 *
 *
 * WHY "check" EXISTS
 *
 * /admin/analytics returns exactly one message -- "Incorrect username or
 * password" -- whether the username is wrong, the password is wrong, or both.
 * That is correct behaviour: telling an attacker which half they got right
 * halves their work. But it also means the owner locked out of their own
 * dashboard cannot tell which half to fix, and ends up changing both.
 *
 * "check" resolves it offline, against the hash already in Netlify. If it
 * says MATCH, the password is right and the username is the problem -- read
 * ADMIN_USERNAME in Netlify, character for character. If it says NO MATCH,
 * set a new password with "set".
 *
 *
 * THE THREE WAYS THIS SILENTLY FAILS
 *
 * All three produce that same "Incorrect username or password", with nothing
 * to distinguish them, so this script names them on every run:
 *
 *   1. Whitespace. The username comparison is exact bytes -- "admin " never
 *      equals "admin". Netlify's paste box picks up trailing newlines and
 *      shows you nothing.
 *   2. Case. "Admin" never equals "admin".
 *   3. A hash pasted short. Four missing characters is enough, and the value
 *      still looks entirely plausible in the Netlify UI.
 *
 *
 * AND THE ONE THAT WASTES THE MOST TIME
 *
 * Netlify injects environment variables at deploy time. Saving a new value
 * changes nothing until the site is redeployed, so the old password keeps
 * working and the new one keeps failing -- which reads exactly like getting
 * the hash wrong, and sends people round the loop a second time.
 */

const { ask } = require('./_prompt');
const auth = require('../netlify/functions/_auth_lib');

function usage(message) {
  if (message) console.error(`\n${message}\n`);
  console.error(`Usage:
  node scripts/admin-password.js set     prints a hash for ADMIN_PASSWORD_HASH in Netlify
  node scripts/admin-password.js check   says whether a password matches the hash you have there

The password is asked for and hidden. Never put it on the command line.
`);
  process.exit(1);
}

/*
 * The shapes a stored hash can have, with their lengths. The lengths matter
 * as much as the format: a hash pasted a few characters short still looks
 * plausible, and without a length check it reads as a valid hash that simply
 * does not match -- which sends you off to change a password that was never
 * wrong. Netlify's UI truncates long values on screen, so this is a
 * realistic paste error, not a hypothetical one.
 *   scrypt:<32 hex salt>:<64 hex hash>                  (before 2026-10-17)
 *   scrypt2$32768$8$3$<32 hex salt>$<64 hex hash>        (now)
 */
function inspectHash(value) {
  const raw = String(value);
  if (raw !== raw.trim()) return { ok: false, why: 'it has whitespace around it' };
  const isNew = raw.startsWith('scrypt2$');
  const parts = raw.split(isNew ? '$' : ':');
  if (!isNew && parts[0] !== 'scrypt') return { ok: false, why: `it starts with "${parts[0]}", not "scrypt" or "scrypt2"` };
  if (parts.length !== (isNew ? 6 : 3)) return { ok: false, why: `it has ${parts.length} parts, not ${isNew ? 6 : 3}` };
  const salt = parts[isNew ? 4 : 1];
  const hash = parts[isNew ? 5 : 2];
  for (const [name, val, want] of [['salt', salt, 32], ['hash', hash, 64]]) {
    if (!/^[0-9a-f]*$/.test(val)) return { ok: false, why: `its ${name} is not hexadecimal` };
    if (val.length !== want) return { ok: false, truncated: val.length < want, why: `its ${name} is ${val.length} characters, not ${want}` };
  }
  return auth.parseHash(raw) ? { ok: true } : { ok: false, why: 'its parameters are out of range' };
}

async function main() {
  const command = process.argv[2];
  if (!command) usage();
  if (command !== 'set' && command !== 'check') usage(`Unknown command "${command}".`);
  if (process.argv.length > 3) usage('Do not put the password on the command line; it is asked for.');

  const password = await ask('Password: ', { hidden: true });
  if (!password) usage('No password typed.');
  if (password !== password.trim()) {
    console.error('\nThe password has spaces at the start or end. That is almost always a paste\nartefact, and you would never be able to retype it. Try again.\n');
    process.exit(1);
  }

  if (command === 'check') {
    const stored = (await ask('ADMIN_PASSWORD_HASH as copied from Netlify: ')).trim();
    const shape = inspectHash(stored);
    if (!shape.ok) {
      console.error(
        `\nThat is not a usable stored hash: ${shape.why}.\n\n` +
        (shape.truncated
          ? 'It is SHORTER than it should be, so the value was almost certainly cut off when\n' +
            'you copied it. Use the copy button in Netlify rather than selecting the text.\n' +
            'Nothing is wrong with your password. Do not change it on account of this.\n'
          : 'Copy the whole value out of Netlify and try again.\n')
      );
      process.exit(1);
    }
    if ((await auth.verifyPassword(password, stored)).ok) {
      console.log(`
MATCH -- this password is correct for that hash.

So the password is not the problem. Check ADMIN_USERNAME in Netlify exactly as
stored (a trailing space or a capital letter is enough to fail), that
ADMIN_FALLBACK_LOGIN is "on", and that the site was redeployed since either
value last changed.`);
      process.exit(0);
    }
    console.log('\nNO MATCH -- this password does not open that hash. Set a new one with:\n  node scripts/admin-password.js set');
    process.exit(2);
  }

  const again = await ask('Password again: ', { hidden: true });
  if (again !== password) { console.error('\nThe two passwords do not match. Nothing printed.\n'); process.exit(1); }
  const problem = auth.passwordProblem(password, process.env.ADMIN_USERNAME || '');
  if (problem) { console.error(`\n${problem} Nothing printed.\n`); process.exit(1); }

  const hash = await auth.hashPassword(password);
  // Never print a hash this script cannot itself verify.
  if (!(await auth.verifyPassword(password, hash)).ok) {
    console.error('\nInternal error: the generated hash does not verify. Nothing was printed.\n');
    process.exit(1);
  }
  console.log(`
ADMIN_PASSWORD_HASH
${hash}

Next:
  1. Netlify -> your site -> Site configuration -> Environment variables
  2. Set ADMIN_PASSWORD_HASH to the whole line above, with no space before or
     after it
  3. Check ADMIN_USERNAME while you are there; it is stored in plain text
  4. Redeploy. Netlify applies environment variables at deploy time

This is the EMERGENCY FALLBACK only. It works while ADMIN_FALLBACK_LOGIN is
"on"; normally analytics is opened with your CRM account.`);
}

main().catch((err) => {
  console.error('Error:', String((err && err.message) || err));
  process.exit(1);
});
