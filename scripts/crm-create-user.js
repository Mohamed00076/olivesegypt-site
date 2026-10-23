#!/usr/bin/env node
'use strict';

/*
 * Creates a CRM user, or sets the password of an existing one, hashed exactly
 * the way the site does (netlify/functions/_auth_lib.js hashPassword: scrypt,
 * N=2^15, r=8, p=3).
 *
 * The password is ASKED FOR, hidden, never passed as an argument: an
 * argument lands in the shell's history and the process list. Username,
 * display name and email are not secret, so they stay arguments.
 *
 * With DATABASE_URL set it writes the user directly; without it, it prints
 * SQL to paste into the Neon SQL Editor. Nothing is logged or committed.
 *
 * Usage:
 *   node scripts/crm-create-user.js <username> ["Display Name"] [email]
 *   DATABASE_URL=postgres://... node scripts/crm-create-user.js <username> ["Display Name"] [email]
 *
 * For a locked-out account, prefer scripts/auth-emergency-reset.js: it also
 * signs the account out everywhere and forces a new password at sign-in.
 */

const { ask } = require('./_prompt');
const auth = require('../netlify/functions/_auth_lib');

function lit(value) {
  return value == null || value === '' ? 'NULL' : "'" + String(value).replace(/'/g, "''") + "'";
}

async function main() {
  const [username, displayName, email] = process.argv.slice(2);
  if (!username || process.argv.length > 5) {
    console.error('Usage: node scripts/crm-create-user.js <username> ["Display Name"] [email]');
    console.error('The password is asked for; never put it on the command line.');
    process.exit(1);
  }
  if (!/^[A-Za-z0-9._@-]{1,100}$/.test(username)) {
    console.error('Use letters, digits and . _ @ - only in the username.');
    process.exit(1);
  }
  if (email && auth.isRoleMailbox(email)) {
    console.error(`${email} is a shared mailbox; reset links are never sent to one. Use the person's own address.`);
    process.exit(1);
  }
  const password = await ask('Password: ', { hidden: true });
  const again = await ask('Password again: ', { hidden: true });
  if (password !== again) {
    console.error('The two passwords do not match.');
    process.exit(1);
  }
  const problem = auth.passwordProblem(password, username);
  if (problem) {
    console.error(problem);
    process.exit(1);
  }
  const admin = /^y(es)?$/i.test((await ask('Analytics (admin) access? [y/N]: ')).trim());
  const passwordHash = await auth.hashPassword(password);
  const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED;

  if (!cs) {
    console.error('DATABASE_URL not set -- paste this SQL into the Neon SQL Editor yourself:\n');
    console.log(`CREATE TABLE IF NOT EXISTS crm_users (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  username       text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  display_name   text
);
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

INSERT INTO crm_users (username, password_hash, display_name, email, is_admin, password_changed_at)
VALUES (${lit(username)}, ${lit(passwordHash)}, ${lit(displayName)}, ${lit(email)}, ${admin}, now())
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash,
  display_name = COALESCE(EXCLUDED.display_name, crm_users.display_name),
  email = COALESCE(EXCLUDED.email, crm_users.email),
  is_admin = crm_users.is_admin OR EXCLUDED.is_admin,
  password_changed_at = now(),
  session_version = crm_users.session_version + 1;
`);
    return;
  }

  const { neon } = require('@neondatabase/serverless');
  const sql = neon(cs);
  const store = auth.createStore(sql);
  await store.ensureSchema();
  await sql`
    INSERT INTO crm_users (username, password_hash, display_name, email, is_admin, password_changed_at)
    VALUES (${username}, ${passwordHash}, ${displayName || null}, ${email || null}, ${admin}, now())
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash,
      display_name = COALESCE(EXCLUDED.display_name, crm_users.display_name),
      email = COALESCE(EXCLUDED.email, crm_users.email),
      is_admin = crm_users.is_admin OR EXCLUDED.is_admin,
      password_changed_at = now(),
      session_version = crm_users.session_version + 1
  `;
  console.error(`CRM user "${username}" created/updated.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
