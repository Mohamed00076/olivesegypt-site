#!/usr/bin/env node
'use strict';

/*
 * Sets or checks the /admin/analytics password.
 *
 *   node scripts/admin-password.js set   <password>
 *   node scripts/admin-password.js check <password> <stored-hash>
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

const { hashPassword, verifyPassword } = require('../netlify/functions/_lib');

const MIN_LENGTH = 12;

function usage(message) {
  if (message) console.error(`\n${message}\n`);
  console.error(`Usage:
  node scripts/admin-password.js set   <password>
  node scripts/admin-password.js check <password> <stored-hash>

  set    prints a hash to paste into ADMIN_PASSWORD_HASH in Netlify
  check  says whether a password matches a hash you already have there

Quote the password so the shell does not interpret it:
  node scripts/admin-password.js set 'my new password!'
`);
  process.exit(1);
}

/*
 * The exact shape hashPassword() produces: a 16-byte salt and a 32-byte hash,
 * both hex, so 32 and 64 characters. The lengths matter as much as the
 * format. A hash pasted a few characters short still has three parts and
 * still begins with "scrypt", so without a length check it reads as a valid
 * hash that simply does not match -- which sends you off to change a password
 * that was never wrong. Netlify's UI truncates long values on screen, so this
 * is a realistic paste error, not a hypothetical one.
 */
const SALT_HEX = 32;
const HASH_HEX = 64;

function inspectHash(value) {
  const raw = String(value);
  if (raw !== raw.trim()) return { ok: false, why: 'it has whitespace around it' };
  const parts = raw.split(':');
  if (parts.length !== 3) {
    return { ok: false, why: `it has ${parts.length} colon-separated part(s), not 3` };
  }
  if (parts[0] !== 'scrypt') return { ok: false, why: `it starts with "${parts[0]}", not "scrypt"` };
  for (const [i, name, want] of [[1, 'salt', SALT_HEX], [2, 'hash', HASH_HEX]]) {
    if (!/^[0-9a-f]*$/.test(parts[i])) return { ok: false, why: `its ${name} is not hexadecimal` };
    if (parts[i].length !== want) {
      return {
        ok: false,
        truncated: parts[i].length < want,
        why: `its ${name} is ${parts[i].length} characters, not ${want}`,
      };
    }
  }
  return { ok: true };
}

const [command, password, stored] = process.argv.slice(2);

if (!command) usage();
if (command !== 'set' && command !== 'check') usage(`Unknown command "${command}".`);
if (!password) usage('No password given.');

/*
 * A password that arrives with whitespace around it is almost always a paste
 * artefact rather than a deliberate choice, and it is invisible on screen --
 * so say so rather than silently hashing something the owner cannot retype.
 */
if (password !== password.trim()) {
  console.error(
    '\nThe password has leading or trailing whitespace. That is almost always a\n' +
    'paste artefact, and you would never be able to retype it. Quote it exactly:\n' +
    "  node scripts/admin-password.js " + command + " 'your password'\n"
  );
  process.exit(1);
}

if (command === 'check') {
  if (!stored) usage('No stored hash given. Copy ADMIN_PASSWORD_HASH out of Netlify and pass it as the third argument.');

  const shape = inspectHash(stored);
  if (!shape.ok) {
    console.error(
      `\nThat is not a usable stored hash: ${shape.why}.\n\n` +
      `It should look like scrypt:<${SALT_HEX} hex chars>:<${HASH_HEX} hex chars>\n` +
      `Got: ${String(stored).slice(0, 72)}${String(stored).length > 72 ? '...' : ''}\n\n` +
      (shape.truncated
        ? `That is SHORTER than it should be, so the value was almost certainly\n` +
          `cut off when you copied it. Netlify truncates long values on screen --\n` +
          `use the copy button rather than selecting the text, and try again.\n\n` +
          `Nothing is wrong with your password. Do not change it on account of this.\n`
        : `Copy the whole value out of Netlify and try again.\n`)
    );
    process.exit(1);
  }

  if (verifyPassword(password, stored)) {
    console.log(`
MATCH -- this password is correct for that hash.

So the password is not the problem. Check ADMIN_USERNAME in Netlify, exactly
as stored: a trailing space or a capital letter is enough to fail, and the
sign-in page cannot tell you which half was wrong.

If ADMIN_USERNAME looks right too, confirm the site has been redeployed since
you last changed either value.`);
    process.exit(0);
  }

  console.log(`
NO MATCH -- this password does not open that hash.

Set a new one:
  node scripts/admin-password.js set 'your new password'`);
  process.exit(2);
}

// ---- set ----------------------------------------------------------------
if (password.length < MIN_LENGTH) {
  console.error(
    `\nChoose a password of at least ${MIN_LENGTH} characters. ` +
    `This one is ${password.length}.\n\n` +
    `It guards every visitor statistic, KPI and analytics setting the site\n` +
    `collects, and it is the only thing doing so.\n`
  );
  process.exit(1);
}

const hash = hashPassword(password);

// Never print a hash this script cannot itself verify.
if (!verifyPassword(password, hash)) {
  console.error('\nInternal error: the generated hash does not verify. Nothing was printed.\n');
  process.exit(1);
}

console.log(`
ADMIN_PASSWORD_HASH
${hash}

Next:
  1. Netlify -> your site -> Site configuration -> Environment variables
  2. Set ADMIN_PASSWORD_HASH to the whole line above -- all three
     colon-separated parts, with no space before or after it
  3. Check ADMIN_USERNAME while you are there; it is stored in plain text,
     so you can simply read it
  4. Redeploy. Netlify injects environment variables at deploy time, so
     saving alone changes nothing and the old password keeps working

Then sign in at /admin/analytics.

To confirm before you redeploy, paste the value back out of Netlify and run:
  node scripts/admin-password.js check 'your new password' '<paste it here>'
`);
