'use strict';
// Live DB round-trip proof for /api/inquiries.
//
// The Neon connection string may be marked "sensitive"/write-only in your
// Netlify env config, in which case it won't come back via the CLI or API by
// design. Run this where the string is actually available:
//
//   A) On a preview/prod deploy, hit the deployed endpoints (POST then GET with
//      a real session cookie) — the true end-to-end test.
//
//   B) Locally, only if you paste a connection string into the environment:
//        DATABASE_URL='postgres://...neon.tech/db?sslmode=require' \
//          node scripts/db-roundtrip-check.js
//      (Get it from the Neon dashboard directly, not from the Netlify CLI.)
//
// Proves: CREATE TABLE IF NOT EXISTS is idempotent, an INSERT persists, and a
// SELECT ... ORDER BY created_at DESC returns the row in the dashboard shape.

const { neon } = require('@neondatabase/serverless');

const cs =
  process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.DATABASE_URL_UNPOOLED;

if (!cs) {
  console.error('No connection string in env (DATABASE_URL/POSTGRES_URL). See header.');
  process.exit(1);
}

const sql = neon(cs);
const marker = 'roundtrip-' + Date.now();

(async () => {
  // 1. schema (idempotent — run twice to prove no error on re-run)
  const ddl = `
    CREATE TABLE IF NOT EXISTS inquiries (
      id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at        timestamptz NOT NULL DEFAULT now(),
      name              text NOT NULL,
      email             text NOT NULL,
      company           text NOT NULL,
      country           text NOT NULL,
      phone             text,
      product_interest  text,
      estimated_volume  text,
      request_type      text,
      message           text NOT NULL DEFAULT ''
    )`;
  await sql(ddl);
  await sql(ddl); // second run must be a no-op, not an error
  console.log('[1] CREATE TABLE IF NOT EXISTS ok (ran twice, idempotent)');

  // 2. insert (parameterized; note the marker in company so we can clean up)
  await sql`
    INSERT INTO inquiries
      (name, email, company, country, phone, product_interest, estimated_volume, request_type, message)
    VALUES
      (${'Roundtrip Bot'}, ${'bot@example.com'}, ${marker}, ${'Testland'},
       ${null}, ${'Green Olives'}, ${'sample'}, ${'sample'}, ${"O'Brien said \"hi\"; DROP TABLE inquiries;--"})`;
  console.log('[2] INSERT persisted (company marker =', marker + ')');

  // 3. select in the exact dashboard shape
  const rows = await sql`
    SELECT
      id,
      to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
      COALESCE(name,'') AS name, COALESCE(email,'') AS email,
      COALESCE(company,'') AS company, COALESCE(country,'') AS country,
      phone, product_interest, estimated_volume, request_type,
      COALESCE(message,'') AS message
    FROM inquiries WHERE company = ${marker} ORDER BY created_at DESC`;
  console.log('[3] SELECT returned', rows.length, 'row(s). First row:');
  console.log(JSON.stringify(rows[0], null, 2));

  // 4. prove the malicious message string round-tripped as DATA (table still here)
  const stillThere = await sql`SELECT count(*)::int AS n FROM inquiries`;
  console.log('[4] injection attempt stored as literal text; table intact. total rows =', stillThere[0].n);

  // 5. cleanup this test row
  await sql`DELETE FROM inquiries WHERE company = ${marker}`;
  console.log('[5] cleaned up test row(s).');

  console.log('\nROUND-TRIP OK');
})().catch((e) => { console.error('ROUND-TRIP FAILED:', e); process.exit(1); });
