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
//
// Phase 7 note: an internal notification email for these leads exists
// below but is OFF unless LEADS_NOTIFY is set to 1/true. Turning it on is
// exactly the "wire this up to a real destination" step the paragraph
// above reserves for the owner, so it is a deliberate switch rather than
// a default. The database write is unchanged either way, and a failed or
// disabled notification never affects the response the visitor gets.

const { neon } = require('@neondatabase/serverless');
const { readJsonBody, json } = require('./_lib');
const { sendNotification } = require('./_email_lib');
const {
  GUIDES, URL_TTL_SECONDS, COOKIE_TTL_SECONDS, signGuideToken, guideCookie,
} = require('./_guide_token');
const { ensureOptOutSchema, isOptedOut, resubscribe } = require('./_optout_lib');

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

// Plain text only, and deliberately narrow: the fields a person needs to
// decide whether to follow up, not the whole row. No client IP, no
// consent flag -- those live in the database for the record, but do not
// belong in an inbox.
function leadEmailText(f) {
  const lines = [
    'New gated-guide download on olivesegypt.com',
    '',
    'Guide: ' + f.segment,
    'Email: ' + f.email,
    'Company: ' + f.companyName,
    'Country / region: ' + f.countryRegion,
    'Buyer type: ' + f.buyerType,
  ];
  if (f.targetMarket) lines.push('Target market: ' + f.targetMarket);
  if (f.variety) lines.push('Variety: ' + f.variety);
  if (f.format) lines.push('Format: ' + f.format);
  if (f.packSize) lines.push('Pack size: ' + f.packSize);
  if (f.volume) lines.push('Volume: ' + f.volume);
  if (f.certificationRequirements) lines.push('Certifications: ' + f.certificationRequirements);
  if (f.launchDate) lines.push('Launch date: ' + f.launchDate);
  lines.push('', 'Submitted from: ' + f.sourcePage);
  if (f.liftedOptOut) {
    lines.push(
      '',
      'Note: this address had previously unsubscribed. The consent box on this',
      'submission lifted that, so contacting them about this request is fine.'
    );
  }
  return lines.join('\n');
}

/*
 * A successful lead for one of the three gated guides is what unlocks
 * that guide -- see netlify/functions/guide.js. Two tokens go back: one
 * in an HttpOnly cookie (24h, cannot be copied out of the browser) and
 * one in the JSON for the client to hang on the download link (1h,
 * because a URL can be shared). Segments that are not guides
 * ('market_report', 'private_label') get neither, and nothing about the
 * response shape changes for them.
 *
 * If SESSION_SECRET is missing the lead is still saved and the visitor
 * still gets ok:true -- their submission is not the thing that failed --
 * but no token is minted, and guide.js will refuse rather than serve
 * ungated. The log line below is the operator's signal.
 */
function guideGrant(segment) {
  if (!GUIDES[segment]) return {};
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    console.error(`[leads] SESSION_SECRET is not set -- cannot unlock guide '${segment}' for this lead.`);
    return {};
  }
  const token = signGuideToken(segment, secret, URL_TTL_SECONDS);
  return token ? { guide_token: token } : {};
}

function guideHeaders(segment) {
  if (!GUIDES[segment]) return {};
  const secret = process.env.SESSION_SECRET;
  if (!secret) return {};
  const token = signGuideToken(segment, secret, COOKIE_TTL_SECONDS);
  return token ? { 'Set-Cookie': guideCookie(token) } : {};
}

function leadsNotifyEnabled() {
  const v = String(process.env.LEADS_NOTIFY || '').toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
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

  /*
   * Someone who previously asked not to be contacted, and has now ticked
   * the consent box on a new request, is asking to be contacted about that
   * request. Their earlier opt-out is lifted and both facts stay in
   * contact_opt_out_events, so the trail shows the opt-out, the date, and
   * the later submission that reversed it -- rather than the site quietly
   * holding a stale "do not contact" against a person actively asking for
   * something, or quietly forgetting they ever opted out.
   */
  let liftedOptOut = false;
  try {
    if (await isOptedOut(sql, email)) {
      await resubscribe(sql, email, sourcePage, ip);
      liftedOptOut = true;
      console.log(`[leads] a previous opt-out was lifted by a new consented submission (form=${segment})`);
    }
  } catch (err) {
    // Never fail a lead over the opt-out bookkeeping.
    console.error('[leads] opt-out check failed:', err?.message ?? err);
  }

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

  // Off by default -- see the header note. Awaited so it finishes before
  // the execution context is frozen, but its failure is swallowed: a lead
  // that reached the database must never come back to the visitor as an
  // error because an email did not go out.
  if (leadsNotifyEnabled()) {
    try {
      await sendNotification(
        `New gated-guide download — ${companyName} (${segment})`,
        leadEmailText({
          email, companyName, countryRegion, buyerType, sourcePage, segment,
          targetMarket, variety, format, packSize, volume,
          certificationRequirements, launchDate, liftedOptOut,
        }),
        { replyTo: email, formType: `lead:${segment}` }
      );
    } catch (err) {
      console.error('[leads] notification email failed:', err?.message ?? err);
    }
  }

  return json(200, { ok: true, ...guideGrant(segment) }, guideHeaders(segment));
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
    await ensureOptOutSchema(sql);
    return await handlePost(event, sql);
  } catch (err) {
    console.error('[leads] db error:', err?.message ?? err);
    return json(500, { ok: false, error: 'Could not save lead' });
  }
};
