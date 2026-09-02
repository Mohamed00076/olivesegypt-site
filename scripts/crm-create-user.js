#!/usr/bin/env node
'use strict';

/*
 * Creates (or resets the password of) a CRM user, hashed with the exact
 * same scrypt scheme netlify/functions/_lib.js's verifyPassword() checks
 * against (hashPassword() there is this same code, shared so there's one
 * definition, not two that could drift). Run this yourself, locally,
 * with your own DATABASE_URL and a password of your choosing -- neither
 * this script's output, nor any password you type into it, gets
 * committed, logged, or seen by anyone else. It prints the hash and
 * writes the user directly via DATABASE_URL if that env var is set;
 * otherwise it just prints the hash for you to insert yourself.
 *
 * This remains the always-available way to reset a CRM password --
 * needs no email setup, works even if RESEND_API_KEY/self-service
 * "forgot password" (crm-auth-forgot.js) is unconfigured or a user has
 * no recovery email on file. The optional 4th argument sets that
 * recovery email, which self-service reset needs to have anywhere to
 * send a link -- a user created without one can still sign in with the
 * password this script sets, they just can't use "forgot password"
 * themselves until an email is added (re-run this with the same
 * username to add one without changing their password: pass their
 * current password again).
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/crm-create-user.js <username> <password> ["Display Name"] [email]
 *
 * Without DATABASE_URL set, it only prints the SQL to run yourself:
 *   node scripts/crm-create-user.js <username> <password> ["Display Name"] [email]
 */

const { hashPassword } = require('../netlify/functions/_lib');

async function main() {
  const [username, password, displayName, email] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: node scripts/crm-create-user.js <username> <password> ["Display Name"] [email]');
    process.exit(1);
  }
  if (password.length < 12) {
    console.error('Choose a password of at least 12 characters.');
    process.exit(1);
  }

  const passwordHash = hashPassword(password);
  const cs = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED;

  if (!cs) {
    console.log('DATABASE_URL not set -- run this SQL yourself against your database:\n');
    console.log(`CREATE TABLE IF NOT EXISTS crm_users (
  id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at     timestamptz NOT NULL DEFAULT now(),
  username       text NOT NULL UNIQUE,
  password_hash  text NOT NULL,
  display_name   text
);
ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS email text;

INSERT INTO crm_users (username, password_hash, display_name, email)
VALUES ('${username.replace(/'/g, "''")}', '${passwordHash}', ${displayName ? `'${displayName.replace(/'/g, "''")}'` : 'NULL'}, ${email ? `'${email.replace(/'/g, "''")}'` : 'NULL'})
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash,
  display_name = COALESCE(EXCLUDED.display_name, crm_users.display_name),
  email = COALESCE(EXCLUDED.email, crm_users.email);
`);
    return;
  }

  const { neon } = require('@neondatabase/serverless');
  const sql = neon(cs);
  await sql`
    CREATE TABLE IF NOT EXISTS crm_users (
      id             bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at     timestamptz NOT NULL DEFAULT now(),
      username       text NOT NULL UNIQUE,
      password_hash  text NOT NULL,
      display_name   text
    )
  `;
  await sql`ALTER TABLE crm_users ADD COLUMN IF NOT EXISTS email text`;
  await sql`
    INSERT INTO crm_users (username, password_hash, display_name, email)
    VALUES (${username}, ${passwordHash}, ${displayName || null}, ${email || null})
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash,
      display_name = COALESCE(EXCLUDED.display_name, crm_users.display_name),
      email = COALESCE(EXCLUDED.email, crm_users.email)
  `;
  console.log(`CRM user "${username}" created/updated.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
