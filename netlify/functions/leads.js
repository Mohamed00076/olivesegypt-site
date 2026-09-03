'use strict';

// Shared, reusable lead-capture backend for Section C7 ("Market Report"
// signup on the homepage) and any future consumer (Section F reuses this
// same backend per spec -- it must not be rebuilt there).
//
// IMPORTANT: this writes to `leads_staging`, a table separate from the
// `inquiries` table used by the real, already-approved Contact/Sample
// forms. Per the C7 spec this is a "local/staging test adapter only
// until [the owner approves] a real lead destination" -- e.g. wiring
// this up to a live mailing list or CRM. Do not repoint this at a
// production destination without that approval.

const { neon } = require('@neondatabase/serverless');
const { readJsonBody, json } = require('./_lib');

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
  email: 320,
  company_name: 300,
  country_region: 120,
  buyer_type: 60,
  source_page: 200,
  target_market: 120,
  variety: 120,
  format: 60,
  pack_size: 60,
  volume: 120,
  certification_requirements: 300,
  launch_date: 60,
};

// Every field this endpoint will ever accept. Anything outside this set
// in the request body is rejected outright (C7: "Reject event/form
// payloads containing unexpected sensitive fields not explicitly
// requested").
const ALLOWED_KEYS = new Set([
  'email', 'company_name', 'country_region', 'buyer_type', 'consent',
  'source_page', 'segment',
  // Private-label variant (optional, only meaningful when segment === 'private_label')
  'target_market', 'variety', 'format', 'pack_size', 'volume',
  'certification_requirements', 'launch_date',
  // Honeypot -- a real visitor never sees or fills this field.
  'website',
]);

const BUYER_TYPES = new Set(['importer', 'distributor', 'retail_chain', 'food_service', 'other']);
// 'pricing_guide' / 'origin_guide' / 'buyers_guide' added for Part C's
// gated PDF downloads -- same staging-only backend and table as
// 'market_report' above, just a distinct segment value so leads are
// attributable to which specific asset was requested. No new
// destination, no new validation path, no change to any existing
// segment's behavior.
const SEGMENTS = new Set(['market_report', 'private_label', 'pricing_guide', 'origin_guide', 'buyers_guide']);

const RATE_LIMIT_WINDOW_MINUTES = 60;
const RATE_LIMIT_MAX_PER_WINDOW = 5;

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

function clientIp(event) {
  const h = event.headers || {};
  return h['x-nf-client-connection-ip'] || h['client-ip'] || (h['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

async function ensureSchema(sql) {
  await sql`
    CREATE TABLE IF NOT EXISTS leads_staging (
      id                          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      created_at                  timestamptz NOT NULL DEFAULT now(),
      email                       text NOT NULL,
      company_name                text NOT NULL,
      country_region              text NOT NULL,
      buyer_type                  text NOT NULL,
      consent                     boolean NOT NULL,
      source_page                 text NOT NULL,
      segment                     text NOT NULL DEFAULT 'market_report',
      target_market               text,
      variety                     text,
      format                      text,
      pack_size                   text,
      volume                      text,
      certification_requirements  text,
      launch_date                 text,
      client_ip                   text
    )
  `;
}

async function checkRateLimit(sql, ip, email) {
  const rows = await sql`
    SELECT count(*)::int AS n FROM leads_staging
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

  const bodyKeys = Object.keys(body);
  const unexpected = bodyKeys.filter((k) => !ALLOWED_KEYS.has(k));
  if (unexpected.length) {
    return json(400, { ok: false, error: 'Unexpected fields in request', fields: unexpected });
  }

  // Honeypot: a real visitor never fills this hidden field. Bots that
  // fill every input will. Pretend success so the bot doesn't learn
  // anything, but skip the insert.
  if (clean(body.website, 200).length > 0) {
    return json(200, { ok: true });
  }

  const email = clean(body.email, MAX.email);
  const companyName = clean(body.company_name, MAX.company_name);
  const countryRegion = clean(body.country_region, MAX.country_region);
  const buyerType = clean(body.buyer_type, MAX.buyer_type).toLowerCase();
  const consent = body.consent === true;
  const sourcePage = clean(body.source_page, MAX.source_page);
  const segment = clean(body.segment, 30).toLowerCase() || 'market_report';

  const errors = [];
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('email');
  if (companyName.length < 2) errors.push('company_name');
  if (countryRegion.length < 2) errors.push('country_region');
  if (!BUYER_TYPES.has(buyerType)) errors.push('buyer_type');
  if (!consent) errors.push('consent');
  if (!sourcePage) errors.push('source_page');
  if (!SEGMENTS.has(segment)) errors.push('segment');

  if (errors.length) {
    return json(400, { ok: false, error: 'Validation failed', fields: errors });
  }

  const ip = clientIp(event);
  const recent = await checkRateLimit(sql, ip, email);
  if (recent >= RATE_LIMIT_MAX_PER_WINDOW) {
    return json(429, { ok: false, error: 'Too many requests. Please try again later.' });
  }

  const targetMarket = optional(body.target_market, MAX.target_market);
  const variety = optional(body.variety, MAX.variety);
  const format = optional(body.format, MAX.format);
  const packSize = optional(body.pack_size, MAX.pack_size);
  const volume = optional(body.volume, MAX.volume);
  const certificationRequirements = optional(body.certification_requirements, MAX.certification_requirements);
  const launchDate = optional(body.launch_date, MAX.launch_date);

  await sql`
    INSERT INTO leads_staging
      (email, company_name, country_region, buyer_type, consent, source_page, segment,
       target_market, variety, format, pack_size, volume, certification_requirements, launch_date,
       client_ip)
    VALUES
      (${email}, ${companyName}, ${countryRegion}, ${buyerType}, ${consent}, ${sourcePage}, ${segment},
       ${targetMarket}, ${variety}, ${format}, ${packSize}, ${volume}, ${certificationRequirements}, ${launchDate},
       ${ip})
  `;

  return json(200, { ok: true });
}

exports.handler = async (event) => {
  const method = event.httpMethod;

  if (method !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'POST' });
  }

  const cs = connectionString();
  if (!cs) {
    return json(500, { ok: false, error: 'Server not configured' });
  }

  const sql = neon(cs);

  try {
    await ensureSchema(sql);
    return await handlePost(event, sql);
  } catch (err) {
    console.error('[leads] db error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Could not save lead' });
  }
};
