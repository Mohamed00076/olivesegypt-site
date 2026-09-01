'use strict';

const { neon } = require('@neondatabase/serverless');
const { readJsonBody, parseCookies, verifySession, COOKIE_NAME, json } = require('./_lib');

function connectionString() {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED ||
    ''
  );
}

const MAX = {
  name: 200,
  email: 320,
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

function clean(v, cap) {
  return str(v).trim().slice(0, cap);
}

function optional(v, cap) {
  const s = clean(v, cap);
  return s.length ? s : null;
}

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_PER_WINDOW = 5;

function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

async function ensureSchema(sql) {
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
      message           text NOT NULL DEFAULT '',
      client_ip         text
    )
  `;
  // Table may already exist from before client_ip was added -- backfill
  // the column on existing deployments rather than assuming a fresh table.
  await sql`ALTER TABLE inquiries ADD COLUMN IF NOT EXISTS client_ip text`;
}

async function checkRateLimit(sql, ip, email) {
  const rows = await sql`
    SELECT count(*)::int AS n FROM inquiries
    WHERE created_at > now() - (${RATE_LIMIT_WINDOW_MINUTES} || ' minutes')::interval
      AND (client_ip = ${ip} OR lower(email) = lower(${email}))
  `;
  return (rows[0] && rows[0].n) || 0;
}

async function handlePost(event, sql) {
  const body = readJsonBody(event);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return json(400, { ok: false, error: 'Invalid request body' });
  }

  // Honeypot: a real visitor never fills this hidden field. Bots that
  // fill every input will. Pretend success so the bot doesn't learn
  // anything, but skip the insert.
  if (clean(body.website, 200).length > 0) {
    return json(200, { ok: true });
  }

  const name = clean(body.name, MAX.name);
  const email = clean(body.email, MAX.email);
  const company = clean(body.company, MAX.company);
  const country = clean(body.country, MAX.country);
  const message = clean(body.message, MAX.message);

  const errors = [];
  if (name.length < 2) errors.push('name');
  if (company.length < 2) errors.push('company');
  if (country.length < 2) errors.push('country');
  if (!/^[^@\s]+@[^@\s]+$/.test(email)) errors.push('email');
  if (message.length < 1) errors.push('message');

  if (errors.length) {
    return json(400, { ok: false, error: 'Validation failed', fields: errors });
  }

  const ip = clientIp(event);
  const recent = await checkRateLimit(sql, ip, email);
  if (recent >= RATE_LIMIT_MAX_PER_WINDOW) {
    return json(429, { ok: false, error: 'Too many requests. Please try again later.' });
  }

  const phone = optional(body.phone, MAX.phone);
  const productInterest = optional(body.product_interest, MAX.product_interest);
  const estimatedVolume = optional(body.estimated_volume, MAX.estimated_volume);
  const requestType = optional(body.request_type, MAX.request_type);

  await sql`
    INSERT INTO inquiries
      (name, email, company, country, phone,
       product_interest, estimated_volume, request_type, message, client_ip)
    VALUES
      (${name}, ${email}, ${company}, ${country}, ${phone},
       ${productInterest}, ${estimatedVolume}, ${requestType}, ${message}, ${ip})
  `;

  return json(200, { ok: true });
}

async function handleGet(event, sql) {
  const SESSION_SECRET = process.env.SESSION_SECRET;
  const token = SESSION_SECRET ? parseCookies(event.headers)[COOKIE_NAME] : null;
  const session = token ? verifySession(token, SESSION_SECRET) : null;
  if (!session) {
    return json(401, { error: 'Unauthorized' }, { 'Cache-Control': 'no-store, private' });
  }

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

  return json(200, rows, { 'Cache-Control': 'no-store, private' });
}

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method !== 'POST' && method !== 'GET') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST' });
  }

  const cs = connectionString();
  if (!cs) {
    if (method === 'POST') {
      return json(500, { ok: false, error: 'Server not configured' });
    }
    return json(500, { error: 'Server not configured' });
  }

  const sql = neon(cs);

  try {
    await ensureSchema(sql);
    if (method === 'POST') return await handlePost(event, sql);
    return await handleGet(event, sql);
  } catch (err) {
    console.error('[inquiries] db error:', err?.message ?? err);
    if (method === 'POST') {
      return json(500, { ok: false, error: 'Could not save inquiry' });
    }
    return json(500, { error: 'Could not load inquiries' });
  }
};
