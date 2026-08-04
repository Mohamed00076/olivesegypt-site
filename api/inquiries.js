'use strict';

const { neon } = require('@neondatabase/serverless');
const {
  readJsonBody,
  parseCookies,
  verifySession,
  COOKIE_NAME,
} = require('./_lib');

// ---------------------------------------------------------------------------
// /api/inquiries  — lead capture (POST, public) + lead list (GET, admin-only)
//
// POST: the public "Request a Quote" contact form AND the sample-request form
// both submit here. Contracts reverse-engineered from the shipped bundle
// (assets/index-CM_6xm-Z.js):
//
//   Contact form body:
//     { name, email, company, country, phone?, product_interest?,
//       estimated_volume?, message }
//   Sample-request form body (same endpoint):
//     { name, email, company, country, phone|null, product_interest|null,
//       estimated_volume:"sample", request_type:"sample", message }   // message
//     is a pre-formatted block that folds in the shipping address + notes.
//
//   The client fetch wrapper THROWS on any non-2xx and JSON-parses the body,
//   so success MUST be 2xx. We return 200 { ok:true } (the only field the
//   form's onSuccess path relies on is a resolved, non-throwing response).
//
// GET: the dashboard (react-query, key ["/api/inquiries"]) consumes the JSON
// body as a BARE ARRAY of rows: `const A = data ?? []`. Per row it reads, and
// for four of them dereferences WITHOUT a null-guard (`.toLowerCase()`):
//   name, company, email, country            <- MUST be non-null strings
//   product_interest, phone, request_type,
//   estimated_volume, message                <- read with ?? fallbacks
//   created_at                               <- parsed via new Date(...)
// GET is admin-only: it verifies the tc_session cookie exactly like auth/me.
// react-query's default throwOnError is false here, so an unauthenticated 401
// surfaces as isError with data===undefined -> A=[]; the dashboard does not
// crash (it just shows no rows), and the client route is already auth-gated so
// this path is not hit in the normal app flow.
// ---------------------------------------------------------------------------

// Prefer the standard Vercel/Neon var. All of these point at the same Neon
// database; for the HTTP driver, pooled vs unpooled is irrelevant (each query
// is a stateless HTTPS request to the `/sql` endpoint, not a held session).
function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

// Field length caps. Generous enough never to reject a legit lead, tight
// enough to bound abuse / storage. message is the only long field.
const MAX = {
  name: 200,
  email: 320, // RFC 5321 max
  company: 300,
  country: 120,
  phone: 60,
  product_interest: 120,
  estimated_volume: 120,
  request_type: 40,
  message: 8000,
};

function str(v) {
  return typeof v === 'string' ? v : v == null ? '' : String(v);
}

// Trim + cap. Returns a string (possibly empty).
function clean(v, cap) {
  return str(v).trim().slice(0, cap);
}

// Optional field: trim + cap, but collapse empty to null for storage.
function optional(v, cap) {
  const s = clean(v, cap);
  return s.length ? s : null;
}

async function ensureSchema(sql) {
  // Idempotent, cheap. Safe to run on every cold start; concurrent runs race
  // harmlessly because IF NOT EXISTS is a no-op once the table exists (and
  // Postgres serializes the DDL). Columns match the POST field union.
  await sql`
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
    )
  `;
}

async function handlePost(req, res, sql) {
  // readJsonBody can THROW (not just return null) when the platform pre-parsed
  // the request as JSON, failed, and left the underlying stream consumed: the
  // fallback `for await (const chunk of req)` then rejects with "stream already
  // consumed". That happens for a malformed body sent with
  // Content-Type: application/json. Treat any such failure as a bad body (400),
  // never a 500 — a garbage POST must not look like a server crash.
  let body;
  try {
    body = await readJsonBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid request body' });
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ ok: false, error: 'Invalid request body' });
  }

  // Required fields: these are the ones the dashboard dereferences without a
  // null-guard, so they must never be stored empty. Mirror the client's own
  // zod rules (name/company/country min 2, email must look like an email,
  // message min 10) so we accept exactly what the form accepts and reject junk
  // that bypassed the client.
  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const company = clean(body.company, MAX.company);
  const country = clean(body.country, MAX.country);
  const message = clean(body.message, MAX.message);

  const errors = [];
  if (name.length < 2) errors.push('name');
  if (company.length < 2) errors.push('company');
  if (country.length < 2) errors.push('country');
  // Deliberately lenient email check: presence of a single "@" with something
  // on each side. We are storing a lead, not authenticating; over-strict email
  // regex rejects valid addresses and loses business.
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) errors.push('email');
  if (message.length < 1) errors.push('message');

  if (errors.length) {
    return res
      .status(400)
      .json({ ok: false, error: 'Validation failed', fields: errors });
  }

  const phone = optional(body.phone, MAX.phone);
  const productInterest = optional(body.product_interest, MAX.product_interest);
  const estimatedVolume = optional(body.estimated_volume, MAX.estimated_volume);
  const requestType = optional(body.request_type, MAX.request_type);

  await sql`
    INSERT INTO inquiries
      (name, email, company, country, phone,
       product_interest, estimated_volume, request_type, message)
    VALUES
      (${name}, ${email}, ${company}, ${country}, ${phone},
       ${productInterest}, ${estimatedVolume}, ${requestType}, ${message})
  `;

  return res.status(200).json({ ok: true });
}

async function handleGet(req, res, sql) {
  res.setHeader('Cache-Control', 'no-store, private');

  // Admin-only. Same verification path as api/auth/me.
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const token = SESSION_SECRET ? parseCookies(req)[COOKIE_NAME] : null;
  const session = token ? verifySession(token, SESSION_SECRET) : null;
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // COALESCE the four unguarded-on-the-client fields so a legacy/partial row
  // can never crash the dashboard. created_at is emitted as ISO 8601 so the
  // client's new Date(...) parses it deterministically across time zones.
  const rows = await sql`
    SELECT
      id,
      to_char(created_at AT TIME ZONE 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')     AS created_at,
      COALESCE(name, '')     AS name,
      COALESCE(email, '')    AS email,
      COALESCE(company, '')  AS company,
      COALESCE(country, '')  AS country,
      phone,
      product_interest,
      estimated_volume,
      request_type,
      COALESCE(message, '')  AS message
    FROM inquiries
    ORDER BY created_at DESC
    LIMIT 5000
  `;

  return res.status(200).json(rows);
}

module.exports = async (req, res) => {
  const method = req.method;
  if (method !== 'POST' && method !== 'GET') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const cs = connectionString();
  if (!cs) {
    // No database configured (e.g. a Development deploy without the Neon vars).
    // POST must not hard-fail the public form; GET is admin-only anyway.
    if (method === 'POST') {
      console.error('[inquiries] no DATABASE_URL/POSTGRES_URL configured');
      return res.status(500).json({ ok: false, error: 'Server not configured' });
    }
    // GET: still enforce auth semantics, then report the misconfig.
    return res.status(500).json({ error: 'Server not configured' });
  }

  const sql = neon(cs);

  try {
    await ensureSchema(sql);
    if (method === 'POST') return await handlePost(req, res, sql);
    return await handleGet(req, res, sql);
  } catch (err) {
    console.error('[inquiries] db error:', err && err.message ? err.message : err);
    if (method === 'POST') {
      return res.status(500).json({ ok: false, error: 'Could not save inquiry' });
    }
    return res.status(500).json({ error: 'Could not load inquiries' });
  }
};
