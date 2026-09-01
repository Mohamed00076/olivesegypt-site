#!/usr/bin/env node
'use strict';

/*
 * Creates (or resets the password of) a CRM user, hashed with the exact
 * same scrypt scheme netlify/functions/_lib.js's verifyPassword() checks
 * against. Run this yourself, locally, with your own DATABASE_URL and a
 * password of your choosing -- neither this script's output, nor any
 * password you type into it, gets committed, logged, or seen by anyone
 * else. It prints the hash and writes the user directly via DATABASE_URL
 * if that env var is set; otherwise it just prints the hash for you to
 * insert yourself.
 *
 * Usage:
 *   DATABASE_URL=postgres://... node scripts/crm-create-user.js <username> <password> ["Display Name"]
 *
 * Without DATABASE_URL set, it only prints the SQL to run yourself:
 *   node scripts/crm-create-user.js <username> <password> ["Display Name"]
 */

const crypto = require('crypto');

function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(String(password), salt, 32);
  return `scrypt:${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function main() {
  const [username, password, displayName] = process.argv.slice(2);
  if (!username || !password) {
    console.error('Usage: node scripts/crm-create-user.js <username> <password> ["Display Name"]');
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

INSERT INTO crm_users (username, password_hash, display_name)
VALUES ('${username.replace(/'/g, "''")}', '${passwordHash}', ${displayName ? `'${displayName.replace(/'/g, "''")}'` : 'NULL'})
ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name;
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
  await sql`
    INSERT INTO crm_users (username, password_hash, display_name)
    VALUES (${username}, ${passwordHash}, ${displayName || null})
    ON CONFLICT (username) DO UPDATE SET password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name
  `;
  console.log(`CRM user "${username}" created/updated.`);
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
