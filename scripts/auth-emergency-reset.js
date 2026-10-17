#!/usr/bin/env node
'use strict';

/*
 * Emergency password reset, with no website and no database connection.
 *
 *   node scripts/auth-emergency-reset.js
 *
 * For when the "Forgot password?" email cannot help: email is down, the
 * account has no email on file, or you are locked out. It asks for the
 * username and the new password (typed twice, hidden), checks the password
 * rules, hashes it exactly the way the site does, and prints ONE block of
 * SQL to paste into the Neon SQL Editor. Run in Neon, that block:
 *
 *   1. stops with an error if the username does not exist (nothing changes)
 *   2. sets the new password
 *   3. marks it "must change on next sign-in"
 *   4. signs the account out everywhere (session number + 1)
 *   5. cancels every reset link still open for it
 *   6. writes an "emergency_reset" row to auth_events
 *   7. optionally marks the account as an analytics admin
 *
 * Nothing is saved, sent or logged. The password itself never appears in
 * the output -- only its scrypt hash, which is what the database stores
 * anyway. It needs no secrets and no DATABASE_URL.
 *
 * The block also adds any missing columns first (all IF NOT EXISTS), so it
 * works on a database the new code has not reached yet.
 */

const { ask } = require('./_prompt');
const auth = require('../netlify/functions/_auth_lib');

function lit(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

async function main() {
  console.error('\nEmergency password reset for olivesegypt.com (CRM and analytics).');
  console.error('Nothing you type is saved or shown. The output is SQL to paste into Neon.\n');

  const username = (await ask('Username: ')).trim();
  if (!/^[A-Za-z0-9._@-]{1,100}$/.test(username)) {
    console.error('\nThat does not look like a CRM username (letters, digits, . _ @ - only). Nothing printed.');
    process.exit(1);
  }
  const password = await ask('New password: ', { hidden: true });
  const again = await ask('New password again: ', { hidden: true });
  if (password !== again) {
    console.error('\nThe two passwords do not match. Nothing printed.');
    process.exit(1);
  }
  const problem = auth.passwordProblem(password, username);
  if (problem) {
    console.error(`\n${problem} Nothing printed.`);
    process.exit(1);
  }
  const admin = /^y(es)?$/i.test((await ask('Also give this account analytics (admin) access? [y/N]: ')).trim());

  const hash = await auth.hashPassword(password);
  const check = await auth.verifyPassword(password, hash);
  if (!check.ok) {
    console.error('\nInternal error: the new hash does not verify. Nothing printed.');
    process.exit(1);
  }

  const u = lit(username);
  const sql = `-- olivesegypt.com emergency password reset for ${username.replace(/[^\w.@-]/g, '')}
-- Generated ${new Date().toISOString()} by scripts/auth-emergency-reset.js.
-- Contains a password HASH, not the password. Paste all of it into the Neon SQL Editor and click Run.
BEGIN;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS crm_password_resets (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(),
  user_id bigint NOT NULL, token_hash text NOT NULL UNIQUE, expires_at timestamptz NOT NULL, used_at timestamptz);
ALTER TABLE crm_password_resets ADD COLUMN IF NOT EXISTS invalidated_at timestamptz;
CREATE TABLE IF NOT EXISTS auth_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, occurred_at timestamptz NOT NULL DEFAULT now(),
  app text NOT NULL, event text NOT NULL, user_id bigint, ip_hash text, detail text);
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM crm_users WHERE username = ${u}) THEN
    RAISE EXCEPTION 'No CRM user named %. Nothing was changed.', ${u};
  END IF;
END $$;
UPDATE crm_users
   SET password_hash = ${lit(hash)},
       must_change_password = true,
       session_version = session_version + 1,
       password_changed_at = now()${admin ? ',\n       is_admin = true' : ''}
 WHERE username = ${u};
UPDATE crm_password_resets SET invalidated_at = now()
 WHERE user_id = (SELECT id FROM crm_users WHERE username = ${u})
   AND used_at IS NULL AND invalidated_at IS NULL;
INSERT INTO auth_events (app, event, user_id, detail)
SELECT 'crm', 'emergency_reset', id, ${lit(admin ? 'set via local script; analytics admin granted' : 'set via local script')}
  FROM crm_users WHERE username = ${u};
COMMIT;`;

  console.log(sql);
  console.error('\nCopy everything above, from "-- olivesegypt.com" to "COMMIT;", into the Neon SQL Editor and click Run.');
  console.error('Then sign in. The site will ask you to choose a new password straight away.\n');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Error:', String((err && err.message) || err));
    process.exit(1);
  });
}
